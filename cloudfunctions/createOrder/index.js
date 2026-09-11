/**
 * ============================================================
 * 🧾 创建订单云函数（服务端定价 + 校验）
 * ============================================================
 * 为什么必须放到服务端？
 * - 客户端可被篡改：改 price / totalPrice / userId 都能"伪造"订单。
 * - 服务端可信：金额由 products 集合的权威价格重新计算，
 *   归属用户取自登录态，初始状态固定为 pending。
 *
 * 客户端调用：
 *   app.callFunction({
 *     name: 'createOrder',
 *     data: {
 *       items: [{ productId, quantity, specs }],
 *       address: { name, phone, fullAddress },
 *       remark: '选填',
 *     },
 *   })
 *
 * 【orders 集合安全规则建议（在控制台配置）】
 *   读：仅订单归属者可读
 *     { "read": "doc.userId == auth.uid" }
 *   写：客户端一律不可写，只能由云函数（管理端权限）写入
 *     { "write": false }
 *   这样即使有人绕过 UI 直接调 db.collection('orders').add()，也会被拒绝。
 * ============================================================
 */
const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({
  env: tcb.SYMBOL_CURRENT_ENV,
})

const db = app.database()
const _ = db.command

/** 「元」→「分」：先转整数分再相乘，避免浮点误差 */
function toCents(yuan) {
  const n = Number(yuan)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** 生成订单号：yyyyMMddHHmmss + 4 位随机数 */
function generateOrderNo() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const random = Math.floor(Math.random() * 9000 + 1000)
  return `${dateStr}${random}`
}

/** 统一的失败返回 */
function fail(code, message) {
  return { success: false, code, message }
}

exports.main = async (event) => {
  // ---- 1. 身份校验：userId 只能来自登录态 ----
  const { uid } = app.auth().getUserInfo()
  if (!uid) {
    return fail('UNAUTHENTICATED', '未获取到登录态，请先登录')
  }

  const { items, address, remark } = event || {}

  // ---- 2. 入参校验 ----
  if (!Array.isArray(items) || items.length === 0) {
    return fail('INVALID_ITEMS', '订单商品不能为空')
  }
  if (!address || !address.name || !address.phone || !address.fullAddress) {
    return fail('INVALID_ADDRESS', '收货地址不完整')
  }

  const normalized = items.map((item) => ({
    productId: String((item && item.productId) || ''),
    quantity: Math.floor(Number(item && item.quantity)),
    specs: String((item && item.specs) || ''),
  }))

  for (const item of normalized) {
    if (!item.productId) {
      return fail('INVALID_ITEMS', '存在缺少商品ID的条目')
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return fail('INVALID_QUANTITY', '商品数量必须为正整数')
    }
  }

  // ---- 3. 服务端定价：以 products 集合价格为准 ----
  const productIds = [...new Set(normalized.map(i => i.productId))]
  let products = []
  try {
    const res = await db
      .collection('products')
      .where({ _id: _.in(productIds) })
      .limit(productIds.length)
      .get()
    products = res.data || []
  }
  catch (err) {
    console.error('查询商品失败:', err)
    return fail('PRODUCT_QUERY_FAILED', '商品信息查询失败，请重试')
  }

  const productMap = new Map(products.map(p => [p._id, p]))

  let totalCents = 0
  const snapshot = []

  for (const item of normalized) {
    const product = productMap.get(item.productId)
    if (!product) {
      return fail('PRODUCT_NOT_FOUND', `商品不存在或已下架（${item.productId}）`)
    }
    if (typeof product.stock === 'number' && product.stock < item.quantity) {
      return fail('OUT_OF_STOCK', `「${product.name}」库存不足`)
    }

    const priceCents = toCents(product.price)
    totalCents += priceCents * item.quantity

    // 商品快照：名称/图片/价格均取自服务端，客户端只提供 id 与数量
    snapshot.push({
      productId: product._id,
      name: product.name,
      image: product.image || '',
      price: priceCents / 100,
      specs: item.specs,
      quantity: item.quantity,
    })
  }

  // ---- 4. 组装并写入订单 ----
  const now = Date.now()
  const orderData = {
    orderNo: generateOrderNo(),
    userId: uid,
    items: snapshot,
    address: {
      name: String(address.name),
      phone: String(address.phone),
      fullAddress: String(address.fullAddress),
    },
    totalPrice: totalCents / 100,
    totalPriceCents: totalCents,
    status: 'pending',
    remark: String(remark || '').trim(),
    createdAt: now,
    updatedAt: now,
  }

  try {
    const res = await db.collection('orders').add(orderData)
    if (!res || !res.id) {
      return fail('ORDER_WRITE_FAILED', '订单写入失败，请重试')
    }
    return { success: true, orderId: res.id, order: { ...orderData, _id: res.id } }
  }
  catch (err) {
    console.error('写入订单失败:', err)
    return fail('ORDER_WRITE_FAILED', err.message || '订单写入失败，请重试')
  }
}
