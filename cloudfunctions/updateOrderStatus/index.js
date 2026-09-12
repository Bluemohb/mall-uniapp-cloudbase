/**
 * ============================================================
 * 🔁 更新订单状态云函数（服务端状态机 + 归属校验 + 库存回补）
 * ============================================================
 * 为什么也要放服务端？
 * - 客户端直接 doc(id).update({status}) 既能越权改别人的订单，
 *   也能跳过状态机（如 pending 直接跳到 completed）。
 * - 服务端统一校验：订单归属 + 合法状态流转。
 *
 * 客户端调用：
 *   app.callFunction({
 *     name: 'updateOrderStatus',
 *     data: { orderId, status: 'paid' },
 *   })
 *
 * 允许的状态流转：
 *   pending   → paid | cancelled
 *   paid      → shipped | completed
 *   shipped   → completed
 *   completed → （终态）
 *   cancelled → （终态）
 *
 * 【取消订单会回补库存 + 回退销量】
 *   createOrder 在"下单"时就扣了库存，所以 pending → cancelled 必须还回去，
 *   规则与扣减严格互逆（见 restoreItem 注释）。paid → cancelled（退款）
 *   目前未开放；将来开放时同样要在这一层回补。
 *   待支付订单超时后，由定时任务 closeExpiredOrders 走同一条流转
 *   （pending → cancelled）完成回补，幂等保证方式与本函数完全一致。
 *
 * 【并发安全：状态流转本身充当"锁"】
 *   见下面「条件更新」处的注释：把校验过的旧状态写进 where，
 *   保证同一订单的回补动作只会执行一次。
 *
 * 【云函数安全规则（必须配置）】
 *   H5 / App 端用户是「匿名登录」身份，安全规则若不放行匿名调用，
 *   客户端会收到 EXCEED_AUTHORITY（函数不会执行），表现为"操作失败"。
 *   规则配置示例见 cloudfunctions/createOrder/index.js 头部注释。
 * ============================================================
 */
const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({
  env: tcb.SYMBOL_CURRENT_ENV,
})

const db = app.database()
const _ = db.command

/** 合法状态流转表 */
const ALLOWED_TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'completed'],
  shipped: ['completed'],
  completed: [],
  cancelled: [],
}

/** 统一的失败返回 */
function fail(code, message) {
  return { success: false, code, message }
}

/**
 * 取「本次条件更新命中的行数」
 *
 * SDK 的返回类型是 IUpdateResult { updated?: number }。
 * 这里不用「回读文档再比对」来判断是否更新成功：并发下回读会误判
 * （详见 createOrder/index.js 中同名函数的注释）。
 * 拿不到计数时直接抛错：结果不确定就不要往下走，更不能据此去回补库存。
 */
function readUpdated(res) {
  const n = res && (res.updated ?? (res.stats && res.stats.updated))
  if (typeof n !== 'number') {
    throw new TypeError('未获取到更新影响行数（updated 字段缺失），请检查 @cloudbase/node-sdk 版本')
  }
  return n
}

/**
 * 回补一条商品的库存 + 回退销量
 *
 * item 是订单快照条目 { productId, quantity, stockReservedQty }：
 *   stockReservedQty > 0  → 下单时扣过库存：库存加回去，销量减回去
 *   stockReservedQty === 0→ 商品原本没有 stock 字段（不限库存）：只回退销量
 *   stockReservedQty 缺省 → 本功能上线前创建的订单，当时既没扣库存也没加销量，
 *                          必须跳过；否则会凭空给商品加库存、减销量
 *
 * 【与 createOrder / closeExpiredOrders 的关系】
 * 三个云函数各自独立部署（各有自己的 package.json），无法共享模块，
 * 因此回补逻辑在 createOrder/index.js 与 closeExpiredOrders/index.js 里各存一份。
 * 改动其中任何一份，务必同步其余两份 —— 三处语义必须严格互逆，
 * 否则会慢慢把库存算错（多补一次或少补一次，事后都很难查出来）。
 *
 * @returns true = 确实回补了一条；false = 该条目无需回补
 */
async function restoreItem(item) {
  const quantity = Math.floor(Number(item && item.quantity))
  const reservedQty = item && item.stockReservedQty

  if (!item || !item.productId || !Number.isInteger(quantity) || quantity <= 0) {
    return false
  }
  if (typeof reservedQty !== 'number') {
    return false
  }

  const patch = { sales: _.inc(-quantity) }
  if (reservedQty > 0) {
    patch.stock = _.inc(reservedQty)
  }

  await db.collection('products').doc(String(item.productId)).update(patch)
  return true
}

/**
 * 回补整单的库存/销量
 * 逐条各自 try：一条失败不阻断其余条目，返回值里带上计数便于日志排查。
 */
async function restoreOrderItems(order) {
  const items = Array.isArray(order.items) ? order.items : []
  const result = { restored: 0, skipped: 0, failed: 0 }

  for (const item of items) {
    try {
      if (await restoreItem(item)) {
        result.restored++
      }
      else {
        result.skipped++
      }
    }
    catch (err) {
      result.failed++
      console.error('回补库存失败，需人工核对:', item && item.productId, err)
    }
  }

  return result
}

exports.main = async (event) => {
  const { uid } = app.auth().getUserInfo()
  if (!uid) {
    return fail('UNAUTHENTICATED', '未获取到登录态')
  }

  const { orderId, status } = event || {}
  if (!orderId || !status) {
    return fail('INVALID_PARAMS', '缺少 orderId 或 status')
  }

  // ---- 查询订单并校验归属 ----
  let order
  try {
    const { data } = await db.collection('orders').doc(orderId).get()
    order = data && data[0]
  }
  catch (err) {
    console.error('查询订单失败:', err)
    return fail('ORDER_QUERY_FAILED', '订单查询失败')
  }

  if (!order) {
    return fail('ORDER_NOT_FOUND', '订单不存在')
  }
  if (order.userId !== uid) {
    return fail('FORBIDDEN', '无权操作该订单')
  }

  // ---- 幂等：重复「取消」一个已取消的订单，视为成功 ----
  // 典型场景：待支付订单被定时任务 closeExpiredOrders 超时关掉后，
  // 用户手里那个还停留在「待支付」的页面又点了一次「取消订单」。
  // 目标状态与当前状态一致，而取消该做的回补在关单那一刻就已经做过一次，
  // 所以这里必须直接返回成功 —— 再走一遍回补会把库存补多。
  // 只对 cancelled 放行：其他状态仍走状态机校验，否则「给已取消的订单付款」
  // 会被误判成成功，那是真的错。
  if (status === 'cancelled' && order.status === 'cancelled') {
    return {
      success: true,
      status,
      idempotent: true,
      updatedAt: order.updatedAt,
      message: '订单已是取消状态',
    }
  }

  // ---- 校验状态流转 ----
  const allowed = ALLOWED_TRANSITIONS[order.status] || []
  if (!allowed.includes(status)) {
    return fail('INVALID_TRANSITION', `不允许从 ${order.status} 变更为 ${status}`)
  }

  const now = Date.now()
  const patch = { status, updatedAt: now }
  if (status === 'paid')
    patch.paidAt = now

  // ---- 条件更新：把「刚校验过的旧状态」也写进 where ----
  // 【为什么不用 doc(orderId).update()？】
  // 用户连点两次「取消订单」时，两个请求会同时读到 status = 'pending'，
  // 于是都通过上面的流转校验、都去回补库存 → 库存被回补两遍。
  // 把旧状态写进 where 后，「校验」与「修改」合成一次原子操作：
  // 只有第一个请求能命中（updated = 1），后到的命中 0 条，直接判为冲突。
  let updated
  try {
    const res = await db.collection('orders')
      .where({ _id: orderId, userId: uid, status: order.status })
      .update(patch)
    updated = readUpdated(res)
  }
  catch (err) {
    console.error('更新订单状态失败:', err)
    return fail('UPDATE_FAILED', err.message || '更新失败')
  }

  if (updated !== 1) {
    return fail('CONFLICT', '订单状态已被其他操作变更，请刷新后重试')
  }

  // ---- 取消订单：回补库存 + 回退销量 ----
  // 放在状态更新「之后」：上面那条条件更新已经保证同一订单只会走到这里一次，
  // 所以回补天然只执行一次，不需要额外的"是否已回补"标记。
  let restore = null
  if (status === 'cancelled') {
    restore = await restoreOrderItems(order)
    console.log('取消订单回补结果:', orderId, restore)
  }

  return {
    success: true,
    status,
    updatedAt: now,
    ...(restore ? { restore } : {}),
    // 状态已改成 cancelled，但个别商品回补失败：
    // 不能返回失败让用户重试（重试会撞上"cancelled 是终态"而报错），
    // 只能如实标记 + 打日志，由人工核对（正常路径不会走到这里）。
    ...(restore && restore.failed > 0 ? { warning: 'STOCK_RESTORE_FAILED' } : {}),
  }
}
