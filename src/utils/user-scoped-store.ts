/**
 * ============================================================
 * 🧩 用户级存储工厂（云端单文档 + 本地镜像）
 * ============================================================
 * 购物车（cart.ts）与收藏（favorite.ts）的存储模型原本逐行同构，
 * 这里抽出共用骨架，两个模块只保留「条目结构 + 合并规则」的差异。
 *
 * 存储模型
 *   云端：<collection>，一个用户一条文档 { userId, items: T[], createdAt, updatedAt }
 *   本地：`<prefix>_<uid>` 云端镜像（同步读，UI 不等待网络）
 *         <tempKey>       临时区（未登录 / 离线时写这里，启动时合并进云端）
 *
 * 为什么读写保持同步签名？
 *   页面都是「读出来 → 改 → 写回去」的同步写法：写入先落本地镜像
 *   （UI 立即生效、离线可用），再后台推送云端。
 *
 * 启动合并：本地镜像 + 临时区 → 云端，然后清空临时区。
 *   合并规则由调用方注入，**必须幂等**（合并结果再参与合并不应继续变化）：
 *   购物车取较大数量、收藏取并集，都是这个道理。
 *
 * ⚠️ 云端读写必须带 userId 条件
 *   carts / favorites 安全规则为
 *     { read/update/delete: auth.uid != null && doc.userId == auth.uid }，
 *   CloudBase 会做「查询条件子集校验」：客户端查询必须自带能覆盖规则的条件，
 *   否则直接 403。所以只能 where({ userId }).xxx()，不能用 doc(id).xxx()。
 *
 * ⚠️ uid 取真实登录态，不能用 mock 标识；规则按 userId 而非 _openid
 *   （匿名会话 openid 为空，按 _openid 判定会让 H5 / 匿名端读写被全拒）。
 *
 * ⚠️ 只适用「一个用户一条文档 + 整份 items 覆盖写」的数据
 *   addresses 是「一个用户多条文档 + 逐条 doc(id) 增删改」，模型不同，不套用。
 * ============================================================
 */
import { app, getUid } from './cloudbase'

/**
 * 差异化配置：条目结构与合并策略
 *
 * @typeParam T 条目类型（CartItem / FavoriteItem …）
 */
export interface UserScopedStoreOptions<T> {
  /** 日志前缀，如 'cart'（日志里输出 [cart]） */
  name: string
  /** 中文名，用于日志文案，如 '购物车' */
  label: string
  /** 云端集合名，如 'carts' */
  collection: string
  /** 缓存已解析 uid 的本地 key（改了会导致重新登录态解析，一般不改） */
  uidKey: string
  /** 临时区 key（未登录 / 离线时写这里；改了会丢老用户的待合并数据） */
  tempKey: string
  /** 镜像 key 前缀：实际 key 为 `<prefix>_<uid>` */
  mirrorPrefix: string
  /** 清洗：过滤结构不合法的条目，避免脏数据把页面渲染搞崩 */
  sanitize: (raw: unknown) => T[]
  /** 「内容是否变化」的稳定签名，必须与顺序无关 */
  signature: (items: T[]) => string
  /** 合并本地与云端：必须幂等 */
  merge: (base: T[], extra: T[]) => T[]
}

/** 工厂产出的存储句柄 */
export interface UserScopedStore<T> {
  /** 确保拿到 uid 并缓存（幂等，可并发调用） */
  ensureUid: () => Promise<string>
  /** 退出登录时调用：清除缓存 uid 与待推送数据，避免串号 */
  resetUid: () => void
  /** 当前用户的本地 key（未登录时退回临时区） */
  storageKey: () => string
  /** 读取（同步，需先 ensureUid） */
  read: () => T[]
  /** 写入（同步：落本地镜像，再后台推送云端） */
  write: (list: T[]) => void
  /** 启动合并（幂等，重复调用共享同一次结果） */
  syncOnStartup: () => Promise<T[]>
}

export function createUserScopedStore<T>(options: UserScopedStoreOptions<T>): UserScopedStore<T> {
  const {
    name,
    label,
    collection,
    uidKey,
    tempKey,
    mirrorPrefix,
    sanitize,
    signature,
    merge,
  } = options

  const logTag = `[${name}]`

  let cachedUid = ''
  /** 启动合并的进行中 Promise（幂等共享，见 syncOnStartup） */
  let syncPromise: Promise<T[]> | null = null
  /** 待推送的数据（单飞 + 最新覆盖，保证并发写不会乱序） */
  let pendingPush: { uid: string, items: T[] } | null = null
  let pushing = false

  /**
   * 确保拿到 uid 并缓存（幂等，可并发调用）
   *
   * 注意：这里必须用「真实登录态」的 uid，不能用 mock 用户标识。
   * 数据存在云端按 userId 归属的集合里，规则按「登录态非空 + doc.userId == auth.uid」
   * 判定归属，用假 uid 写入会被后端判定为伪造数据而拒绝。
   */
  async function ensureUid(): Promise<string> {
    if (cachedUid)
      return cachedUid

    cachedUid = (uni.getStorageSync(uidKey) as string) || ''
    if (cachedUid)
      return cachedUid

    try {
      cachedUid = await getUid()
    }
    catch {
      cachedUid = ''
    }

    if (cachedUid)
      uni.setStorageSync(uidKey, cachedUid)

    return cachedUid
  }

  function resetUid(): void {
    cachedUid = ''
    pendingPush = null
    syncPromise = null
    uni.removeStorageSync(uidKey)
  }

  /** 云端镜像的本地 key */
  function mirrorKey(uid: string): string {
    return `${mirrorPrefix}_${uid}`
  }

  /** 当前用户的本地 key（未登录时退回临时区，保证可用） */
  function storageKey(): string {
    return cachedUid ? mirrorKey(cachedUid) : tempKey
  }

  function readStorage(key: string): T[] {
    try {
      return sanitize(uni.getStorageSync(key))
    }
    catch {
      return []
    }
  }

  function read(): T[] {
    return readStorage(storageKey())
  }

  /**
   * 写入（同步：落本地镜像，再后台推送云端）
   *
   * 内容没变化时不推送：列表页 onShow 会重新加载并回写一次，
   * 若每次加载都推云端就是无谓的写放大。
   */
  function write(list: T[]): void {
    const next = sanitize(list)
    const changed = signature(next) !== signature(read())
    uni.setStorageSync(storageKey(), next)

    if (changed && cachedUid)
      scheduleCloudPush(cachedUid, next)
  }

  /**
   * 启动时合并本地临时区到云端（幂等，重复调用共享同一次结果）
   *
   * 返回合并后的数据。任何失败都会回退成本地数据，不阻塞启动。
   */
  function syncOnStartup(): Promise<T[]> {
    if (!syncPromise) {
      syncPromise = doSync().catch((error) => {
        console.warn(`${logTag} 启动合并${label}失败，继续使用本地${label}:`, error)
        return read()
      })
    }
    return syncPromise
  }

  async function doSync(): Promise<T[]> {
    const uid = await ensureUid()
    // 未登录（离线等）：本地临时区照常可用，下次启动再合并
    if (!uid)
      return read()

    const local = merge(read(), readStorage(tempKey))
    const cloud = await fetchCloud(uid)

    // 本地没有待同步数据：以云端为准，保证多端看到的是同一份
    if (!local.length) {
      uni.setStorageSync(mirrorKey(uid), cloud)
      return cloud
    }

    const merged = merge(cloud, local)
    uni.setStorageSync(mirrorKey(uid), merged)

    if (signature(merged) !== signature(cloud))
      scheduleCloudPush(uid, merged)

    // 临时区已并入云端（即使推送失败，数据也还在本地镜像里，下次启动会再合并）
    uni.removeStorageSync(tempKey)
    return merged
  }

  // ============================================================
  // 云端读写
  // ============================================================

  /** 读取云端数据（抛错由调用方兜底） */
  async function fetchCloud(uid: string): Promise<T[]> {
    const res: unknown = await app.database().collection(collection).where({ userId: uid }).limit(1).get()
    const doc = (res as { data?: Array<{ items?: unknown }> })?.data?.[0]
    return sanitize(doc?.items)
  }

  /**
   * 写入云端（没有该用户的文档就新增）
   *
   * 返回的 updated 计数必须显式判断：0 表示「没有匹配到文档」而不是成功，
   * 仅凭「没抛异常」会把失败当成功。
   */
  async function pushToCloud(uid: string, items: T[]): Promise<void> {
    const db = app.database()
    const now = Date.now()

    const res: unknown = await db.collection(collection).where({ userId: uid }).update({
      items,
      updatedAt: now,
    })
    const updated = (res as { updated?: number })?.updated ?? 0

    if (updated === 0) {
      await db.collection(collection).add({
        userId: uid,
        items,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  function scheduleCloudPush(uid: string, items: T[]): void {
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

        // 期间可能退出登录/切换账号，避免写到别人的数据里
        if (task.uid !== cachedUid)
          continue

        try {
          await pushToCloud(task.uid, task.items)
        }
        catch (error) {
          // 推送失败不丢数据：本地镜像仍在，下次启动合并时会重新推
          console.warn(`${logTag} ${label}同步云端失败，已保留本地数据:`, error)
        }
      }
    }
    finally {
      pushing = false
    }
  }

  return { ensureUid, resetUid, storageKey, read, write, syncOnStartup }
}
