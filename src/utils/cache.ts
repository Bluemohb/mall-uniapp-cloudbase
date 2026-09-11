/**
 * ============================================================
 * 🗄️ 带过期时间的本地缓存
 * ============================================================
 * 背景：以往直接把数据塞进 uni.setStorageSync，之后永远不失效，
 *       一旦云端数据被改动（如切换默认地址），本地缓存就成了「脏数据」。
 *
 * 做法：写入时包裹一层 { __cache, data, expireAt }，
 *       读取时检查 expireAt，过期即自动清除并返回 null，调用方回源。
 *       旧版不带过期结构的裸缓存会被视为已过期，强制回源（平滑升级）。
 * ============================================================
 */

/** 常用缓存 key 常量，避免各处硬编码字符串 */
export const CACHE_KEYS = {
  /** 订单确认页使用的「默认地址」缓存（带过期时间） */
  defaultAddress: 'default_address',
} as const

/** 默认有效期：1 天（毫秒） */
export const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000

interface CacheEnvelope<T> {
  __cache: true
  data: T
  expireAt: number
}

/** 写入带 TTL 的缓存（ttl 单位毫秒，默认 24 小时） */
export function setCache<T>(key: string, data: T, ttl: number = DEFAULT_CACHE_TTL): void {
  const envelope: CacheEnvelope<T> = {
    __cache: true,
    data,
    expireAt: Date.now() + ttl,
  }
  uni.setStorageSync(key, envelope)
}

/**
 * 读取缓存
 * @returns 命中且未过期时返回数据，否则返回 null（过期/结构不符的项会被清除）
 */
export function getCache<T>(key: string): T | null {
  try {
    const raw = uni.getStorageSync(key)
    if (!raw || typeof raw !== 'object')
      return null

    const envelope = raw as Partial<CacheEnvelope<T>>
    // 结构不符 = 旧版裸数据，视为过期，强制回源以免用到脏数据
    if (envelope.__cache !== true || typeof envelope.expireAt !== 'number') {
      uni.removeStorageSync(key)
      return null
    }

    if (Date.now() > envelope.expireAt) {
      uni.removeStorageSync(key)
      return null
    }

    return envelope.data as T
  }
  catch {
    return null
  }
}

/** 主动失效某个缓存（数据源变更后调用） */
export function removeCache(key: string): void {
  uni.removeStorageSync(key)
}
