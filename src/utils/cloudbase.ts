import adapter from '@cloudbase/adapter-uni-app'
import cloudbase from '@cloudbase/js-sdk'

// 使用 UniApp 适配器
cloudbase.useAdapters(adapter, { uni })

// 云开发环境ID，使用时请替换为您的环境ID
const ENV_ID: string = import.meta.env.VITE_ENV_ID || 'your-env-id'

// 检查环境ID是否已配置
export const isValidEnvId = ENV_ID && ENV_ID !== 'your-env-id'

// 客户端 Publishable Key，可前往 https://tcb.cloud.tencent.com/dev?envId={env}#/env/apikey 获取
//
// ⚠️ 安全要求（务必在控制台落实）：
// 1. 这里只能配置「Publishable Key」（可公开、面向客户端），
//    绝对不要把 SecretId / SecretKey / Secret 密钥打进前端包 —— 前端代码对用户可见。
// 2. Publishable Key 的权限应当「最小化」：
//    - 仅授权本应用真正需要的集合（如 products / addresses / orders）与云函数；
//    - 写操作尽量收敛到云函数（见 cloudfunctions/createOrder、updateOrderStatus），
//      扣库存、改金额、改订单状态等敏感写操作不应直接给客户端。
// 3. 数据库集合仍需配置安全规则（如 orders：read 仅归属者、write 一律拒绝）。
const PUBLISHABLE_KEY = import.meta.env.VITE_PUBLISHABLE_KEY || ''

/**
 * 云开发初始化配置
 */
export interface CloudBaseInitConfig {
  /** 环境ID，默认使用 ENV_ID */
  env?: string
  /** 超时时间（毫秒），默认 15000 */
  timeout?: number
  /** 客户端 Publishable Key，默认取 VITE_PUBLISHABLE_KEY */
  accessKey?: string
}

/** 会话中的用户信息（只声明本项目实际用到的字段） */
export interface SessionUser {
  id?: string
  is_anonymous?: boolean
}

/** 会话信息（只声明本项目实际用到的字段） */
export interface SessionInfo {
  user?: SessionUser
  scope?: string
}

/** 已绑定的第三方身份 */
export interface UserIdentity {
  provider?: string
  provider_user_id?: string
  created_at?: string
  [key: string]: unknown
}

/** getUserIdentities 返回结构 */
export interface UserIdentitiesResult {
  identities: UserIdentity[]
}

/**
 * 从任意 SDK 返回值中安全提取 session（SDK 类型不完整，此处做一次收窄）
 */
function pickSession(res: unknown): SessionInfo | null {
  if (!res || typeof res !== 'object')
    return null
  const data = (res as { data?: unknown }).data
  if (!data || typeof data !== 'object')
    return null
  const session = (data as { session?: unknown }).session
  if (!session || typeof session !== 'object')
    return null
  return session as SessionInfo
}

/**
 * 从任意 SDK 返回值中安全提取 error
 * （SDK 失败时不抛异常，而是返回 { data, error }，必须显式检查）
 */
function pickError(res: unknown): unknown {
  if (res && typeof res === 'object' && 'error' in res)
    return (res as { error?: unknown }).error
  return undefined
}

/** 把 unknown 异常转成可读文案 */
function toErrorMessage(err: unknown): string {
  if (err instanceof Error)
    return err.message
  if (typeof err === 'string')
    return err
  return String(err)
}

/**
 * 初始化云开发实例
 * @param config - 初始化配置
 * @returns 云开发实例
 */
export function init(config: CloudBaseInitConfig = {}) {
  const appConfig = {
    env: config.env || ENV_ID,
    timeout: config.timeout || 15000,
    accessKey: config.accessKey || PUBLISHABLE_KEY,
    auth: { detectSessionInUrl: true },
    // 仅在App端需要配置
    appSign: 'your-app-sign',
    appSecret: {
      appAccessKeyId: 1,
      appAccessKey: 'your-app-access-key',
    },
  }

  if (!appConfig.accessKey) {
    console.warn(
      '客户端 Publishable Key 未配置：请在 .env 中设置 VITE_PUBLISHABLE_KEY。'
      + '注意只能使用 Publishable Key（可公开），切勿把 SecretKey 打入前端。',
    )
  }

  return cloudbase.init(appConfig)
}

/**
 * 默认的云开发实例
 */
export const app = init()

/**
 * 云开发认证实例
 */
export const auth = app.auth

/** 读取当前会话（返回 null 表示无有效会话） */
async function readSession(): Promise<SessionInfo | null> {
  const res: unknown = await auth.getSession()
  return pickSession(res)
}

/**
 * 检查环境配置是否有效
 */
export function checkEnvironment() {
  if (!isValidEnvId) {
    const message = '❌ 云开发环境ID未配置\n\n请按以下步骤配置：\n1. 打开 src/utils/cloudbase.ts 文件\n2. 将 ENV_ID 变量的值替换为您的云开发环境ID\n3. 保存文件并重新运行\n\n获取环境ID：https://console.cloud.tencent.com/tcb'
    console.error(message)
    return false
  }
  return true
}

/**
 * 判断当前是否微信小程序环境（运行时判断，多端通用）
 *
 * 用「全局 wx 是否存在」探测，而非 uni.getSystemInfoSync().uniPlatform：
 * wx.getSystemInfoSync 已被官方标记废弃，调用会产生弃用告警，
 * 且各新 API（getAppBaseInfo / getDeviceInfo）不再返回 uniPlatform 字段。
 */
export function isMpWeixin(): boolean {
  try {
    // 微信小程序（含开发者工具）环境才存在全局 wx；H5/App/其他小程序构建均无
    const g = globalThis as unknown as { wx?: unknown }
    return typeof g.wx !== 'undefined'
  }
  catch {
    return false
  }
}

/**
 * 执行登录（多端统一入口，主 openid + 匿名兜底）
 *
 * 【方案说明】
 * - 微信小程序：优先 OpenID 静默登录 —— uid 与微信账号绑定、永久稳定，
 *   清缓存/换设备后重新登录仍是同一用户，订单、地址不会"消失"。
 *   OpenID 登录失败（如未配置）时回退匿名登录，保证可用。
 * - 其他端（H5 / App / 其他小程序）：匿名登录兜底 —— 多端通用，
 *   后续用户可通过 linkIdentity / 绑定手机号等方式"转正"（uid 不变，数据自动继承）。
 */
// ===== 登录状态（模块级，整个小程序生命周期内共享）=====

// 并发去重：App.onLaunch 与页面 onMounted 会同时触发登录，
// 不去重会发出两组并发的 openid 请求，互相覆盖本地会话
let loginPromise: Promise<boolean> | null = null

// 本次生命周期内微信 OpenID 登录是否已成功（成功后不再重复升级）
let wxOpenIdDone = false

/**
 * 仅尝试微信 OpenID 登录：失败直接抛错，不做匿名回退
 * （用于「匿名会话升级」场景 —— 回退成新的匿名 uid 会让原数据丢失）
 *
 * useWxCloud: false 走 CloudBase 标准 HTTPS 网关（@cloudbase/js-sdk 直连，
 * 与匿名/手机号/数据库同一通道，无需 httpOverCallFunction 云函数）。
 * 依赖：小程序后台已配置 request 合法域名 https://{env}.api.tcloudbasegateway.com
 */
async function signInWithOpenIdOnly(): Promise<SessionInfo> {
  const res: unknown = await auth.signInWithOpenId({ useWxCloud: false })
  console.log('[登录] signInWithOpenId 返回:', JSON.stringify(res)?.slice(0, 500) || String(res))

  const err = pickError(res)
  if (err) {
    throw err
  }

  // 二次确认：会话真的建立（有 user.id 且不是 accessKey 匿名态）
  // （SDK 失败时不抛异常，而是返回 { data, error }，必须显式检查，否则会"假成功"）
  const session = await readSession()
  if (!session || !session.user?.id || session.scope === 'accessKey') {
    throw new Error(`openid 登录未建立有效会话（scope: ${session?.scope || 'none'}）`)
  }

  wxOpenIdDone = true
  return session
}

/**
 * 执行登录并二次确认会话已建立
 * （SDK 的 signInWithOpenId / signInAnonymously 失败时都不抛异常，
 *   而是返回 { data, error }，必须显式检查返回值，否则会"假成功"）
 */
export async function login(): Promise<void> {
  try {
    if (isMpWeixin()) {
      try {
        // 微信端：OpenID 静默登录（主登录）
        console.log('[登录] 微信端：尝试 OpenID 静默登录（CloudBase 标准网关通道）')
        const session = await signInWithOpenIdOnly()
        if (session?.user?.is_anonymous) {
          throw new Error('openid 登录后仍为匿名态')
        }
        console.log('✅ 微信 OpenID 静默登录成功（身份稳定）')
      }
      catch (e) {
        console.warn('OpenID 登录失败:', toErrorMessage(e))

        // ⚠️ 关键：已有会话（哪怕是匿名的）必须保留。
        // 直接再 signInAnonymously() 会生成新的匿名 uid，购物车 / 订单会"消失"。
        const cur = await readSession()
        if (cur?.user?.id) {
          console.log('🟡 保留现有会话（游客身份），本次 OpenID 登录未成功')
          return
        }

        // 确实连会话都没有，才做匿名兜底（身份不稳定，仅保证可用）
        const anonRes: unknown = await auth.signInAnonymously()
        // ⚠️ 匿名登录同样可能"假成功"（失败时返回 { data, error } 而非抛异常）
        const anonErr = pickError(anonRes)
        if (anonErr) {
          throw anonErr
        }
        const s2 = await readSession()
        if (!s2 || !s2.user?.id) {
          throw new Error('匿名登录兜底也未建立有效会话')
        }
        console.log('🟡 已回退为匿名登录（游客身份）')
      }
    }
    else {
      // 非微信端：匿名登录兜底（多端通用）
      const anonRes: unknown = await auth.signInAnonymously()
      const anonErr = pickError(anonRes)
      if (anonErr) {
        throw anonErr
      }
      const session = await readSession()
      if (!session?.user?.id) {
        throw new Error('匿名登录未建立有效会话')
      }
      console.log('🟢 非微信端：匿名登录成功')
    }
  }
  catch (error) {
    console.error('登录失败:', error)
    throw error
  }
}

/**
 * 确保已登录，建议在 App 启动时调用，实现"无感登录"
 *
 * 分三种情况：
 * 1. 有正式会话 → 直接返回
 * 2. 有【匿名】会话（微信端）→ 本地缓存下来的游客态不会自己"转正"，
 *    必须主动用 OpenID 登录升级，否则用户会一直停留在"匿名用户"
 *    （这正是"首次进页面是匿名用户，退出登录后重进才变正式用户"的根因：
 *     旧的判断只问"有没有会话"，不问"是不是匿名"，于是跳过了 openid 登录）
 * 3. 无会话 → 走 login()（微信 openid，失败则匿名兜底）
 */
export async function ensureLogin(): Promise<boolean> {
  // 并发去重：App.onLaunch 与页面 onMounted 同时调用时只真正执行一次
  if (!loginPromise) {
    loginPromise = doEnsureLogin().then(
      (ok) => {
        loginPromise = null
        return ok
      },
      (err) => {
        loginPromise = null
        throw err
      },
    )
  }
  return loginPromise
}

async function doEnsureLogin(): Promise<boolean> {
  try {
    const session = await readSession()
    const uid: string = session?.user?.id || ''

    if (uid) {
      const anonymous = !!session?.user?.is_anonymous || session?.scope === 'anonymous'
      console.log(`[登录] 已有本地会话 uid=${uid} scope=${session?.scope} is_anonymous=${anonymous}`)

      if (isMpWeixin() && anonymous && !wxOpenIdDone) {
        console.log('[登录] 检测到缓存的匿名会话，尝试用微信 OpenID 升级为正式身份')
        try {
          const next = await signInWithOpenIdOnly()
          const newUid: string = next?.user?.id || ''
          const same = newUid === uid
          console.log(`✅ 匿名已升级为微信正式用户（uid: ${uid} → ${newUid}）${same ? ' uid 未变，数据自动继承' : ' ⚠️ uid 已变，请确认数据是否继承'}`)
        }
        catch (e) {
          console.warn('匿名升级失败，保持游客身份:', toErrorMessage(e))
        }
      }
      return true
    }

    await login()
    return true
  }
  catch (error) {
    console.error('自动登录失败:', error)
    return false
  }
}

/**
 * 获取当前用户 ID（页面统一入口）
 *
 * 统一登录语义：内部复用 ensureLogin()，它会处理
 *  1. 已有正式会话 → 直接返回
 *  2. 微信端已有匿名会话 → 主动用 OpenID 升级（不再停留在游客态）
 *  3. 无会话 → openid / 匿名登录
 * 且自带并发去重，避免多页面同时触发重复登录。
 *
 * @throws 无法建立有效会话时抛错（避免返回空 uid 造成"静默查不到数据"）
 */
export async function getUid(): Promise<string> {
  await ensureLogin()
  const session = await readSession()
  const uid = session?.user?.id || ''
  if (!uid) {
    throw new Error('未获取到用户标识，请检查云开发登录配置')
  }
  return uid
}

/**
 * 判断当前会话是否为匿名用户（游客身份）
 */
export async function isAnonymousUser(): Promise<boolean> {
  try {
    const { data } = await auth.getSession()
    return !!data?.session?.user?.is_anonymous
  }
  catch {
    return false
  }
}

/**
 * 查询当前账号已绑定的身份源列表（如微信、手机号等）
 * @returns 身份源列表包装对象；未绑定时 identities 为空数组
 */
export async function getUserIdentities(): Promise<UserIdentitiesResult> {
  const { data, error } = await auth.getUserIdentities()
  if (error) {
    throw error
  }

  // SDK 返回值类型不完整，这里做一次显式收窄 + 运行时校验
  const raw: unknown = data
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as { identities?: unknown }
  return {
    identities: Array.isArray(parsed.identities) ? parsed.identities as UserIdentity[] : [],
  }
}

/**
 * 绑定第三方 OAuth 身份源到当前账号（匿名转正 / 追加登录方式）
 *
 * 【重要说明】
 * - 仅 Web / H5 端可用：会跳转第三方授权页（微信扫码 / Google / GitHub 等）
 * - 微信小程序端不支持 OAuth 跳转，请使用 signInWithOpenId / signInWithPhoneAuth
 * - 绑定成功后当前 uid 不变，匿名期间的数据自动归属到正式账号（零迁移）
 *
 * @param provider 身份源标识，如 'wechat' | 'google' | 'github' 等
 */
export async function linkIdentityWithProvider(provider: string) {
  // SDK 未导出完整入参类型，边界处做一次收窄断言
  const params = { provider } as unknown as Parameters<typeof auth.linkIdentity>[0]
  const { data, error } = await auth.linkIdentity(params)
  if (error) {
    throw error
  }
  return data
}

/**
 * 微信小程序手机号一键登录
 * @param phoneCode - 从 getPhoneNumber 事件中获取的动态令牌
 */
export async function signInWithPhoneAuth(phoneCode: string) {
  if (!checkEnvironment()) {
    throw new Error('环境ID未配置')
  }

  const { data, error } = await auth.signInWithPhoneAuth({
    phoneCode,
  })

  if (error) {
    throw error
  }

  return data
}

/**
 * 微信小程序 OpenID 静默登录
 * 走 CloudBase 标准 HTTPS 网关（无需 httpOverCallFunction 云函数）
 */
export async function signInWithOpenId() {
  if (!checkEnvironment()) {
    throw new Error('环境ID未配置')
  }
  // 复用统一实现：内部会二次确认会话真的建立（避免"假成功"）
  return signInWithOpenIdOnly()
}

/**
 * 密码登录
 * @param {string} username - 手机号码（格式：13800000000）/邮箱/用户名
 * @param {string} password - 密码
 * @returns {Promise} 登录状态
 */
export async function signInWithPassword(username: string, password: string) {
  // 检查环境配置
  if (!checkEnvironment()) {
    throw new Error('环境ID未配置')
  }

  try {
    let loginType = ''
    const params: Parameters<typeof auth.signInWithPassword>[0] = { password }

    // 判断输入类型并格式化
    if (/^1[3-9]\d{9}$/.test(username)) {
      // 中国大陆手机号（11位数字）
      params.phone = username
      loginType = '手机号'
    }
    else if (/^\+\d{1,3}\s\d{4,20}$/.test(username)) {
      // 已经是国际格式的手机号
      params.phone = username
      loginType = '手机号'
    }
    else if (/^[\w.%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(username)) {
      // 邮箱格式
      params.email = username
      loginType = '邮箱'
    }
    else if (/^\w{3,20}$/.test(username)) {
      // 用户名格式（3-20位字母、数字、下划线）
      params.username = username
      loginType = '用户名'
    }
    else {
      // 格式不符合任何规则，但仍然尝试登录（可能是其他格式的用户名）
      params.username = username
      loginType = '用户名'
    }

    const { data, error } = await auth.signInWithPassword(params)

    console.log(!error ? `${loginType}密码登录成功` : `${loginType}密码登录失败`)

    if (error) {
      throw error
    }

    return data
  }
  catch (error) {
    throw error
  }
}

type SignInWithOtpRes = Awaited<ReturnType<typeof auth.signInWithOtp>>
type SignInWithOtpReq = Parameters<typeof auth.signInWithOtp>[0]
/**
 * 使用一次性密码（OTP）进行登录验证，支持邮箱和手机号验证
 * @param params - 登录参数
 * @returns 验证信息
 */
export async function signInWithOtp(params: SignInWithOtpReq): Promise<SignInWithOtpRes['data']['verifyOtp'] | SignInWithOtpRes['error']> {
  // 检查环境配置
  if (!checkEnvironment()) {
    throw new Error('环境ID未配置')
  }

  try {
    const { data, error } = await auth.signInWithOtp(params)
    if (error) {
      throw error
    }
    console.log('验证码发送成功')
    return data.verifyOtp
  }
  catch (error) {
    console.error('获取验证码失败:', error)
    throw error
  }
}

/**
 * 检查用户登录态
 * @returns {Promise} 登录状态
 */
export async function checkLogin() {
  // 检查环境配置
  if (!checkEnvironment()) {
    throw new Error('环境ID未配置')
  }

  try {
    // 检查当前登录状态
    const { data } = await auth.getSession()

    if (data.session) {
      console.log('用户已登录')

      return !!data.session
    }
    else {
      throw new Error('用户未登录')
    }
  }
  catch (error) {
    console.warn(error)

    const { data } = await auth.getClaims()

    if (data.claims?.sub === 'anon') {
      console.log('将使用 Publishable Key 进行访问')
    }

    return false
  }
}

/**
 * 初始化云开发
 */
export async function initCloudBase() {
  try {
    await checkLogin()
    console.log('云开发初始化成功')
    return true
  }
  catch (error) {
    console.error('云开发初始化失败:', error)
    return false
  }
}

/**
 * 退出登录
 * @returns 无返回值；退出失败时仅打印日志，不抛异常
 */
export async function logout() {
  try {
    await auth.signOut()
    // 退出后重置标记：下次进入时重新走一次 OpenID 登录
    wxOpenIdDone = false
    return { success: true, message: '已成功退出登录' }
  }
  catch (error) {
    console.error('退出登录失败:', error)
    throw error
  }
}

// 默认导出
export default {
  init,
  app,
  checkLogin,
  login,
  logout,
  checkEnvironment,
  isValidEnvId,
  initCloudBase,
  isMpWeixin,
  ensureLogin,
  getUid,
  isAnonymousUser,
  getUserIdentities,
  linkIdentityWithProvider,
  signInWithOtp,
  signInWithPassword,
  signInWithPhoneAuth,
  signInWithOpenId,
}
