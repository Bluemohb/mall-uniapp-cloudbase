/**
 * ============================================================
 * ⭐ 收藏存储（云端 favorites 集合 + 本地镜像）
 * ============================================================
 * 存储模型
 *   云端：favorites 集合，一个用户一条文档
 *         { userId, items: FavoriteItem[], createdAt, updatedAt }
 *   本地：`favorite_<uid>` —— 云端收藏的镜像缓存（同步读，UI 不等待网络）
 *         `favorite_list` —— 本地临时收藏（未登录 / 离线时写这里）
 *
 * 【为什么收藏不像商品那样有 Mock 开关】
 *   utils/mock.ts 那两个开关管的是「商品内容从哪来」：
 *   本地 mock/products_02.json 还是云端 products 集合。
 *   收藏是「用户自己的数据」，无论商品来自哪里都要落到用户身上，
 *   所以这里和购物车（utils/cart.ts）保持一致：本地镜像保证同步可读、
 *   离线可用，云端同步失败静默降级 —— 开发与生产走同一套代码路径。
 *
 * 【启动合并（syncFavoritesOnStartup）】
 *   把「本地镜像 + 本地临时收藏」与云端收藏合并（按 productId 取并集）后写回云端，
 *   然后清空临时收藏。收藏的语义是「存在即收藏」，并集本身幂等：
 *   合并结果下次再参与合并也不会长出新条目。
 *
 * ⚠️ 云端读写必须带 userId 条件
 *   favorites 的安全规则与 carts 相同：
 *     { read/write: auth.uid != null && doc.userId == auth.uid }
 *   CloudBase 会做「查询条件子集校验」：客户端查询必须自带能覆盖安全规则的
 *   条件，否则直接 403。所以只能 where({ userId }).xxx()，
 *   不能用 doc(id).xxx()（后者只按 _id 查，会被拒绝）。
 *
 * ⚠️ 已知权衡：离线「取消收藏」可能被云端覆盖回来
 *   取消收藏 = 用「去掉该项的数组」整份覆盖云端。若此刻离线，推送失败，
 *   本地已无该项而云端仍有，下次启动合并取并集时该项会回来。
 *   这与购物车的离线权衡一致：宁可让用户再取消一次，也不在离线时丢数据。
 * ============================================================
 */
import { app, getUid } from './cloudbase'

/**
 * 收藏条目
 *
 * 存的是商品快照（名称/图片/价格），收藏列表页一次读取即可渲染，
 * 不必再按 productId 反查商品（多一次网络往返 + 商品可能已下架）。
 * 点进详情页时才用 productId 拉取最新数据。
 */
export interface FavoriteItem {
  productId: string
  name: string
  image: string
  price: number
  category?: string
  addTime: number
}

/** 新增收藏的入参（addTime 由存储层补，避免调用方各自造时间戳） */
export type FavoriteInput = Omit<FavoriteItem, 'addTime'>

/** 云端集合名 */
const FAVORITE_COLLECTION = 'favorites'
/** 记录已解析的 uid，便于同步生成存储 key */
const FAVORITE_UID_KEY = 'favorite_uid'
/** 本地临时收藏：未登录 / 离线时写这里，启动时合并进云端 */
const FAVORITE_TEMP_KEY = 'favorite_list'

let cachedUid = ''

/** 启动合并的进行中 Promise（幂等共享，见 syncFavoritesOnStartup） */
let syncPromise: Promise<FavoriteItem[]> | null = null
/** 待推送的收藏（单飞 + 最新覆盖，保证并发写不会乱序） */
let pendingPush: { uid: string, items: FavoriteItem[] } | null = null
let pushing = false

/**
 * 确保拿到 uid 并缓存（幂等，可并发调用）
 *
 * 与购物车同理：必须用「真实登录态」的 uid，不能用 mock 用户标识。
 * 收藏存在云端 favorites 集合，规则按「登录态非空 + doc.userId == auth.uid」
 * 判定归属，用假 uid 写入会被后端判定为伪造数据而拒绝。
 */
export async function ensureFavoriteUid(): Promise<string> {
  if (cachedUid)
    return cachedUid

  cachedUid = (uni.getStorageSync(FAVORITE_UID_KEY) as string) || ''
  if (cachedUid)
    return cachedUid

  try {
    cachedUid = await getUid()
  }
  catch {
    cachedUid = ''
  }

  if (cachedUid)
    uni.setStorageSync(FAVORITE_UID_KEY, cachedUid)

  return cachedUid
}

/** 退出登录时调用：清除缓存的 uid 与待推送数据，避免读到上一个账号的收藏 */
export function resetFavoriteUid(): void {
  cachedUid = ''
  pendingPush = null
  syncPromise = null
  uni.removeStorageSync(FAVORITE_UID_KEY)
}

/** 当前用户收藏的本地镜像 key（未登录时退回本地临时收藏，保证可用） */
export function favoriteStorageKey(): string {
  return cachedUid ? `favorite_${cachedUid}` : FAVORITE_TEMP_KEY
}

/** 读取当前用户收藏（同步，需先 ensureFavoriteUid） */
export function readFavorites(): FavoriteItem[] {
  return readStorage(favoriteStorageKey())
}

/**
 * 写入当前用户收藏（同步：落本地镜像，再后台推送云端）
 *
 * 内容没变化时不推送：收藏列表页 onShow 会重新加载并回写一次，
 * 若每次加载都推云端就是无谓的写放大。
 */
export function writeFavorites(list: FavoriteItem[]): void {
  const next = sanitizeFavorites(list)
  const changed = signature(next) !== signature(readFavorites())
  uni.setStorageSync(favoriteStorageKey(), next)

  if (changed && cachedUid)
    scheduleCloudPush(cachedUid, next)
}

// ============================================================
// 收藏判定与增删（页面用这三个函数即可，无需关心存储细节）
// ============================================================

/** 判断某商品是否已收藏 */
export function isFavorite(productId: string): boolean {
  if (!productId)
    return false
  return readFavorites().some(item => item.productId === productId)
}

/** 新增收藏（已在收藏中则只刷新快照，不会产生重复条目） */
export function addFavorite(input: FavoriteInput): void {
  const rest = readFavorites().filter(item => item.productId !== input.productId)
  // 最新收藏排在最前
  rest.unshift({ ...input, addTime: Date.now() })
  writeFavorites(rest)
}

/**
 * 取消收藏
 * @returns 是否真的删除了条目（本来就没收藏时返回 false）
 */
export function removeFavorite(productId: string): boolean {
  const list = readFavorites()
  const next = list.filter(item => item.productId !== productId)
  if (next.length === list.length)
    return false

  writeFavorites(next)
  return true
}

/**
 * 切换收藏状态
 * @returns 切换后的状态：true = 已收藏，false = 已取消
 */
export function toggleFavorite(input: FavoriteInput): boolean {
  if (isFavorite(input.productId)) {
    removeFavorite(input.productId)
    return false
  }

  addFavorite(input)
  return true
}

// ============================================================
// 启动合并：本地临时收藏 → 云端
// ============================================================

/**
 * 启动时合并本地临时收藏到云端（幂等，重复调用共享同一次结果）
 *
 * 返回合并后的收藏。任何失败都会回退成本地收藏，不阻塞启动。
 */
export async function syncFavoritesOnStartup(): Promise<FavoriteItem[]> {
  if (!syncPromise) {
    syncPromise = doSyncFavorites().catch((error) => {
      console.warn('[favorite] 启动合并收藏失败，继续使用本地收藏:', error)
      return readFavorites()
    })
  }
  return syncPromise
}

async function doSyncFavorites(): Promise<FavoriteItem[]> {
  const uid = await ensureFavoriteUid()
  // 未登录（离线等）：本地临时收藏照常可用，下次启动再合并
  if (!uid)
    return readFavorites()

  const local = mergeFavorites(readFavorites(), readStorage(FAVORITE_TEMP_KEY))
  const cloud = await fetchCloudFavorites(uid)

  // 本地没有待同步数据：以云端为准，保证多端看到的是同一份收藏
  if (!local.length) {
    uni.setStorageSync(`favorite_${uid}`, cloud)
    return cloud
  }

  const merged = mergeFavorites(cloud, local)
  uni.setStorageSync(`favorite_${uid}`, merged)

  if (signature(merged) !== signature(cloud))
    scheduleCloudPush(uid, merged)

  // 临时收藏已并入云端（即使推送失败，数据也还在本地镜像里，下次启动会再合并）
  uni.removeStorageSync(FAVORITE_TEMP_KEY)
  return merged
}

/**
 * 合并两批收藏：按 productId 取并集
 *
 * 收藏的语义是「存在即收藏」，所以并集天然幂等 ——
 * 合并结果再参与合并也不会产生新条目（购物车那边需要「取较大数量」也是同理）。
 * 同一商品在两处都有时保留较早的 addTime：收藏时间以第一次为准。
 */
function mergeFavorites(base: FavoriteItem[], extra: FavoriteItem[]): FavoriteItem[] {
  const map = new Map<string, FavoriteItem>()

  for (const item of [...base, ...extra]) {
    const exist = map.get(item.productId)
    if (!exist) {
      map.set(item.productId, item)
      continue
    }

    const earlier = (exist.addTime || 0) <= (item.addTime || 0) ? exist : item
    map.set(item.productId, earlier)
  }

  // 最新收藏在前
  return [...map.values()].sort((a, b) => b.addTime - a.addTime)
}

// ============================================================
// 云端读写
// ============================================================

/** 读取云端收藏（抛错由调用方兜底） */
async function fetchCloudFavorites(uid: string): Promise<FavoriteItem[]> {
  const res: unknown = await app.database().collection(FAVORITE_COLLECTION).where({ userId: uid }).limit(1).get()
  const doc = (res as { data?: Array<{ items?: unknown }> })?.data?.[0]
  return sanitizeFavorites(doc?.items)
}

/**
 * 写入云端收藏（没有该用户的文档就新增）
 *
 * 返回的 updated 计数必须显式判断：0 表示「没有匹配到文档」而不是成功，
 * 仅凭「没抛异常」会把失败当成功。
 */
async function pushFavoritesToCloud(uid: string, items: FavoriteItem[]): Promise<void> {
  const db = app.database()
  const now = Date.now()

  const res: unknown = await db.collection(FAVORITE_COLLECTION).where({ userId: uid }).update({
    items,
    updatedAt: now,
  })
  const updated = (res as { updated?: number })?.updated ?? 0

  if (updated === 0) {
    await db.collection(FAVORITE_COLLECTION).add({
      userId: uid,
      items,
      createdAt: now,
      updatedAt: now,
    })
  }
}

function scheduleCloudPush(uid: string, items: FavoriteItem[]): void {
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

      // 期间可能退出登录/切换账号，避免写到别人的收藏里
      if (task.uid !== cachedUid)
        continue

      try {
        await pushFavoritesToCloud(task.uid, task.items)
      }
      catch (error) {
        // 推送失败不丢数据：本地镜像仍在，下次启动合并时会重新推
        console.warn('[favorite] 收藏同步云端失败，已保留本地数据:', error)
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

function readStorage(key: string): FavoriteItem[] {
  try {
    return sanitizeFavorites(uni.getStorageSync(key))
  }
  catch {
    return []
  }
}

/** 过滤结构不合法的条目，并按 productId 去重，避免脏数据把页面渲染搞崩 */
function sanitizeFavorites(raw: unknown): FavoriteItem[] {
  if (!Array.isArray(raw))
    return []

  const seen = new Set<string>()
  const list: FavoriteItem[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object')
      continue

    const record = item as Record<string, unknown>
    const productId = String(record.productId ?? '')
    if (!productId || seen.has(productId))
      continue

    seen.add(productId)
    list.push({
      productId,
      name: String(record.name ?? ''),
      image: String(record.image ?? ''),
      price: Number(record.price) || 0,
      category: record.category ? String(record.category) : undefined,
      // 缺失时间戳时用 0，避免每次读取都生成新值导致「内容变化」误判
      addTime: Number(record.addTime) || 0,
    })
  }

  return list
}

/** 「内容是否变化」的稳定签名（与顺序无关） */
function signature(items: FavoriteItem[]): string {
  return items
    .map(item => `${item.productId}|${item.addTime}`)
    .sort()
    .join(',')
}
