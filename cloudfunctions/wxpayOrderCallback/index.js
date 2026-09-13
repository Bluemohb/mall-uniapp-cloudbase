/**
 * ============================================================
 * 💳 微信支付 · 支付结果回调云函数（服务端 → 云函数）
 * ============================================================
 * ⚠️ 触发方是微信支付，不是客户端；这个函数**不能**被小程序直接调用。
 *
 * 【配置位置】
 *   云开发控制台 →「微信支付云模板」参数设置 → 接收支付通知的云函数 → scf:wxpayOrderCallback
 *   （配好之后，微信的支付结果通知会打到这个函数；配错则回调不会到达，
 *     订单只能靠前端主动查单兜底 —— 见 wxpayOrder 的 action: 'query'）
 *
 * 【为什么回调是必需的】
 *   用户付完钱就关掉小程序是常态，前端那句 success 回调经常来不及执行；
 *   而「钱已收 / 订单还是待支付」这种不一致必须由服务端兜住。
 *
 * 【幂等】
 *   微信会重复投递同一条通知（网络超时、我们返回慢等），
 *   所以这里沿用 wxpayOrder 里那套「条件更新」：把刚校验过的旧状态写进 where，
 *   让校验与修改成为一次原子操作，重复投递只有第一次会命中。
 *
 * 【返回值】
 *   成功时按模板约定原样 return event（表示「已收到，别重投」）；
 *   只有数据库读写这类**瞬时错误**才抛出，让平台判定失败、有机会重试；
 *   「订单不存在」这类业务性失败重试也不会变好，记日志 + 返回成功。
 * ============================================================
 */
const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({
  env: tcb.SYMBOL_CURRENT_ENV,
})

const db = app.database()

function readUpdated(res) {
  const n = res && (res.updated ?? (res.stats && res.stats.updated))
  if (typeof n !== 'number') {
    throw new TypeError('未获取到更新影响行数（updated 字段缺失），请检查 @cloudbase/node-sdk 版本')
  }
  return n
}

function toCents(yuan) {
  const n = Number(yuan)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** 回调字段命名同时存在驼峰与下划线两种，这里统一兼容读取 */
function readField(source, camel, snake) {
  if (!source) {
    return undefined
  }
  return source[camel] !== undefined ? source[camel] : source[snake]
}

/**
 * 按商户订单号找回本地订单
 *
 * 下单时 out_trade_no 用的就是订单自身的 orderNo（见 wxpayOrder/buildOutTradeNo），
 * 所以首选按 orderNo 命中；再用 payment.outTradeNo 兜底，
 * 这样即使「下单成功后写 payment 字段」那一步失败了也能对上。
 */
async function findOrderByOutTradeNo(outTradeNo) {
  const byOrderNo = await db.collection('orders').where({ orderNo: outTradeNo }).limit(1).get()
  if (byOrderNo.data && byOrderNo.data.length > 0) {
    return byOrderNo.data[0]
  }

  const byPayment = await db.collection('orders').where({ 'payment.outTradeNo': outTradeNo }).limit(1).get()
  if (byPayment.data && byPayment.data.length > 0) {
    return byPayment.data[0]
  }

  return null
}

/**
 * 把订单置为「已支付」（幂等）
 *
 * ⚠️ 本段与 wxpayOrder/index.js 的 markOrderPaid 语义必须严格一致：
 *    两个云函数各自独立部署、无法共享模块，改动其中一处务必同步另一处。
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
      confirmedBy: 'callback',
      confirmedAt: now,
    },
  }

  const res = await db.collection('orders')
    .where({ _id: order._id, userId: order.userId, status: 'pending' })
    .update(patch)

  if (readUpdated(res) === 1) {
    return { paid: true }
  }

  const { data } = await db.collection('orders').doc(order._id).get()
  const latest = (data && data[0]) || null
  if (latest && latest.status === 'paid') {
    return { paid: true, idempotent: true }
  }
  if (latest && latest.status === 'cancelled') {
    console.error('⚠️ 订单已取消但收到支付成功，需人工核对/退款:', order._id, info.outTradeNo, info.paidCents)
    return { paid: false, cancelled: true }
  }
  return { paid: false, conflict: true }
}

exports.main = async (event) => {
  const eventType = readField(event, 'eventType', 'event_type') || ''
  console.log('收到微信支付回调:', eventType, JSON.stringify(event).slice(0, 800))

  // 只处理「支付成功」；REFUND.SUCCESS 等其它事件这里不关心（退款流程未接入）
  if (eventType !== 'TRANSACTION.SUCCESS') {
    return event
  }

  const resource = (event && event.resource) || {}

  // 集成中心方案的回调是密文（需 APIv3 密钥 AES-GCM 解密，由 pay-common 处理）；
  // 走微信支付云模板时这里拿到的是明文。拿到密文说明回调配到了错误的函数，
  // 如实记日志而不是假装成功。
  if (resource.ciphertext) {
    console.error('回调为密文，本函数无法解密：请检查「接收支付通知的云函数」是否配置为 scf:wxpayOrderCallback')
    return event
  }

  const outTradeNo = String(readField(resource, 'outTradeNo', 'out_trade_no') || '')
  const tradeState = String(readField(resource, 'tradeState', 'trade_state') || '')
  const transactionId = String(readField(resource, 'transactionId', 'transaction_id') || '')
  const successTime = String(readField(resource, 'successTime', 'success_time') || '')

  if (!outTradeNo) {
    console.error('回调缺少 out_trade_no，无法定位订单:', JSON.stringify(resource).slice(0, 500))
    return event
  }
  if (tradeState && tradeState !== 'SUCCESS') {
    console.warn('回调订单状态非 SUCCESS，跳过:', outTradeNo, tradeState)
    return event
  }

  // 数据库异常要抛出（瞬时错误，值得让平台重试）
  const order = await findOrderByOutTradeNo(outTradeNo)
  if (!order) {
    console.error('回调找不到对应订单（out_trade_no 与 orderNo 都对不上）:', outTradeNo)
    return event
  }

  const amount = resource.amount || {}
  const paidCents = readField(amount, 'payerTotal', 'payer_total') ?? amount.total
  const amountCents = toCents(order.totalPriceCents ?? order.totalPrice)
  if (typeof paidCents === 'number' && paidCents !== amountCents) {
    // 不阻断：微信侧的 prepay 金额是我们下单时指定的，不一致只可能是本地数据被改过
    console.warn('实付金额与订单金额不一致，请人工核对:', order._id, paidCents, amountCents)
  }

  const marked = await markOrderPaid(order, {
    outTradeNo,
    paidCents: typeof paidCents === 'number' ? paidCents : amountCents,
    transactionId,
    successTime,
  })

  console.log('支付回调处理完成:', {
    orderId: order._id,
    outTradeNo,
    paid: marked.paid,
    idempotent: !!marked.idempotent,
  })

  return event
}
