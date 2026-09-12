/**
 * ============================================================
 * 🧾 创建订单云函数（服务端定价 + 库存扣减）
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
 * 【本函数做三件事】
 *   1. 服务端定价：只认 products 集合的权威价格，客户端只能报「商品ID + 数量 + 规格」
 *   2. 扣减库存 + 累加销量：原子条件更新，并发下不会超卖（见 reserveItem）
 *   3. 写入 orders，并把「本次占用的库存件数」记进订单快照
 *      （取消订单时 updateOrderStatus 依赖 stockReservedQty 精确回补）
 *
 * 【库存模型：下单即扣减】
 *   下单成功就扣库存，因此未支付订单会**占住**库存；
 *   对称地，取消订单时必须回补（由 updateOrderStatus 负责）。
 *   待支付订单超时后，由定时任务 closeExpiredOrders 自动关单并回补，
 *   所以「下单即扣减」不会永久占用库存（见该函数头部注释）。
 *
 * 【失败即回滚】
 *   一个订单可能有多个商品，逐条扣减时若第 N 条没库存，
 *   前 N-1 条已经扣掉的必须还回去（否则商品凭空少一批）。
 *   本函数在所有失败路径（库存不足 / 扣减异常 / 订单写库失败）都会回滚。
 *
 * 【orders 集合安全规则建议（在控制台配置）】
 *   读：仅订单归属者可读
 *     { "read": "auth.uid != null && doc.userId == auth.uid" }
 *   写：客户端一律不可写，只能由云函数（管理端权限）写入
 *     { "write": false }
 *   这样即使有人绕过 UI 直接调 db.collection('orders').add()，也会被拒绝。
 *
 *   【为什么 read 必须带 auth.uid != null？】
 *   只写 doc.userId == auth.uid 时：若 auth.uid 为 null（未登录，或用公开的
 *   Publishable Key 直接发 REST 请求，此时没有会话），而集合里恰好有一条
 *   缺 userId 的文档，则 null == null 判真 → 静默越权读到该订单，
 *   规则引擎不报错、不留日志。
 *   本函数虽然保证写入时带 userId，但安全规则应自身闭环，
 *   不依赖"上游数据永不脏"。加上该守卫不引入任何额外的查询条件要求，
 *   客户端现有的 where({ userId }) 查询无需改动。
 *
 * 【云函数安全规则（必须配置，否则 H5 / 匿名端下单会被网关拦掉）】
 *   微信小程序端用户是 OpenID 身份，通常不受影响；
 *   但 H5 / App 端用户是「匿名登录」身份，若安全规则把匿名调用拦掉，
 *   客户端只会收到 request 级错误 EXCEED_AUTHORITY（函数根本不会执行），
 *   表现为"下单失败"。控制台 → 云函数 → 安全规则 中按需放行：
 *     {
 *       "*": { "invoke": "auth != null && auth.loginType != 'ANONYMOUS'" },
 *       "createOrder": { "invoke": "auth != null" },
 *       "updateOrderStatus": { "invoke": "auth != null" }
 *     }
 *   放行后函数内部仍会校验登录态：拿不到 uid 一律返回 UNAUTHENTICATED。
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

/**
 * 取「本次条件更新命中的行数」
 *
 * SDK 的返回类型是 IUpdateResult { updated?: number }。
 *
 * 【为什么不用「回读文档再比对」判断扣减是否成功？】
 *   并发下会误判：A / B 同时读到 stock = 5，各买 3 件；
 *   A 扣减成功后库存变成 2，B 回读到的 2 恰好等于「B 自己算出来的 5 - 3 = 2」，
 *   B 会误以为扣减成功——实际上它一次都没扣成。
 *   updated 是服务端对「本次操作命中几条」的权威答复，不受并发影响。
 *
 * 拿不到计数时直接抛错：宁可让这次下单失败，也不要在结果不确定的情况下放过超卖。
 */
function readUpdated(res) {
  const n = res && (res.updated ?? (res.stats && res.stats.updated))
  if (typeof n !== 'number') {
    throw new TypeError('未获取到更新影响行数（updated 字段缺失），请检查 @cloudbase/node-sdk 版本')
  }
  return n
}

/**
 * 回补一条商品的库存 + 回退销量（把 reserveItem 做的事情精确反做回去）
 *
 * item 是订单快照条目 { productId, quantity, stockReservedQty }：
 *   stockReservedQty > 0  → 下单时扣过库存：库存加回去，销量减回去
 *   stockReservedQty === 0→ 商品原本没有 stock 字段（不限库存）：只回退销量
 *   stockReservedQty 缺省 → 本功能上线前创建的订单，当时既没扣库存也没加销量，
 *                          必须跳过；否则会凭空给商品加库存、减销量
 *
 * 【与 updateOrderStatus / closeExpiredOrders 的关系】
 * 三个云函数各自独立部署（各有自己的 package.json），无法共享模块，
 * 因此本函数在 updateOrderStatus/index.js 与 closeExpiredOrders/index.js 里
 * 各有一份等价实现。改动其中任何一份，务必同步其余两份——三处语义必须严格互逆。
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
 * 批量回补（下单中途失败时的回滚）
 * 逐条各自 try：一条回补失败不应阻断其余条目，失败只记日志留给人工核对
 * （此时订单并未落库，首要目标是让调用方拿到失败结果）。
 */
async function restoreItems(items) {
  for (const item of items) {
    try {
      await restoreItem(item)
    }
    catch (err) {
      console.error('回补库存失败，需人工核对:', item && item.productId, err)
    }
  }
}

/**
 * 扣减库存 + 累加销量，成功时返回可直接写进订单的商品快照
 *
 * 【为什么必须用「条件更新」而不是「先读后写」？】
 *   「读出 stock → if (stock >= qty) → 写回 stock - qty」中间隔着两次网络往返，
 *   两个并发订单会读到同一个旧值（如 stock = 1）、双双通过判断，
 *   结果同一件商品卖出两次（超卖）。
 *   where({ stock: _.gte(qty) }).update({ stock: _.inc(-qty) })
 *   把「判断」和「扣减」合并成服务端的一次原子操作：
 *   库存仍然充足才会命中并扣减（updated = 1），否则命中 0 条（updated = 0）。
 *
 * 【价格为什么在这儿设置？】
 *   价格取自 products 的权威值（priceCents 由调用方按服务端价格算好传入），
 *   客户端提供的 price 一律忽略。
 *
 * @returns {object|null} 商品快照条目；null 表示库存不足（未产生任何扣减）
 */
async function reserveItem(product, item, priceCents) {
  const quantity = item.quantity
  const stockLimited = typeof product.stock === 'number'

  if (!stockLimited) {
    // 商品没有 stock 字段 → 视为不限库存：不做数量判断，只累加销量
    await db.collection('products').doc(product._id).update({ sales: _.inc(quantity) })
  }
  else {
    const res = await db.collection('products')
      .where({ _id: product._id, stock: _.gte(quantity) })
      .update({
        stock: _.inc(-quantity),
        sales: _.inc(quantity),
      })

    if (readUpdated(res) !== 1) {
      return null
    }
  }

  return {
    productId: product._id,
    name: product.name,
    image: product.image || '',
    price: priceCents / 100,
    specs: item.specs,
    quantity,
    // 本次从 stock 扣掉的件数（0 = 不限库存没扣）：取消订单时按它精确回补
    stockReservedQty: stockLimited ? quantity : 0,
  }
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

  // ---- 3. 服务端定价（顺带做一次库存预检）----
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
  const priced = []

  for (const item of normalized) {
    const product = productMap.get(item.productId)
    if (!product) {
      return fail('PRODUCT_NOT_FOUND', `商品不存在或已下架（${item.productId}）`)
    }
    // 预检只是为了"快速失败"：明显不够就先别动任何库存，
    // 免得扣到一半才回滚。真正的防超卖靠下面 reserveItem 的原子条件更新。
    if (typeof product.stock === 'number' && product.stock < item.quantity) {
      return fail('OUT_OF_STOCK', `「${product.name}」库存不足`)
    }

    const priceCents = toCents(product.price)
    totalCents += priceCents * item.quantity
    priced.push({ item, product, priceCents })
  }

  // ---- 4. 逐条扣减库存 + 累加销量 ----
  // 语义：要么整单扣成功，要么一件都不扣（中途失败回滚已扣部分）。
  const orderItems = []

  try {
    for (const { item, product, priceCents } of priced) {
      const snapshot = await reserveItem(product, item, priceCents)
      if (!snapshot) {
        // 预检之后库存被并发订单抢走了：回滚本次已扣的条目
        await restoreItems(orderItems)
        return fail('OUT_OF_STOCK', `「${product.name}」库存不足`)
      }
      orderItems.push(snapshot)
    }
  }
  catch (err) {
    console.error('扣减库存失败:', err)
    await restoreItems(orderItems)
    return fail('STOCK_DEDUCT_FAILED', err.message || '库存扣减失败，请重试')
  }

  // ---- 5. 组装并写入订单 ----
  const now = Date.now()
  const orderData = {
    orderNo: generateOrderNo(),
    userId: uid,
    items: orderItems,
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
      // 订单没落库，库存必须还回去，否则商品凭空少一批
      await restoreItems(orderItems)
      return fail('ORDER_WRITE_FAILED', '订单写入失败，请重试')
    }
    return { success: true, orderId: res.id, order: { ...orderData, _id: res.id } }
  }
  catch (err) {
    console.error('写入订单失败:', err)
    await restoreItems(orderItems)
    return fail('ORDER_WRITE_FAILED', err.message || '订单写入失败，请重试')
  }
}
