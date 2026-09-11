/**
 * ============================================================
 * 🔁 更新订单状态云函数（服务端状态机 + 归属校验）
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

/** 合法状态流转表 */
const ALLOWED_TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'completed'],
  shipped: ['completed'],
  completed: [],
  cancelled: [],
}

exports.main = async (event) => {
  const { uid } = app.auth().getUserInfo()
  if (!uid) {
    return { success: false, code: 'UNAUTHENTICATED', message: '未获取到登录态' }
  }

  const { orderId, status } = event || {}
  if (!orderId || !status) {
    return { success: false, code: 'INVALID_PARAMS', message: '缺少 orderId 或 status' }
  }

  // ---- 查询订单并校验归属 ----
  let order
  try {
    const { data } = await db.collection('orders').doc(orderId).get()
    order = data && data[0]
  }
  catch (err) {
    console.error('查询订单失败:', err)
    return { success: false, code: 'ORDER_QUERY_FAILED', message: '订单查询失败' }
  }

  if (!order) {
    return { success: false, code: 'ORDER_NOT_FOUND', message: '订单不存在' }
  }
  if (order.userId !== uid) {
    return { success: false, code: 'FORBIDDEN', message: '无权操作该订单' }
  }

  // ---- 校验状态流转 ----
  const allowed = ALLOWED_TRANSITIONS[order.status] || []
  if (!allowed.includes(status)) {
    return {
      success: false,
      code: 'INVALID_TRANSITION',
      message: `不允许从 ${order.status} 变更为 ${status}`,
    }
  }

  const now = Date.now()
  const patch = { status, updatedAt: now }
  if (status === 'paid')
    patch.paidAt = now

  try {
    await db.collection('orders').doc(orderId).update(patch)
    return { success: true, status, updatedAt: now }
  }
  catch (err) {
    console.error('更新订单状态失败:', err)
    return { success: false, code: 'UPDATE_FAILED', message: err.message || '更新失败' }
  }
}
