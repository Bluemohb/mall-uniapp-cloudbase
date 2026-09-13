/**
 * ============================================================
 * 💳 微信支付 · 统一下单云函数（真实支付）
 * ============================================================
 * 客户端调用（**仅微信小程序端**，且必须走 wx.cloud 通道）：
 *
 *   wx.cloud.callFunction({
 *     name: 'wxpayOrder',
 *     data: { action: 'create', orderId },   // 下单
 *   })
 *   wx.cloud.callFunction({
 *     name: 'wxpayOrder',
 *     data: { action: 'query', orderId },    // 主动查单（支付后的兜底确认）
 *   })
 *
 * 【为什么必须放服务端】
 *   - 金额只能用服务端 orders.totalPriceCents 的权威值：若允许客户端传金额，
 *     等于把定价权交给用户。
 *   - out_trade_no（商户订单号）必须由服务端决定并落库：支付回调只回传
 *     out_trade_no，服务端当时没记下来，回款就无法对应回「本地哪一笔订单」。
 *
 * 【为什么必须走 wx.cloud 通道，而不是 app.callFunction】
 *   微信支付 JSAPI 下单要求传 payer.openid（付款人 openid，与商户号绑定的小程序
 *   appid 对应）。只有小程序原生 wx.cloud 调用链会在服务端注入微信上下文
 *   （wx-server-sdk 的 getWXContext().OPENID）；
 *   走 @cloudbase/js-sdk 的 HTTPS 网关调用时，函数里拿不到 openid —— 这跟
 *   登录态没关系（登录态里的 uid 是 CloudBase 用户标识，不是微信 openid）。
 *
 * 【与「微信支付云模板」函数 wxpayFunctions 的关系】
 *   环境里由模板生成的 wxpayFunctions 是一段**示例代码**：商品描述写死成
 *   '<商品描述>'、金额写死成 1 分、订单号随机生成，不接收任何业务参数，
 *   因此无法用来支付「某一笔真实订单」。
 *   本函数直接调用模板底层的支付模块（cloudbase_module 的 wxpay_order），
 *   由我们自己传 description / amount / out_trade_no / payer.openid。
 *
 * 【金额一致性是最后一道防线】
 *   下单金额取自订单快照（服务端写入），回调 / 查单时再比对微信回传的实付金额；
 *   两者不一致只记日志、不阻断（微信侧 prepay 由我们指定金额，
 *   出现不一致只会是本地数据被改过，属于要人工核对的情况）。
 * ============================================================
 */
const tcb = require('@cloudbase/node-sdk')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const app = tcb.init({
  env: tcb.SYMBOL_CURRENT_ENV,
})

const db = app.database()

/**
 * 微信支付模块函数名与调用的方法名
 *
 * cloudbase_module 由平台托管（不在函数列表里显示，但可被环境内函数调用），
 * 模板函数 wxpayFunctions 只是它的一层壳，见本文件头部说明。
 */
const PAY_MODULE_FUNCTION = 'cloudbase_module'
const PAY_METHOD_CREATE = 'wxpay_order'
const PAY_METHOD_QUERY = 'wxpay_query_order_by_out_trade_no'

/** 统一的失败返回 */
function fail(code, message) {
  return { success: false, code, message }
}

/**
 * 取「本次条件更新命中的行数」
 * （语义与 createOrder / updateOrderStatus 里同名函数一致：
 *   并发下不能靠回读文档判断，必须看服务端返回的命中行数）
 */
function readUpdated(res) {
  const n = res && (res.updated ?? (res.stats && res.stats.updated))
  if (typeof n !== 'number') {
    throw new TypeError('未获取到更新影响行数（updated 字段缺失），请检查 @cloudbase/node-sdk 版本')
  }
  return n
}

/** 「元」→「分」：先转整数分再相乘，避免浮点误差 */
function toCents(yuan) {
  const n = Number(yuan)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** 日志里只打印身份前缀，避免把完整用户标识写进日志 */
function mask(id) {
  const s = String(id || '')
  return s ? `${s.slice(0, 6)}***` : '(空)'
}

/**
 * 读取调用者身份
 *
 * uid   ：CloudBase 用户标识（与 orders.userId 同一体系，用于归属校验）
 * openid：微信 openid（wx.cloud 通道才拿得到，用于微信支付下单）
 *
 * 两个来源互相独立，取不到时返回空串而不抛错 —— 调用处按「都取不到」直接拒绝。
 */
function readIdentities() {
  let uid = ''
  try {
    uid = (app.auth().getUserInfo() || {}).uid || ''
  }
  catch (err) {
    console.warn('读取 CloudBase 登录态失败:', err && err.message)
  }

  let openid = ''
  try {
    const ctx = cloud.getWXContext() || {}
    openid = ctx.OPENID || ''
  }
  catch (err) {
    console.warn('读取微信上下文失败:', err && err.message)
  }

  return { uid: String(uid), openid: String(openid) }
}

/**
 * 把支付模块的报错翻译成「可执行」的中文提示
 *
 * 这里的映射来自实际踩过的坑：凭证没配好时模块只会回一个
 * "http请求失败, 错误信息: Illegal base64 character 7b"，
 * 照着原文根本看不出要做什么。
 */
function describePayError(raw) {
  const text = String(raw || '')

  if (/MISSING_CREDENTIALS|Illegal base64|DECODER routines|unsupported key|no such file/i.test(text)) {
    return '微信支付商户凭证未配置或配置有误：请在云开发控制台打开「微信支付云模板 / 微信支付」，'
      + '重新填写商户号、APIv3 密钥与 API 证书（详见 README「真实微信支付」）'
  }
  if (/openid/i.test(text) && /不合法|非法|invalid|mismatch|不匹配/i.test(text)) {
    return 'openid 与小程序 AppID 不匹配：请确认商户号已与当前小程序（appid）完成绑定'
  }
  if (/ORDERPAID|ORDER_CLOSED|订单已支付/i.test(text)) {
    return '该订单在微信侧已支付或已关闭'
  }

  return `微信支付调用失败：${text || '未知错误'}`
}

/** 从模块返回里取出错误码与可读错误信息（错误信息本身常常又是一段 JSON） */
function readPayError(result) {
  const code = result && (result.errcode ?? result.code)
  if (code === undefined || code === null || code === 0 || code === '0') {
    return null
  }

  let raw = (result && (result.errmsg || result.msg)) || code
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      raw = parsed.message || parsed.errmsg || raw
    }
    catch {
      // 解析失败就沿用原文
    }
  }
  return { code: String(code), message: describePayError(raw) }
}

/**
 * 调用微信支付模块
 * @returns 成功时返回 { ok: true, result }，失败时返回 { ok: false, code, message }
 */
async function callPayModule(method, data) {
  let res
  try {
    res = await cloud.callFunction({
      name: PAY_MODULE_FUNCTION,
      data: { name: method, data },
    })
  }
  catch (err) {
    console.error('调用微信支付模块失败:', method, err)
    return { ok: false, code: 'PAY_MODULE_UNREACHABLE', message: describePayError(err && err.message) }
  }

  const result = (res && res.result) || {}
  const payError = readPayError(result)
  if (payError) {
    return { ok: false, code: 'PAY_MODULE_ERROR', ...payError }
  }
  return { ok: true, result }
}

/** 模块成功返回里的业务数据：模板的支付参数在 result.data 里 */
function pickPayload(result) {
  if (result && result.data && typeof result.data === 'object') {
    return result.data
  }
  return result || {}
}

/**
 * 把模块返回的支付参数归一化成 wx.requestPayment / uni.requestPayment 需要的字段
 *
 * ⚠️ 模板（云调用方案）返回的是 packageVal，集成中心方案返回的是 package，
 *    两种都兼容；`package` 已经拼好 prepay_id=...，**不要自行拼接**。
 */
function toPayParams(result) {
  const payload = pickPayload(result)
  const pkg = payload.packageVal || payload.package

  if (!payload.timeStamp || !payload.nonceStr || !pkg || !payload.paySign) {
    return null
  }

  return {
    timeStamp: String(payload.timeStamp),
    nonceStr: String(payload.nonceStr),
    package: String(pkg),
    signType: String(payload.signType || 'RSA'),
    paySign: String(payload.paySign),
  }
}

/** 取实付金额（分）：微信回调 / 查单的字段命名同时存在驼峰与下划线 */
function readPaidCents(payload) {
  const amount = (payload && payload.amount) || {}
  const total = amount.payerTotal ?? amount.payer_total ?? amount.total
  return typeof total === 'number' ? total : null
}

/** 商户订单号：直接复用业务订单号（订单表里唯一，天然可反查） */
function buildOutTradeNo(order) {
  const orderNo = String(order.orderNo || '')
  // 微信要求 6~32 位、仅数字/字母/_-|*@ ；不合规时用 _id 兜底（32 位 hex）
  if (/^[\w*@|-]{6,32}$/.test(orderNo)) {
    return orderNo
  }
  return String(order._id || '')
}

/** 商品描述：微信限 127 字符 */
function buildDescription(order) {
  const items = Array.isArray(order.items) ? order.items : []
  const first = String((items[0] && items[0].name) || '商品')
  const text = items.length > 1 ? `${first} 等 ${items.length} 件商品` : first
  return text.slice(0, 127)
}

/** 订单已记录的商户订单号（首次下单后写入；缺失时按订单号推导） */
function readOutTradeNo(order) {
  const payment = order.payment || {}
  return String(payment.outTradeNo || '') || buildOutTradeNo(order)
}

/** 查订单（管理端权限，不受集合安全规则限制） */
async function readOrder(orderId) {
  const { data } = await db.collection('orders').doc(orderId).get()
  return (data && data[0]) || null
}

/**
 * 把订单置为「已支付」（幂等）
 *
 * 【幂等靠什么】
 *   把刚校验过的旧状态写进 where，让「校验」与「修改」成为一次原子操作：
 *   支付回调 / 主动查单 / 用户重复点击可能同时到达，只有第一个请求能命中
 *   （updated === 1），其余命中 0 条。
 *
 * 【命中 0 条的两种情况】
 *   1. 已经是 paid（回调与查单互相兜底，正常）→ 视为成功
 *   2. 已经是 cancelled（用户付款前后订单被超时关单 closeExpiredOrders 关掉）
 *      → 钱已经收到但订单关了，这是**要人工处理（退款）**的情况，如实回报
 *
 * ⚠️ 本段与 wxpayOrderCallback/index.js 的 markOrderPaid 语义必须严格一致，
 *    改动其中一处务必同步另一处（两个函数各自独立部署，无法共享模块）。
 */
async function markOrderPaid(order, info) {
  const now = Date.now()
  const patch = {
    status: 'paid',
    paidAt: now,
    updatedAt: now,
    payment: {
      outTradeNo: info.outTradeNo,
      channel: 'wxpay',
      transactionId: info.transactionId || '',
      paidCents: info.paidCents,
      successTime: info.successTime || '',
      confirmedBy: info.confirmedBy || 'unknown',
      confirmedAt: now,
    },
  }

  const res = await db.collection('orders')
    .where({ _id: order._id, userId: order.userId, status: 'pending' })
    .update(patch)

  if (readUpdated(res) === 1) {
    return { paid: true }
  }

  // 没有命中：回读一次区分「已支付」与「已取消」
  const latest = await readOrder(order._id)
  if (latest && latest.status === 'paid') {
    return { paid: true, idempotent: true }
  }
  if (latest && latest.status === 'cancelled') {
    console.error('⚠️ 订单已取消但收到支付成功，需人工核对/退款:', order._id, info.outTradeNo, info.paidCents)
    return { paid: false, cancelled: true, warning: 'ORDER_CANCELLED_BUT_PAID' }
  }
  return { paid: false, conflict: true }
}

/**
 * 主动查单
 *
 * 为什么前端在 requestPayment 成功后还要查一次？
 *   支付成功以微信的服务端回调为准，而回调是异步的（通常毫秒级，但可能延迟
 *   数秒；回调云函数没配置时干脆不会来）。主动查一次能让页面立刻拿到最终状态，
 *   同时把「回调漏了」这件事变成「只是慢一点」。
 */
async function queryOrder(order) {
  const outTradeNo = readOutTradeNo(order)
  const called = await callPayModule(PAY_METHOD_QUERY, { out_trade_no: outTradeNo })
  if (!called.ok) {
    return fail(called.code, called.message)
  }

  const payload = pickPayload(called.result)
  const tradeState = String(payload.tradeState || payload.trade_state || '')

  if (tradeState !== 'SUCCESS') {
    return { success: true, paid: false, tradeState, outTradeNo }
  }

  const paidCents = readPaidCents(payload)
  const amountCents = toCents(order.totalPriceCents ?? order.totalPrice)
  if (typeof paidCents === 'number' && paidCents !== amountCents) {
    console.warn('实付金额与订单金额不一致，请人工核对:', order._id, paidCents, amountCents)
  }

  const marked = await markOrderPaid(order, {
    outTradeNo,
    paidCents: typeof paidCents === 'number' ? paidCents : amountCents,
    transactionId: payload.transactionId || payload.transaction_id || '',
    successTime: payload.successTime || payload.success_time || '',
    confirmedBy: 'query',
  })

  return {
    success: true,
    paid: marked.paid,
    tradeState,
    outTradeNo,
    ...(marked.warning ? { warning: marked.warning } : {}),
  }
}

/**
 * 下单：把「本地订单」变成「微信侧的待支付订单」，并返回调起支付所需的参数
 */
async function createPayment(order, openid) {
  // 已支付：直接回报，别让用户重复付款
  if (order.status === 'paid') {
    return { success: true, paid: true, tradeState: 'SUCCESS', message: '订单已支付' }
  }
  if (order.status !== 'pending') {
    return fail('INVALID_STATUS', `当前订单状态为 ${order.status}，无法发起支付`)
  }

  const amountCents = toCents(order.totalPriceCents ?? order.totalPrice)
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return fail('INVALID_AMOUNT', '订单金额异常，无法发起支付')
  }

  // openid 是微信支付 JSAPI 的必填项，且只能由服务端从微信上下文取
  if (!openid) {
    return fail(
      'NEED_WX_OPENID',
      '未取到微信 openid：支付只能在微信小程序内调起，'
      + '且必须通过 wx.cloud.callFunction 调用本函数（HTTPS 网关通道拿不到 openid）',
    )
  }

  const outTradeNo = buildOutTradeNo(order)
  if (!outTradeNo) {
    return fail('INVALID_OUT_TRADE_NO', '订单缺少可用的商户订单号')
  }

  const called = await callPayModule(PAY_METHOD_CREATE, {
    description: buildDescription(order),
    amount: {
      total: amountCents, // 单位：分
      currency: 'CNY',
    },
    out_trade_no: outTradeNo,
    payer: { openid },
  })
  if (!called.ok) {
    return fail(called.code, called.message)
  }

  const payParams = toPayParams(called.result)
  if (!payParams) {
    console.error('微信支付返回结构与预期不符:', JSON.stringify(called.result).slice(0, 500))
    return fail('UNEXPECTED_PAY_RESULT', '微信支付返回的支付参数不完整，无法调起支付')
  }

  // 落库：把 out_trade_no 与本次预支付记进订单，便于回调 / 人工核对
  // （失败不影响支付流程本身，回调仍能用 orderNo 反查订单）
  try {
    await db.collection('orders').doc(order._id).update({
      payment: {
        outTradeNo,
        channel: 'wxpay',
        prepayAt: Date.now(),
      },
      updatedAt: Date.now(),
    })
  }
  catch (err) {
    console.warn('记录预支付信息失败（不影响支付）:', err && err.message)
  }

  return {
    success: true,
    paid: false,
    outTradeNo,
    amountCents,
    payParams,
  }
}

exports.main = async (event) => {
  const action = event && event.action === 'query' ? 'query' : 'create'
  const orderId = String((event && event.orderId) || '').trim()
  if (!orderId) {
    return fail('INVALID_PARAMS', '缺少 orderId')
  }

  // ---- 1. 身份 ----
  const identities = readIdentities()
  // uid：网关通道可拿到；openid：wx.cloud 通道可拿到。
  // 两个通道解析出的都是「当前这台设备上的这个用户」，任一能对上订单归属即放行。
  const candidates = [identities.uid, identities.openid].filter(Boolean)
  if (candidates.length === 0) {
    return fail('UNAUTHENTICATED', '未获取到调用者身份，请先登录后再支付')
  }

  // ---- 2. 订单与归属 ----
  let order
  try {
    order = await readOrder(orderId)
  }
  catch (err) {
    console.error('查询订单失败:', err)
    return fail('ORDER_QUERY_FAILED', '订单查询失败，请重试')
  }
  if (!order) {
    return fail('ORDER_NOT_FOUND', '订单不存在')
  }
  if (!candidates.includes(String(order.userId))) {
    // 两个身份都对不上：如实回绝，并把（脱敏后的）身份写进日志/返回值，
    // 真机联调时一眼就能看出是哪一侧的标识对不上
    console.warn('支付请求身份与订单归属不匹配:', {
      orderId,
      uid: mask(identities.uid),
      openid: mask(identities.openid),
      orderUserId: mask(order.userId),
    })
    return fail('FORBIDDEN', `无权支付该订单（调用者身份 ${candidates.map(mask).join(' / ')}）`)
  }

  // ---- 3. 分流 ----
  try {
    return action === 'query'
      ? await queryOrder(order)
      : await createPayment(order, identities.openid)
  }
  catch (err) {
    console.error('微信支付处理异常:', action, err)
    return fail('WXPAY_FAILED', (err && err.message) || '微信支付处理失败，请重试')
  }
}
