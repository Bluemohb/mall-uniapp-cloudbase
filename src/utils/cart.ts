/**
 * ============================================================
 * 🛒 购物车本地存储（按用户隔离）
 * ============================================================
 * 背景：过去所有用户共用 'cart_list' 这一个 key，
 *       同一台设备换账号后能看到上一个用户的购物车（串号）。
 *
 * 做法：存储 key 变为 `cart_<uid>`，未登录时才退回旧的全局 key。
 *       由于 uid 需要异步获取，页面在读写前先 await ensureCartUid()。
 * ============================================================
 */
import { getUid } from './cloudbase'
import { USE_MOCK } from './mock'
import { MOCK_USER_ID } from './order-mock'

/** 购物车条目（本地存储结构，与详情页/购物车页保持一致） */
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

/** 记录已解析的 uid，便于同步生成存储 key */
const CART_UID_KEY = 'cart_uid'
let cachedUid = ''

/**
 * 确保拿到 uid 并缓存（幂等、并发安全）
 * Mock 环境直接用固定标识，避免依赖云端登录态
 */
export async function ensureCartUid(): Promise<string> {
  if (cachedUid)
    return cachedUid

  cachedUid = (uni.getStorageSync(CART_UID_KEY) as string) || ''
  if (cachedUid)
    return cachedUid

  try {
    cachedUid = USE_MOCK ? MOCK_USER_ID : await getUid()
  }
  catch {
    cachedUid = ''
  }

  if (cachedUid) {
    uni.setStorageSync(CART_UID_KEY, cachedUid)
    migrateLegacyCart(cachedUid)
  }

  return cachedUid
}

/** 平滑迁移：把旧的全局 cart_list 搬到 `cart_<uid>`（仅首次，之后不再有 cart_list） */
function migrateLegacyCart(uid: string): void {
  const uidKey = `cart_${uid}`
  const legacy = uni.getStorageSync('cart_list')
  if (!uni.getStorageSync(uidKey) && Array.isArray(legacy) && legacy.length) {
    uni.setStorageSync(uidKey, legacy)
    uni.removeStorageSync('cart_list')
  }
}

/** 退出登录时调用：清除缓存的 uid，下次登录重新解析，避免串号 */
export function resetCartUid(): void {
  cachedUid = ''
  uni.removeStorageSync(CART_UID_KEY)
}

/** 当前购物车存储 key（未登录时退回旧的全局 key，保证可用） */
export function cartStorageKey(): string {
  return cachedUid ? `cart_${cachedUid}` : 'cart_list'
}

/** 读取当前用户购物车（同步，需先 ensureCartUid） */
export function readCart(): CartItem[] {
  try {
    const raw = uni.getStorageSync(cartStorageKey())
    return Array.isArray(raw) ? (raw as CartItem[]) : []
  }
  catch {
    return []
  }
}

/** 写入当前用户购物车（同步，需先 ensureCartUid） */
export function writeCart(list: CartItem[]): void {
  uni.setStorageSync(cartStorageKey(), list)
}
