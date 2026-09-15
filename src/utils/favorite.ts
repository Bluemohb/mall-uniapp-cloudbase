/**
 * ============================================================
 * ⭐ 收藏存储（云端 favorites 集合 + 本地镜像）
 * ============================================================
 * 通用骨架（uid 缓存 / 本地镜像 / 临时区 / 单飞推送 / 启动合并）在
 * utils/user-scoped-store.ts，这里只保留收藏的差异：
 *   1. FavoriteItem 结构与清洗（按 productId 去重）
 *   2. 变化签名（只看 productId + addTime）
 *   3. 合并规则：按 productId 取并集（「存在即收藏」，并集天然幂等）
 *   4. 页面用的 isFavorite / addFavorite / removeFavorite / toggleFavorite
 *
 * 存储位置：云端 favorites 一条文档；本地镜像 `favorite_<uid>`、
 * 临时收藏 `favorite_list`。
 *
 * 【为什么没有 Mock 开关】收藏是用户自己的数据，无论商品内容来自 mock 还是
 * 云端都要落到用户身上，所以与购物车一致：开发与生产走同一套代码路径。
 *
 * ⚠️ 已知权衡：离线「取消收藏」可能被云端覆盖回来
 *   取消 = 用「去掉该项的数组」整份覆盖云端，离线时推送失败，下次合并取并集
 *   该项会回来。与购物车同理：宁可让用户再取消一次，也不在离线时丢数据。
 * ============================================================
 */
import { createUserScopedStore } from './user-scoped-store'

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

// ============================================================
// 只属于收藏的三条策略
// ============================================================

/** 过滤结构不合法的条目，并按 productId 去重，避免脏数据把页面渲染搞崩 */
export function sanitizeFavorites(raw: unknown): FavoriteItem[] {
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
export function signature(items: FavoriteItem[]): string {
  return items
    .map(item => `${item.productId}|${item.addTime}`)
    .sort()
    .join(',')
}

/**
 * 合并两批收藏：按 productId 取并集
 *
 * 收藏的语义是「存在即收藏」，所以并集天然幂等 ——
 * 合并结果再参与合并也不会产生新条目（购物车那边需要「取较大数量」也是同理）。
 * 同一商品在两处都有时保留较早的 addTime：收藏时间以第一次为准。
 */
export function mergeFavorites(base: FavoriteItem[], extra: FavoriteItem[]): FavoriteItem[] {
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

const store = createUserScopedStore<FavoriteItem>({
  name: 'favorite',
  label: '收藏',
  collection: 'favorites',
  uidKey: 'favorite_uid',
  tempKey: 'favorite_list',
  mirrorPrefix: 'favorite',
  sanitize: sanitizeFavorites,
  signature,
  merge: mergeFavorites,
})

// ============================================================
// 基础读写：直接转出工厂句柄，保持旧签名，页面零改动
// （必须先于下面的增删函数定义，它们依赖这些读写）
// ============================================================

export const ensureFavoriteUid = store.ensureUid
/** 退出登录时调用：清除缓存 uid 与待推送数据，避免读到上一个账号的收藏 */
export const resetFavoriteUid = store.resetUid
export const favoriteStorageKey = store.storageKey
export const readFavorites = store.read
export const writeFavorites = store.write
export const syncFavoritesOnStartup = store.syncOnStartup

// ============================================================
// 收藏判定与增删（页面用这一组函数即可，无需关心存储细节）
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
