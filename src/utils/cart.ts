/**
 * ============================================================
 * 🛒 购物车存储（云端 carts 集合 + 本地临时车）
 * ============================================================
 * 通用骨架（uid 缓存 / 本地镜像 / 临时区 / 单飞推送 / 启动合并）在
 * utils/user-scoped-store.ts，这里只保留购物车的差异：
 *   1. CartItem 结构与清洗规则
 *   2. 变化签名（quantity / price / selected 都参与）
 *   3. 合并规则：同商品同规格取较大数量 —— 幂等，合并结果写回后再合并
 *      不会把数量翻倍（相加则需额外的「已同步」标记）
 *
 * 存储位置：云端 carts 一条文档；本地镜像 `cart_<uid>`、临时车 `cart_list`。
 * 读写保持同步签名，购物车页 / 详情页 / 下单页可零改动接入云端。
 * ============================================================
 */
import { createUserScopedStore } from './user-scoped-store'

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

// ============================================================
// 只属于购物车的三条策略
// ============================================================

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

/** 合并两批购物车条目：同商品同规格取较大数量（幂等） */
function mergeCartItems(base: CartItem[], extra: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>()

  for (const item of [...base, ...extra]) {
    const key = `${item.productId}|${item.specs}`
    const exist = map.get(key)
    map.set(key, exist ? { ...exist, quantity: Math.max(exist.quantity, item.quantity) } : item)
  }

  return [...map.values()].sort((a, b) => a.addTime - b.addTime)
}

const store = createUserScopedStore<CartItem>({
  name: 'cart',
  label: '购物车',
  collection: 'carts',
  uidKey: 'cart_uid',
  tempKey: 'cart_list',
  mirrorPrefix: 'cart',
  sanitize: sanitizeItems,
  signature,
  merge: mergeCartItems,
})

// ============================================================
// 对外 API：直接转出工厂句柄，保持旧签名，页面零改动
// ============================================================

export const ensureCartUid = store.ensureUid
/** 退出登录时调用：清除缓存 uid 与待推送数据，避免串号 */
export const resetCartUid = store.resetUid
export const cartStorageKey = store.storageKey
export const readCart = store.read
export const writeCart = store.write
export const syncCartOnStartup = store.syncOnStartup
