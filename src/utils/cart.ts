/**
 * ============================================================
 * 🛒 购物车存储（云端 carts 集合 + 本地临时车）
 * ============================================================
 * 存储模型
 *   云端：carts 集合，一个用户一条文档
 *         { userId, items: CartItem[], createdAt, updatedAt }
 *   本地：`cart_<uid>` —— 云端购物车的镜像缓存（同步读，UI 不等待网络）
 *         `cart_list` —— 本地临时车（未登录 / 离线时写这里）
 *
 * 为什么保留同步读写？
 *   购物车页、商品详情页、下单页都是「读出来 → 改 → 写回去」的同步写法，
 *   保持 readCart/writeCart 的同步签名，这些页面可以零改动接入云端：
 *   写入先落本地镜像（UI 立即生效、离线可用），再在后台推送云端。
 *
 * 启动合并（syncCartOnStartup）
 *   把「本地镜像 + 本地临时车」与云端购物车合并后写回云端，然后清空临时车。
 *   合并规则是「同商品同规格取较大数量」而不是相加，这样保证幂等：
 *   合并结果下次再参与合并也不会重复累加（相加则需要额外的「已同步」标记）。
 *
 * ⚠️ 云端读写必须带 userId 条件
 *   carts 的安全规则是
 *     { read/update/delete: auth.uid != null && doc.userId == auth.uid }，
 *   CloudBase 会做「查询条件子集校验」：客户端查询必须自带能覆盖安全规则的
 *   条件，否则直接 403。所以只能 where({ userId }).xxx()，
 *   不能用 doc(id).xxx()（后者只按 _id 查，会被拒绝）。
 *
 * ⚠️ 规则为什么按 userId 而不是 _openid
 *   匿名登录会话里 auth.openid 为空（只有 sub/uid），
 *   规则写成 doc._openid == auth.openid 时，H5 / 匿名端读写会被全部拒绝
 *   （只能新增，因为 create 规则通常只校验 auth.uid != null）。
 * ============================================================
 */
import { app, getUid } from './cloudbase'

/** 购物车条目（与详情页/购物车页保持一致） */
export interface CartItem {
  productId: string
  name: string
  image: string
  price: number
  specs: string
  quantity: number
  selected: boolean
  addTime: number
}

/** 云端集合名 */
const CART_COLLECTION = 'carts'
/** 记录已解析的 uid，便于同步生成存储 key */
const CART_UID_KEY = 'cart_uid'
/** 本地临时车：未登录 / 离线时写这里，启动时合并进云端 */
const CART_TEMP_KEY = 'cart_list'

let cachedUid = ''

/** 启动合并的进行中 Promise（幂等共享，见 syncCartOnStartup） */
let syncPromise: Promise<CartItem[]> | null = null
/** 待推送的购物车（单飞 + 最新覆盖，保证并发写不会乱序） */
let pendingPush: { uid: string, items: CartItem[] } | null = null
let pushing = false

/**
 * 确保拿到 uid 并缓存（幂等，可并发调用）
 *
 * 注意：这里必须用「真实登录态」的 uid，不能用 mock 用户标识。
 * 购物车存在云端 carts 集合，规则按「登录态非空 + doc.userId == auth.uid」判定归属，
 * 用假 uid 写入会被后端判定为伪造数据而拒绝。
 */
export async function ensureCartUid(): Promise<string> {
  if (cachedUid)
    return cachedUid

  cachedUid = (uni.getStorageSync(CART_UID_KEY) as string) || ''
  if (cachedUid)
    return cachedUid

  try {
    cachedUid = await getUid()
  }
  catch {
    cachedUid = ''
  }

  if (cachedUid)
    uni.setStorageSync(CART_UID_KEY, cachedUid)

  return cachedUid
}

/** 退出登录时调用：清除缓存的 uid 与待推送数据，避免串号 */
export function resetCartUid(): void {
  cachedUid = ''
  pendingPush = null
  syncPromise = null
  uni.removeStorageSync(CART_UID_KEY)
}

/** 当前用户购物车的本地镜像 key（未登录时退回本地临时车，保证可用） */
export function cartStorageKey(): string {
  return cachedUid ? `cart_${cachedUid}` : CART_TEMP_KEY
}

/** 读取当前用户购物车（同步，需先 ensureCartUid） */
export function readCart(): CartItem[] {
  return readStorage(cartStorageKey())
}

/**
 * 写入当前用户购物车（同步：落本地镜像，再后台推送云端）
 *
 * 内容没变化时不推送：购物车页 onShow 会重新加载并回写一次，
 * 若每次加载都推云端就是无谓的写放大。
 */
export function writeCart(list: CartItem[]): void {
  const next = sanitizeItems(list)
  const changed = signature(next) !== signature(readCart())
  uni.setStorageSync(cartStorageKey(), next)

  if (changed && cachedUid)
    scheduleCloudPush(cachedUid, next)
}

// ============================================================
// 启动合并：本地临时车 → 云端
// ============================================================

/**
 * 启动时合并本地临时车到云端（幂等，重复调用共享同一次结果）
 *
 * 返回合并后的购物车。任何失败都会回退成本地购物车，不阻塞启动。
 */
export async function syncCartOnStartup(): Promise<CartItem[]> {
  if (!syncPromise) {
    syncPromise = doSyncCart().catch((error) => {
      console.warn('[cart] 启动合并购物车失败，继续使用本地购物车:', error)
      return readCart()
    })
  }
  return syncPromise
}

async function doSyncCart(): Promise<CartItem[]> {
  const uid = await ensureCartUid()
  // 未登录（离线等）：本地临时车照常可用，下次启动再合并
  if (!uid)
    return readCart()

  const local = mergeCartItems(readCart(), readStorage(CART_TEMP_KEY))
  const cloud = await fetchCloudCart(uid)

  // 本地没有待同步数据：以云端为准，保证多端看到的是同一辆车
  if (!local.length) {
    uni.setStorageSync(`cart_${uid}`, cloud)
    return cloud
  }

  const merged = mergeCartItems(cloud, local)
  uni.setStorageSync(`cart_${uid}`, merged)

  if (signature(merged) !== signature(cloud))
    scheduleCloudPush(uid, merged)

  // 临时车已并入云端（即使推送失败，数据也还在本地镜像里，下次启动会再合并）
  uni.removeStorageSync(CART_TEMP_KEY)
  return merged
}

/**
 * 合并两批购物车条目：同商品同规格取较大数量
 *
 * 用「取较大值」而不是「相加」，是为了让整个合并过程幂等：
 * 合并结果写回本地镜像后，下次启动再合并也不会把数量翻倍。
 */
function mergeCartItems(base: CartItem[], extra: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>()

  for (const item of [...base, ...extra]) {
    const key = `${item.productId}|${item.specs}`
    const exist = map.get(key)
    map.set(key, exist ? { ...exist, quantity: Math.max(exist.quantity, item.quantity) } : item)
  }

  return [...map.values()].sort((a, b) => a.addTime - b.addTime)
}

// ============================================================
// 云端读写
// ============================================================

/** 读取云端购物车（抛错由调用方兜底） */
async function fetchCloudCart(uid: string): Promise<CartItem[]> {
  const res: unknown = await app.database().collection(CART_COLLECTION).where({ userId: uid }).limit(1).get()
  const doc = (res as { data?: Array<{ items?: unknown }> })?.data?.[0]
  return sanitizeItems(doc?.items)
}

/**
 * 写入云端购物车（没有该用户的车就新增）
 *
 * 返回的 updated 计数必须显式判断：0 表示「没有匹配到文档」而不是成功，
 * 仅凭「没抛异常」会把失败当成功。
 */
async function pushCartToCloud(uid: string, items: CartItem[]): Promise<void> {
  const db = app.database()
  const now = Date.now()

  const res: unknown = await db.collection(CART_COLLECTION).where({ userId: uid }).update({
    items,
    updatedAt: now,
  })
  const updated = (res as { updated?: number })?.updated ?? 0

  if (updated === 0) {
    await db.collection(CART_COLLECTION).add({
      userId: uid,
      items,
      createdAt: now,
      updatedAt: now,
    })
  }
}

function scheduleCloudPush(uid: string, items: CartItem[]): void {
  pendingPush = { uid, items }
  if (!pushing)
    void flushCloudPush()
}

async function flushCloudPush(): Promise<void> {
  pushing = true
  try {
    while (pendingPush) {
      const task = pendingPush
      pendingPush = null

      // 期间可能退出登录/切换账号，避免写到别人的购物车里
      if (task.uid !== cachedUid)
        continue

      try {
        await pushCartToCloud(task.uid, task.items)
      }
      catch (error) {
        // 推送失败不丢数据：本地镜像仍在，下次启动合并时会重新推
        console.warn('[cart] 购物车同步云端失败，已保留本地数据:', error)
      }
    }
  }
  finally {
    pushing = false
  }
}

// ============================================================
// 本地存储工具
// ============================================================

function readStorage(key: string): CartItem[] {
  try {
    return sanitizeItems(uni.getStorageSync(key))
  }
  catch {
    return []
  }
}

/** 过滤结构不合法的条目，避免脏数据把页面渲染搞崩 */
function sanitizeItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw))
    return []

  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(item => ({
      productId: String(item.productId ?? ''),
      name: String(item.name ?? ''),
      image: String(item.image ?? ''),
      price: Number(item.price) || 0,
      specs: String(item.specs ?? ''),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      selected: item.selected !== false,
      // 缺失时间戳时用 0，避免每次读取都生成新值导致「内容变化」误判
      addTime: Number(item.addTime) || 0,
    }))
    .filter(item => item.productId)
}

/** 「内容是否变化」的稳定签名（与顺序无关） */
function signature(items: CartItem[]): string {
  return items
    .map(item => `${item.productId}|${item.specs}|${item.quantity}|${item.price}|${item.selected ? 1 : 0}`)
    .sort()
    .join(',')
}
