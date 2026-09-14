/**
 * ============================================================
 * 💳 微信支付工具（真实支付：统一下单 → 唤起收银台 → 确认结果）
 * ============================================================
 * 调用链：
 *   页面 payOrder()
 *     └─ payOrderWithWechat(orderId)
 *          ├─ 1. wx.cloud.callFunction('wxpayOrder', { action: 'create' })  ← 服务端定价 + 下单
 *          ├─ 2. wx.requestPayment(...)                                     ← 唤起微信收银台
 *          └─ 3. wx.cloud.callFunction('wxpayOrder', { action: 'query' })    ← 主动查单确认
 *
 * 【为什么必须用 wx.cloud.callFunction，而不是项目里通用的 app.callFunction】
 *   微信支付 JSAPI 下单要传付款人的 openid，而 openid 只能由**微信小程序原生调用链**
 *   在服务端注入（getWXContext().OPENID）。走 @cloudbase/js-sdk 的 HTTPS 网关时，
 *   云函数里只有 CloudBase 用户标识（uid），拿不到 openid —— 下单必失败。
 *   所以支付这一个环节单独走 wx.cloud 通道，其余业务仍走 js-sdk。
 *
 * 【为什么成功回调之后还要主动查单】
 *   wx.requestPayment 的 success 只代表「用户付了」，订单状态由服务端确认：
 *   微信的服务端回调（wxpayOrderCallback）才是权威，而回调是异步的，
 *   也可能因为「接收支付通知的云函数」没配置而迟迟不到。
 *   主动查一次，能把「回调漏了」降级成「只是慢一点」。
 *
 * 【多端说明】
 *   只有微信小程序能调起微信支付。H5 / App 端 canUseWechatPay() 返回 false，
 *   页面会自动退回原有的「模拟支付」，保证模板在多端仍可完整跑通。
 *
 * 【个人主体小程序：请在 .env 里声明 VITE_PAY_MODE=mock】
 *   客户端能探测到的只有「API 在不在」，而 wx.requestPayment / wx.cloud 在任何
 *   小程序里都存在（跟有没有商户号无关）。个人主体开不了微信支付，商户凭证永远
 *   配不上，但 canUseWechatPay() 检查的四个条件却全是 true —— 按钮会变成
 *   「立即支付」，点下去必然失败在「商户凭证未配置」。
 *   所以「我没有商户号」这件事必须在代码里显式声明，见下面的 PAY_MODE。
 * ============================================================
 */
import { ENV_ID, isMpWeixin, isValidEnvId } from './cloudbase'

/** 支付云函数名（cloudfunctions/wxpayOrder） */
const PAY_FUNCTION_NAME = 'wxpayOrder'

/**
 * 支付模式：'mock' 强制模拟支付；缺省 'auto' 能调起真实支付就调起
 *
 * 取值来自 .env.development / .env.production 的 VITE_PAY_MODE。
 * 必须是「显式声明」的构建期常量：未声明时构建期拿不到值，判断会退化成运行时行为。
 * 配成 'mock' 后 canUseWechatPay() 会被折叠成常量（实测 mp-weixin 产物里就是
 * `canUseWechatPay = function () { return !1 }`），页面永远走模拟支付。
 *
 * ⚠️ 注意：这只让「判断」变成了常量，**不会**把支付模块从产物里摇掉 ——
 *    本模块被静态 import 且有顶层副作用（下面的模式日志），所以 wxpayOrder 调用与
 *    requestPayment 封装仍会留在包里（约 1KB，实测存在）。它们永远不会被触发，
 *    只是占体积。要彻底去掉得改成动态 import 或条件编译，当前不做。
 */
const PAY_MODE = import.meta.env.VITE_PAY_MODE || 'auto'

/** 唤起支付后轮询确认结果的次数与间隔 */
const CONFIRM_ATTEMPTS = 3
const CONFIRM_INTERVAL_MS = 1000

/**
 * 小程序 requestPayment 需要的参数
 * signType 显式收窄成字面量联合，避免把服务端字符串直接塞进 uni.requestPayment
 */
export interface WechatPayParams {
  timeStamp: string
  nonceStr: string
  package: string
  signType: 'RSA' | 'MD5' | 'HMAC-SHA256'
  paySign: string
}

/** 支付结果（本模块所有失败都通过返回值表达，不抛异常，便于页面统一处理） */
export interface WechatPayResult {
  /** 服务端是否已确认「已支付」 */
  paid: boolean
  /** 用户主动取消支付 */
  cancelled?: boolean
  /** 微信侧交易状态，如 SUCCESS / NOTPAY / CLOSED */
  tradeState?: string
  /** 需要人工核对的告警（如付款成功但订单已被超时关单） */
  warning?: string
  /** 失败或提示文案 */
  message?: string
}

/** 云函数返回结构（本项目约定：函数不抛异常，统一返回 { success, code, message, ... }） */
interface PayFnResult {
  success?: boolean
  code?: string
  message?: string
  paid?: boolean
  tradeState?: string
  warning?: string
  payParams?: WechatPayParams
}

/**
 * wx.cloud 的最小类型声明
 *
 * 只声明本项目用到的两个方法，避免引入 any，也不用为一个字段装 @cloudbase/wx-cloud-client-sdk。
 */
interface WxCloudApi {
  init: (options: { env: string, traceUser?: boolean }) => void
  callFunction: (options: { name: string, data?: Record<string, unknown> }) => Promise<{ result?: unknown }>
}

/**
 * 小程序 wx.requestPayment 的最小类型声明
 *
 * 【为什么不用 uni.requestPayment】
 * @dcloudio/types 里的 RequestPaymentOptions 是按 App 端（支付宝/微信 App 支付）
 * 设计的：orderInfo 被标为**必填**，而微信小程序的 wx.requestPayment 只吃
 * timeStamp / nonceStr / package / signType / paySign —— 多塞一个 orderInfo
 * 反而可能被微信判为参数错误。
 * 支付本来就只能在微信小程序里跑，直接用原生 API 语义最准。
 */
interface WxPaymentApi {
  requestPayment: (options: {
    timeStamp: string
    nonceStr: string
    package: string
    signType: WechatPayParams['signType']
    paySign: string
    success?: () => void
    fail?: (err: { errMsg?: string }) => void
  }) => void
}

/** 取全局 wx.requestPayment（只有微信小程序端存在） */
function getWxPayment(): WxPaymentApi | null {
  try {
    const g = globalThis as unknown as { wx?: { requestPayment?: WxPaymentApi['requestPayment'] } }
    const requestPayment = g.wx?.requestPayment
    return requestPayment ? { requestPayment } : null
  }
  catch {
    return null
  }
}

/**
 * 取全局 wx.cloud（只有微信小程序端存在）
 * 与 cloudbase.ts 里 isMpWeixin() 的探测方式一致：用全局 wx 判断运行环境
 */
function getWxCloud(): WxCloudApi | null {
  try {
    const g = globalThis as unknown as { wx?: { cloud?: WxCloudApi } }
    const cloud = g.wx?.cloud
    return cloud && typeof cloud.callFunction === 'function' ? cloud : null
  }
  catch {
    return null
  }
}

/** wx.cloud.init 每个生命周期只需一次，重复调用没有意义 */
let wxCloudReady = false

function ensureWxCloudReady(cloud: WxCloudApi): void {
  if (wxCloudReady) {
    return
  }
  try {
    cloud.init({ env: ENV_ID, traceUser: true })
    wxCloudReady = true
    console.log('[支付] wx.cloud 已初始化，env =', ENV_ID)
  }
  catch (err) {
    // 初始化失败时后续 callFunction 会报错，这里只记录，错误由调用处统一暴露
    console.error('[支付] wx.cloud 初始化失败:', err)
  }
}

/**
 * 当前环境能否使用真实微信支付
 *
 * 四个前提缺一不可：支付模式不是 mock、微信小程序端、环境ID已配置、wx.cloud 通道可用。
 * 任一不满足时页面应退回模拟支付，而不是给用户一个必然失败的按钮。
 *
 * ⚠️ 这四个条件只证明「环境具备调起支付的 API」，不能证明「服务端有商户凭证」——
 *    凭证配置在云端，客户端看不到。所以个人主体小程序必须显式配 VITE_PAY_MODE=mock，
 *    否则会在支付时收到「商户凭证未配置」（错误文案由 wxpayOrder 云函数翻译）。
 */
export function canUseWechatPay(): boolean {
  if (PAY_MODE === 'mock') {
    // 显式声明「没有商户号」：直接判否，页面自动退回模拟支付
    return false
  }
  return isMpWeixin() && Boolean(isValidEnvId) && !!getWxCloud() && !!getWxPayment()
}

/** 把服务端下发的签名算法收窄成字面量联合（未知值一律按 RSA 处理） */
function normalizeSignType(value: unknown): WechatPayParams['signType'] {
  if (value === 'MD5' || value === 'HMAC-SHA256') {
    return value
  }
  return 'RSA'
}

/** 校验云函数下发的支付参数是否完整（SDK 层返回值不可信，必须逐字段确认） */
function toPayParams(raw: unknown): WechatPayParams | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const p = raw as Record<string, unknown>
  const timeStamp = String(p.timeStamp ?? '')
  const nonceStr = String(p.nonceStr ?? '')
  const pkg = String(p.package ?? '')
  const paySign = String(p.paySign ?? '')
  if (!timeStamp || !nonceStr || !pkg || !paySign) {
    return null
  }
  return { timeStamp, nonceStr, package: pkg, signType: normalizeSignType(p.signType), paySign }
}

/**
 * 调用支付云函数
 *
 * 无论是「网关拦住请求」还是「函数内部业务失败」，都统一转成可读的 message，
 * 让页面只需要看 message 就能给用户一句有意义的话。
 */
async function callPayFunction(data: Record<string, unknown>): Promise<PayFnResult> {
  const cloud = getWxCloud()
  if (!cloud) {
    return { success: false, code: 'NO_WX_CLOUD', message: '当前环境无法调起微信支付（需在微信小程序内运行）' }
  }
  ensureWxCloudReady(cloud)

  try {
    const res = await cloud.callFunction({ name: PAY_FUNCTION_NAME, data })
    const result = (res?.result ?? {}) as PayFnResult
    if (result.success) {
      return result
    }
    return {
      success: false,
      code: result.code,
      message: result.message || `支付服务返回异常（${result.code || 'UNKNOWN'}）`,
    }
  }
  catch (err) {
    const raw = err as { errMsg?: string, message?: string }
    const detail = raw?.errMsg || raw?.message || String(err)
    console.error('[支付] 调用云函数失败:', err)
    return {
      success: false,
      code: 'CALL_FUNCTION_FAILED',
      message: `调用支付服务失败：${detail}`,
    }
  }
}

/** 唤起微信收银台；把「用户取消」与「真失败」区分开，前者不该弹错误提示 */
function requestPayment(params: WechatPayParams): Promise<{ ok: boolean, cancelled: boolean, message?: string }> {
  return new Promise((resolve) => {
    const wxPayment = getWxPayment()
    if (!wxPayment) {
      resolve({ ok: false, cancelled: false, message: '当前环境不支持微信支付（需在微信小程序内运行）' })
      return
    }

    wxPayment.requestPayment({
      ...params,
      success: () => resolve({ ok: true, cancelled: false }),
      fail: (err) => {
        const errMsg = err?.errMsg || '支付未完成'
        resolve({
          ok: false,
          cancelled: /cancel/i.test(errMsg),
          message: errMsg,
        })
      },
    })
  })
}

/** 主动查单确认支付结果（回调可能延迟，这里轮询几次尽量避免「付了但状态没变」） */
async function confirmPaid(orderId: string): Promise<WechatPayResult> {
  let lastTradeState = ''

  for (let i = 0; i < CONFIRM_ATTEMPTS; i++) {
    const res = await callPayFunction({ action: 'query', orderId })
    if (res.success) {
      if (res.paid) {
        return { paid: true, tradeState: res.tradeState || 'SUCCESS', warning: res.warning }
      }
      lastTradeState = res.tradeState || ''
    }

    if (i < CONFIRM_ATTEMPTS - 1) {
      await new Promise(resolve => setTimeout(resolve, CONFIRM_INTERVAL_MS))
    }
  }

  // 走到这里说明微信侧还没确认：钱可能已经付了，只是状态没同步完
  return {
    paid: false,
    tradeState: lastTradeState,
    message: '支付结果确认中，请稍后下拉刷新订单查看',
  }
}

/**
 * 微信支付下单（含唤起收银台与结果确认）
 *
 * 页面只需两步：await 本函数 → 按返回值提示用户 + 刷新订单。
 * 本函数不抛异常，取消支付也不算失败，都通过返回值表达。
 */
export async function payOrderWithWechat(orderId: string): Promise<WechatPayResult> {
  if (!orderId) {
    return { paid: false, message: '订单信息缺失，无法支付' }
  }

  // ---- 1. 统一下单（服务端定价，返回收银台参数）----
  const created = await callPayFunction({ action: 'create', orderId })
  if (!created.success) {
    return { paid: false, message: created.message }
  }
  // 服务端发现订单已支付：直接按成功处理，避免重复付款
  if (created.paid) {
    return { paid: true, tradeState: created.tradeState || 'SUCCESS' }
  }

  const payParams = toPayParams(created.payParams)
  if (!payParams) {
    return { paid: false, message: '支付参数不完整，无法唤醒微信支付' }
  }

  // ---- 2. 唤起微信收银台 ----
  const invoked = await requestPayment(payParams)
  if (!invoked.ok) {
    return {
      paid: false,
      cancelled: invoked.cancelled,
      message: invoked.cancelled ? '已取消支付' : `支付失败：${invoked.message || '未知原因'}`,
    }
  }

  // ---- 3. 确认结果（以服务端查单为准）----
  return confirmPaid(orderId)
}

// 提示当前支付模式（启动时打印一次，便于确认按钮会是「立即支付」还是「模拟支付」）
if (PAY_MODE === 'mock') {
  console.log('💳 [支付] 模式：模拟支付（VITE_PAY_MODE=mock）—— 不会调起微信收银台')
}
else {
  console.log('💳 [支付] 模式：自动 —— 微信小程序端且商户凭证可用时调起真实微信支付')
}
