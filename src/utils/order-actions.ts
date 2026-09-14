/**
 * ============================================================
 * 🛒 订单操作统一入口（支付 / 取消 / 发货 / 收货 / 批量取消）
 * ============================================================
 * 【为什么要有这一层】
 *   原先「支付」「取消」在订单详情页与订单列表页各写了一遍，每个操作还要再分
 *   「Mock 订单 / 云端订单」两条路 —— 同一个分支最多存在 4 份拷贝，行为随即漂移：
 *   详情页操作失败后会重新拉订单，列表页不会；列表页支付成功后连 paidAt 都不写。
 *   收敛到这里之后，职责变成：
 *     页面   → 触发 + 展示（弹确认框、提示结果、刷新自己）
 *     本模块 → 业务分支（Mock / 云端、真付 / 模拟）、防重复提交、结果归一化
 *
 * 【两条支付路径】
 *   - 真实微信支付：canUseWechatPayForOrder() 为真时交给 utils/payment.ts
 *     （云函数下单 → 唤起收银台 → 主动查单），订单状态由服务端写入
 *   - 模拟支付：其余情况（个人主体小程序 / H5 / App / 未配商户凭证）——
 *     订单状态由 updateOrderStatus 云函数或本地 mock 层写入，并补一条 payment
 *     支付流水，结构与真实支付同构，页面因此不必为两者分叉渲染
 *
 * 【失败之后为什么要让页面回读订单】
 *   最常见的失败原因是「订单状态已经被别处改掉了」：例如待支付订单刚被定时任务
 *   closeExpiredOrders 超时关单，或用户在别的入口操作过。此时页面手里那份数据
 *   是过期的，必须重新拉一次，否则用户会对着一个假的「待支付」反复点按钮、每次失败。
 *   本模块只返回结果，回读交给调用页面（见 order-detail / order-list 的用法）。
 * ============================================================
 */
import { formatCents } from './money'
import { USE_ORDER_MOCK } from './mock'
import {
  orderAmountCents,
  updateOrderStatusViaCloud,
  type Order,
  type OrderPayment,
  type OrderStatus,
} from './order'
import { mockUpdateOrder } from './order-mock'
import { canUseWechatPay, payOrderWithWechat, type WechatPayResult } from './payment'

/**
 * 操作结果
 *   confirmed：用户是否在确认弹窗里点了「确定」
 *              （false = 用户主动放弃，页面什么都不用做，也不必回读订单）
 *   ok       ：操作是否真的成功
 */
export interface OrderActionOutcome {
  confirmed: boolean
  ok: boolean
}

/** 支付只需要订单的金额信息，避免把整个 Order 传进来却只用其中几个字段 */
export type PayableOrder = Pick<Order, 'orderNo' | 'totalPrice' | 'totalPriceCents'>

/**
 * 防重复提交锁
 *
 * 页面上的按钮没有 disabled 态，用户连点两下就会发两份请求。云端那边靠状态机
 * 兜住了（第二次会返回 INVALID_TRANSITION），但用户会白看到一个「操作失败」。
 * 详情页与列表页共用同一把锁：同一时刻只允许一个订单操作在飞。
 */
let acting = false

/** 取应付金额文本，如 "¥19.90" */
function amountTextOf(order: PayableOrder): string {
  return `¥${formatCents(orderAmountCents(order))}`
}

/** 统一的二次确认弹窗；弹窗本身失败（如已有弹窗打开）按「未确认」处理，绝不能算成功 */
function showConfirm(title: string, content: string, confirmText: string): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      content,
      confirmText,
      success: res => resolve(!!res.confirm),
      fail: () => resolve(false),
    })
  })
}

/**
 * 当前这一单能不能走真实微信支付
 *
 * 两个条件缺一不可：
 *  - USE_ORDER_MOCK 为假：Mock 模式下订单只在本地 storage，云端下单无从谈起
 *  - canUseWechatPay()：环境 + 支付模式允许（个人主体小程序请配 VITE_PAY_MODE=mock，
 *    见 utils/payment.ts，那边会直接返回 false）
 */
export function canUseWechatPayForOrder(): boolean {
  return !USE_ORDER_MOCK && canUseWechatPay()
}

/**
 * 改订单状态（Mock / 云端两条路统一在这里分流）
 *
 * 失败时负责提示用户；成功不弹提示，由各操作自己决定文案。
 */
async function changeStatus(
  orderId: string,
  status: OrderStatus,
  localPatch?: Partial<Order>,
  options: { silent?: boolean } = {},
): Promise<boolean> {
  try {
    if (USE_ORDER_MOCK) {
      // ===== Mock 模式：本地 storage 改写，语义对应云端的 updateOrderStatus =====
      const updated = mockUpdateOrder(orderId, { ...localPatch, status, updatedAt: Date.now() })
      if (!updated) {
        uni.showToast({ title: '订单不存在', icon: 'none' })
        return false
      }
      return true
    }

    // ===== 云端：走云函数，归属与状态流转由服务端校验 =====
    await updateOrderStatusViaCloud(orderId, status)
    return true
  }
  catch (error) {
    console.error(`更新订单状态失败（→ ${status}）:`, error)
    // silent：批量操作由调用方汇总后再提示一次。逐单弹 toast 会连弹 N 个，
    // 后面的还会把前面的覆盖掉，用户只看得见最后一个。
    if (!options.silent) {
      uni.showToast({
        title: error instanceof Error ? error.message : '操作失败，请重试',
        icon: 'none',
      })
    }
    return false
  }
}

/**
 * 构造模拟支付的流水
 *
 * 字段刻意与云函数 wxpayOrder 标记支付时写入的结构对齐，只有渠道与确认方不同：
 * 详情页因此可以用同一段模板展示「真付」与「模拟」两种订单。
 */
function buildMockPayment(orderNo: string, paidCents: number): OrderPayment {
  const now = Date.now()
  return {
    outTradeNo: orderNo,
    channel: 'mock',
    transactionId: `MOCK${now}`,
    paidCents,
    confirmedBy: 'mock-pay',
    confirmedAt: now,
  }
}

/** 真实微信支付：唤起收银台 → 按服务端确认结果提示用户 */
async function payWithWechat(orderId: string): Promise<boolean> {
  uni.showLoading({ title: '正在调起支付...', mask: true })

  let result: WechatPayResult | null = null
  try {
    result = await payOrderWithWechat(orderId)
  }
  catch (error) {
    // payOrderWithWechat 已把可预期失败转成返回值，这里兜住真正异常的兜底
    console.error('微信支付流程异常:', error)
  }
  finally {
    // 先关闭 loading 再弹提示：两者共用同一个交互层，顺序反了提示会被吃掉
    uni.hideLoading()
  }

  if (!result) {
    uni.showModal({ title: '支付失败', content: '支付流程出现异常，请稍后重试', showCancel: false })
    return false
  }
  if (result.paid) {
    uni.showToast({ title: '支付成功', icon: 'success' })
    return true
  }
  if (result.cancelled) {
    uni.showToast({ title: '已取消支付', icon: 'none' })
    return false
  }
  // 没拿到成功也不等于失败：钱可能已付、状态还没同步完，如实提示即可
  uni.showModal({
    title: '支付未完成',
    content: result.message || '请稍后在订单列表查看支付结果',
    showCancel: false,
  })
  return false
}

/** 模拟支付：改状态 + 补一条支付流水（流水让订单看起来和真实支付一模一样） */
async function payWithMock(orderId: string, order: PayableOrder): Promise<boolean> {
  const ok = await changeStatus(orderId, 'paid', {
    paidAt: Date.now(),
    payment: buildMockPayment(order.orderNo, orderAmountCents(order)),
  })
  if (ok) {
    uni.showToast({ title: '支付成功', icon: 'success' })
  }
  return ok
}

/**
 * 同一时刻只允许一个订单操作在飞（见 acting 注释）
 *
 * 【为什么要泛型】
 *   单笔操作返回 OrderActionOutcome（ok）、批量返回 BatchCancelOutcome（succeeded/failed），
 *   两者的"没有执行"形态字段也不同，无法在这里统一构造，所以由调用方通过 onBusy 给出。
 */
async function runExclusive<T extends { confirmed: boolean }>(
  task: () => Promise<T>,
  onBusy: () => T,
): Promise<T> {
  if (acting) {
    return onBusy()
  }
  acting = true
  try {
    return await task()
  }
  finally {
    acting = false
  }
}

// ============================================================
// 对页面暴露的操作入口
// ============================================================

/**
 * 支付一笔订单（待支付 → 已支付）
 *
 * 走真实微信支付还是模拟支付由 canUseWechatPayForOrder() 决定，
 * 页面只拿到「用户是否确认」与「是否成功」，不需要关心走的是哪条路。
 */
export function payOrderById(orderId: string, order: PayableOrder): Promise<OrderActionOutcome> {
  return runExclusive(async () => {
    const useWechat = canUseWechatPayForOrder()
    const amount = amountTextOf(order)

    // 模拟支付的文案里写明「不会真实扣款」，避免演示时被误会成真下单
    const confirmed = await showConfirm(
      useWechat ? '微信支付' : '模拟支付',
      useWechat
        ? `确认支付 ${amount} 吗？`
        : `确认支付 ${amount} 吗？\n（模拟支付：不会产生真实扣款，仅演示状态流转）`,
      '确认支付',
    )
    if (!confirmed) {
      return { confirmed: false, ok: false }
    }

    const ok = useWechat
      ? await payWithWechat(orderId)
      : await payWithMock(orderId, order)
    return { confirmed: true, ok }
  }, () => ({ confirmed: false, ok: false }))
}

/** 取消订单（待支付 → 已取消）；服务端会按订单快照回补库存与销量 */
export function cancelOrderById(orderId: string): Promise<OrderActionOutcome> {
  return runExclusive(async () => {
    const confirmed = await showConfirm('取消订单', '确定要取消该订单吗？', '确定取消')
    if (!confirmed) {
      return { confirmed: false, ok: false }
    }

    const ok = await changeStatus(orderId, 'cancelled')
    if (ok) {
      uni.showToast({ title: '已取消', icon: 'success' })
    }
    return { confirmed: true, ok }
  }, () => ({ confirmed: false, ok: false }))
}

/** 模拟发货（已支付 → 已发货）；真实项目里这是商家后台的操作 */
export function shipOrderById(orderId: string): Promise<OrderActionOutcome> {
  return runExclusive(async () => {
    const confirmed = await showConfirm('模拟发货', '确认已发货？（真实场景由商家后台操作）', '确定')
    if (!confirmed) {
      return { confirmed: false, ok: false }
    }

    const ok = await changeStatus(orderId, 'shipped')
    if (ok) {
      uni.showToast({ title: '操作成功', icon: 'success' })
    }
    return { confirmed: true, ok }
  }, () => ({ confirmed: false, ok: false }))
}

/** 确认收货（已支付 / 已发货 → 已完成） */
export function completeOrderById(orderId: string): Promise<OrderActionOutcome> {
  return runExclusive(async () => {
    const confirmed = await showConfirm('确认收货', '确认已收到商品吗？', '确定')
    if (!confirmed) {
      return { confirmed: false, ok: false }
    }

    const ok = await changeStatus(orderId, 'completed')
    if (ok) {
      uni.showToast({ title: '操作成功', icon: 'success' })
    }
    return { confirmed: true, ok }
  }, () => ({ confirmed: false, ok: false }))
}

/**
 * 批量操作的结果
 *   confirmed：用户是否在确认弹窗里点了「确定」
 *   succeeded / failed：逐单执行后的成功 / 失败笔数
 */
export interface BatchCancelOutcome {
  confirmed: boolean
  succeeded: number
  failed: number
}

/**
 * 批量取消订单
 *
 * 只负责「执行 + 计数」；哪些订单能选（只有 pending 可取消）由页面判断，
 * 结果提示也交给页面统一汇总。
 *
 * 【为什么整批只确认一次】
 *   选 20 单点一次，结果弹 20 个确认框，是最劝退的交互。
 *
 * 【为什么串行而不是 Promise.all】
 *   每单都要过云函数的状态机、取消时还要回补库存；并发既容易撞限流，
 *   也会让「回补失败」的日志互相穿插、事后无法按订单定位。
 *   批量订单数有限（用户手工勾选），串行完全够快。
 *
 * 【为什么单笔失败不中断】
 *   最常见的失败原因是「这笔已经被别处改过状态了」——定时任务超时关单、
 *   或在详情页/另一个入口点过取消。这与其余订单无关，中断只会让用户白选一遍，
 *   所以继续跑完，最后如实汇报成功/失败笔数。
 *
 * 【失败笔数不为 0 时页面该怎么做】
 *   本地这批数据已经过期（别人先改了），直接全量刷新一次即可，
 *   不要逐笔重试——重试多半还是同样的结果。
 */
export function cancelOrdersByIds(ids: string[]): Promise<BatchCancelOutcome> {
  return runExclusive(
    async () => {
      const targets = (ids || []).filter(id => !!id)
      if (targets.length === 0) {
        return { confirmed: false, succeeded: 0, failed: 0 }
      }

      const confirmed = await showConfirm(
        '批量取消订单',
        `确定取消选中的 ${targets.length} 笔订单吗？取消后不可恢复`,
        '确定取消',
      )
      if (!confirmed) {
        return { confirmed: false, succeeded: 0, failed: 0 }
      }

      let succeeded = 0
      let failed = 0
      for (const id of targets) {
        const ok = await changeStatus(id, 'cancelled', undefined, { silent: true })
        if (ok) {
          succeeded++
        }
        else {
          failed++
        }
      }
      return { confirmed: true, succeeded, failed }
    },
    () => ({ confirmed: false, succeeded: 0, failed: 0 }),
  )
}
