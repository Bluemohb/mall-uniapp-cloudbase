/**
 * ============================================================
 * ⏰ 待支付订单超时自动关单云函数（定时触发）
 * ============================================================
 * 解决什么问题？
 *   createOrder 是「下单即扣减库存」，而 pending 订单不会自己过期。
 *   没有这个兜底任务时，用户下单后不付款，那批库存就永远回不来。
 *
 * 触发方式：定时触发器（在 cloudbaserc.json 的 functions[].triggers 中配置，
 * 默认每 5 分钟一次）。
 *   定时触发器由平台直接调用云函数，不经过「客户端调用」鉴权，
 *   所以本函数不需要（也不建议）加进客户端调用的安全规则白名单里。
 *
 * 处理逻辑：
 *   1. 查出 status = 'pending' 且 createdAt < 现在 - 超时时间 的订单
 *   2. 逐条执行「条件更新」pending → cancelled
 *   3. 只有命中 1 条的那一次，才回补该订单占用的库存与销量
 *
 * 【幂等靠什么保证？】
 *   与 updateOrderStatus 完全相同的招数：把「刚校验过的旧状态」写进 where：
 *     where({ _id, status: 'pending' }).update({ status: 'cancelled' })
 *   这条更新的语义本来就是「只有它仍然是待支付，才关掉它」，于是：
 *   - 函数被重复触发（甚至两次运行在时间上重叠）时，第二次必然命中 0 条，
 *     不会把库存回补两遍；
 *   - 用户在超时边缘刚好付款成功时，也命中 0 条，不会把已付款的订单关掉。
 *
 * 【与 updateOrderStatus 的关系】
 *   「用户手动取消」与「超时自动关单」是同一条状态流转（pending → cancelled）、
 *   同一套回补规则，只是一个由用户触发、一个由定时触发。
 *   三个云函数各自独立部署（各有自己的 package.json），无法共享模块，
 *   因此回补逻辑各存一份（本文件与 createOrder / updateOrderStatus 中的实现等价）。
 *   改动其中任何一份，务必同步其余两份 —— 三处语义必须严格互逆。
 *
 * 超时时间怎么调？
 *   1) 环境变量 PAYMENT_TIMEOUT_MINUTES（在 cloudbaserc.json 里，默认 30 分钟）
 *   2) 手动测试时传参临时覆盖（见下）
 *
 * 手动验证（控制台 → 云函数 → closeExpiredOrders → 云端测试）：
 *   {}                       → 按默认 30 分钟执行，只关真正超时的订单
 *   { "dryRun": true }       → 只报告「会关掉哪些订单」，不写任何数据（先跑这个）
 *   { "timeoutMinutes": 0 }  → 把所有待支付订单都视为已超时（会真关单，慎用）
 * ============================================================
 */
// 显式 require 而非直接用全局 process：仓库的 ESLint 规则
// （node/prefer-global/process）禁止直接使用全局变量
const process = require('node:process')
const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({
  env: tcb.SYMBOL_CURRENT_ENV,
})

const db = app.database()
const _ = db.command

/** 默认支付超时时长（分钟）：下单后超过这么久仍未支付就自动关单 */
const DEFAULT_TIMEOUT_MINUTES = 30

/** 每次查询拉取的订单条数 */
const BATCH_SIZE = 50

/** 单次执行最多处理多少条订单（防止函数时间不够用） */
const MAX_ORDERS_PER_RUN = 200

/** 单次执行的时间预算（毫秒）：留足余量，避免撞上函数超时被强杀在回补中途 */
const TIME_BUDGET_MS = 40 * 1000

/** dryRun 时最多回报几个订单号（避免返回值过大） */
const DRY_RUN_SAMPLE_LIMIT = 20

/** errors 数组最多保留多少条（返回值要能看得下） */
const ERROR_LIMIT = 20

/**
 * 把「可能来自环境变量或调用参数的分钟数」安全转成非负数字；非法值返回 null
 * 注意不能用 Number(value) 直接判断：Number('') === 0，
 * 一旦有人传了空字符串，就会得到「超时 0 分钟」这种把所有订单都关掉的灾难性结果。
 */
function toMinutes(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed
    }
  }
  return null
}

/**
 * 解析本次执行的参数
 * 定时触发器传入的事件形如 { Type: 'Timer', TriggerName: ..., Time: ... }，
 * 不会有 timeoutMinutes / dryRun 字段，因此这里缺失时一律回退到默认值。
 */
function resolveOptions(event) {
  const input = event && typeof event === 'object' ? event : {}

  const timeoutMinutes = toMinutes(input.timeoutMinutes)
    ?? toMinutes(process.env.PAYMENT_TIMEOUT_MINUTES)
    ?? DEFAULT_TIMEOUT_MINUTES

  return {
    timeoutMinutes,
    dryRun: input.dryRun === true,
    // 定时触发器事件：仅用于日志，方便区分「定时跑」和「手动测试」
    triggeredByTimer: input.Type === 'Timer',
  }
}

/**
 * 取「本次条件更新命中的行数」
 *
 * SDK 的返回类型是 IUpdateResult { updated?: number }。
 * 这里不用「回读文档再比对」来判断是否关单成功：并发下回读会误判
 * （详见 createOrder/index.js 中同名函数的注释）。
 * 拿不到计数时必须抛错：结果不确定就绝不能去回补库存，否则可能重复回补。
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
 * 逐条各自 try：一条失败不阻断其余条目，返回值里带上计数便于排查。
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
      console.error('回补库存失败，需人工核对:', order._id, item && item.productId, err)
    }
  }

  return result
}

/** 记一条错误（带条数上限，避免返回值失控） */
function pushError(summary, detail) {
  if (summary.errors.length < ERROR_LIMIT) {
    summary.errors.push(detail)
  }
}

/** 把超时的待支付订单关掉，并回补它占用的库存 */
async function closeExpiredOrder(order, options, summary) {
  const now = Date.now()

  if (options.dryRun) {
    // dryRun 下不计入 skipped：skipped 的语义是「被用户抢先处理」，
    // 而这里只是"没做任何修改"，混在一起会让首次 dryRun 的人误判
    summary.wouldCloseCount++
    if (summary.wouldClose.length < DRY_RUN_SAMPLE_LIMIT) {
      summary.wouldClose.push({
        orderId: order._id,
        createdAt: order.createdAt,
        items: Array.isArray(order.items) ? order.items.length : 0,
      })
    }
    return
  }

  let updated
  try {
    const res = await db.collection('orders')
      .where({ _id: order._id, status: 'pending' })
      .update({
        status: 'cancelled',
        // 与用户手动取消区分开：便于排查"这单为什么自己关了"
        cancelReason: 'timeout',
        cancelledAt: now,
        updatedAt: now,
      })
    updated = readUpdated(res)
  }
  catch (err) {
    summary.updateFailures++
    pushError(summary, { orderId: order._id, stage: 'close', error: err.message })
    return
  }

  if (updated !== 1) {
    // 用户刚好在这一刻付款或手动取消了：这不是错误，跳过即可
    summary.skipped++
    return
  }

  summary.closed++

  const restore = await restoreOrderItems(order)
  summary.restoredItems += restore.restored
  if (restore.failed > 0) {
    summary.restoreFailures += restore.failed
    pushError(summary, { orderId: order._id, stage: 'restore', failed: restore.failed })
  }
}

/** 是否还有没处理完的超时订单（分批查询的上限已经用尽时用它做最后确认） */
async function hasMoreExpiredOrders(deadline) {
  try {
    const res = await db.collection('orders')
      .where({ status: 'pending', createdAt: _.lt(deadline) })
      .limit(1)
      .get()
    return (res.data || []).length > 0
  }
  catch (err) {
    console.error('检查剩余超时订单失败:', err)
    // 查不清就保守地认为"还有剩余"，让运营知道本轮未必跑干净
    return true
  }
}

exports.main = async (event, context) => {
  const startedAt = Date.now()
  const options = resolveOptions(event)
  const deadline = startedAt - options.timeoutMinutes * 60 * 1000

  const summary = {
    timeoutMinutes: options.timeoutMinutes,
    deadline,
    dryRun: options.dryRun,
    triggeredByTimer: options.triggeredByTimer,
    scanned: 0,
    closed: 0,
    skipped: 0,
    restoredItems: 0,
    updateFailures: 0,
    restoreFailures: 0,
    wouldCloseCount: 0,
    wouldClose: [],
    truncated: false,
    errors: [],
  }

  console.log('开始扫描超时待支付订单:', {
    timeoutMinutes: options.timeoutMinutes,
    deadline,
    dryRun: options.dryRun,
  })

  // 已见过的订单 _id：本次运行内不再重复处理，保证循环一定会收敛
  const seen = new Set()

  // 为什么用 while 分批查？
  // 关掉一批之后，同一条件自然只会查出「下一批」超时订单（已关的不再是 pending），
  // 因此不需要 skip/offset 翻页 —— 靠数据本身的变化往前推进。
  let stoppedByLimit = false

  while (true) {
    // 用 scanned 而不是「关闭数」做上限判断：dryRun 下没有任何订单会被修改，
    // 若按关闭数判断，dryRun 会一直扫下去
    if (summary.scanned >= MAX_ORDERS_PER_RUN) {
      stoppedByLimit = true
      break
    }
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      stoppedByLimit = true
      break
    }

    let batch = []
    try {
      const res = await db.collection('orders')
        .where({ status: 'pending', createdAt: _.lt(deadline) })
        .limit(BATCH_SIZE)
        .get()
      batch = res.data || []
    }
    catch (err) {
      console.error('查询超时订单失败:', err)
      summary.updateFailures++
      pushError(summary, { stage: 'query', error: err.message })
      break
    }

    const fresh = batch.filter(order => order && order._id && !seen.has(order._id))
    if (fresh.length === 0) {
      break
    }
    for (const order of fresh) {
      seen.add(order._id)
    }
    summary.scanned += fresh.length

    for (const order of fresh) {
      await closeExpiredOrder(order, options, summary)
    }
  }

  // 因「条数上限 / 时间预算」提前退出时，再确认一次是否真的还有剩余：
  // 无脑标记 truncated 会把「刚好处理完」误报成「没跑完」。
  if (stoppedByLimit) {
    summary.truncated = await hasMoreExpiredOrders(deadline)
  }

  const message = options.dryRun
    ? `[dryRun] 发现 ${summary.scanned} 条超时待支付订单，未做任何修改`
    : `扫描 ${summary.scanned} 条超时待支付订单：关闭 ${summary.closed} 条（回补 ${summary.restoredItems} 个商品），跳过 ${summary.skipped} 条`

  console.log('超时关单完成:', message, {
    updateFailures: summary.updateFailures,
    restoreFailures: summary.restoreFailures,
    truncated: summary.truncated,
    durationMs: Date.now() - startedAt,
  })

  return {
    success: summary.updateFailures === 0 && summary.restoreFailures === 0,
    message,
    ...summary,
    durationMs: Date.now() - startedAt,
    requestId: context && context.requestId,
  }
}
