/**
 * ============================================================
 * 📦 订单工具模块 - 购物小程序第5步
 * ============================================================
 * 集中管理订单相关的"类型定义"与"纯函数"：
 *  1. 订单状态类型与展示映射（中文标签 + 主题色）
 *  2. 订单数据结构接口（OrderItem / OrderAddress / Order）
 *  3. 订单号生成器
 *
 * 【学习要点】
 *  - 类型定义：把接口写在独立模块里，页面之间可以复用
 *  - TS 联合类型：type OrderStatus = 'pending' | 'paid' | ...
 *  - Record<K, V>：以联合类型为 key，构造"状态 → 展示信息"映射表
 *  - 云端写操作（创建订单 / 改状态）统一走云函数，服务端做校验
 * ============================================================
 */
import { THEME } from '@/theme'
import { app } from '@/utils/cloudbase'
import { toCents } from '@/utils/money'

/**
 * 订单状态流转图：
 *
 *   pending(待支付) ──支付──▶ paid(已支付) ──发货──▶ shipped(已发货) ──收货──▶ completed(已完成)
 *        │
 *        └──────── 取消 ─────────▶ cancelled(已取消)
 */
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled'

/**
 * 订单状态展示映射
 * label: 界面显示的中文名
 * color: 状态标签颜色（配合界面主题）
 */
export const ORDER_STATUS_MAP: Record<OrderStatus, { label: string, color: string }> = {
  pending: { label: '待支付', color: THEME.price },
  paid: { label: '已支付', color: THEME.primary },
  shipped: { label: '已发货', color: THEME.success },
  completed: { label: '已完成', color: THEME.textMuted },
  cancelled: { label: '已取消', color: THEME.textDisabled },
}

/**
 * 支付渠道
 *   wxpay：真实微信支付（由云函数 wxpayOrder / wxpayOrderCallback 写入）
 *   mock ：模拟支付（个人主体小程序 / H5 / App；由 updateOrderStatus 云函数
 *          或本地 mock 层写入），见 src/pages/order/order-actions.ts
 */
export type OrderPayChannel = 'wxpay' | 'mock'

/** 支付渠道展示名 */
export const ORDER_PAY_CHANNEL_MAP: Record<OrderPayChannel, string> = {
  wxpay: '微信支付',
  mock: '模拟支付',
}

/** 取支付渠道展示名（历史订单没有该字段时统一显示「未支付」） */
export function payChannelLabel(channel?: string): string {
  return ORDER_PAY_CHANNEL_MAP[channel as OrderPayChannel] || '未支付'
}

/**
 * 支付流水（order.payment）
 *
 * 两条支付路径写入的结构刻意保持同构，只有 channel 与 confirmedBy 不同，
 * 这样订单详情页可以用同一段模板展示「真付」与「模拟」两种订单，不必分叉渲染。
 */
export interface OrderPayment {
  /** 商户订单号：真实支付下单时由服务端决定，模拟支付复用业务订单号 */
  outTradeNo?: string
  /** 支付渠道 */
  channel?: OrderPayChannel
  /** 微信支付单号；模拟支付是一个 MOCK 开头的本地编号 */
  transactionId?: string
  /** 预支付创建时间（真实支付发起下单时写入，此时尚未付款） */
  prepayAt?: number
  /** 实付金额（分） */
  paidCents?: number
  /** 微信侧支付完成时间（模拟支付不写） */
  successTime?: string
  /** 谁把订单标记为已支付：query / callback / updateOrderStatus / mock-pay */
  confirmedBy?: string
  /** 标记时间 */
  confirmedAt?: number
}

/**
 * 订单中的单个商品
 *
 * 【为什么叫"快照"？】
 * 下单时把商品名称、价格、图片复制一份存入订单。
 * 之后即使商品在商城下架、改价，历史订单展示的仍是
 * 下单那一刻的信息，不会变。这是订单系统的常见做法。
 */
export interface OrderItem {
  productId: string
  name: string
  image: string
  price: number
  specs: string   // 规格文本，如 "黑色 / XL"，无规格则空串
  quantity: number
  /**
   * 下单时从商品 stock 扣掉的件数（服务端写入的订单快照字段）
   * - > 0：已扣减，取消订单时按该值回补
   * - 0：商品未设置 stock（视为不限库存），只累加过销量
   * - 缺省：本功能上线前创建的订单，未参与库存/销量核算，取消时不回补
   *
   * 客户端只读，不要手工构造该字段（服务端会在 createOrder 里按实际扣减写入）
   */
  stockReservedQty?: number
}

/**
 * 收货地址快照
 * 下单时复制地址，避免用户之后修改地址影响历史订单
 */
export interface OrderAddress {
  name: string
  phone: string
  fullAddress: string
}

/**
 * 订单数据结构（对应云数据库 orders 集合的一条记录）
 */
export interface Order {
  _id?: string          // 数据库自动生成的文档ID
  orderNo: string       // 业务订单号（用于给用户展示/客服查询）
  userId: string        // 下单用户ID（数据隔离用）
  items: OrderItem[]    // 商品快照列表
  address: OrderAddress // 地址快照
  totalPrice: number    // 应付总金额（元）
  totalPriceCents?: number // 应付总金额（分，服务端下发，金额展示以此为准）
  status: OrderStatus   // 订单状态
  remark?: string       // 用户备注（选填）
  createdAt: number     // 下单时间（时间戳）
  updatedAt: number     // 最近更新时间（时间戳）
  paidAt?: number       // 支付时间（时间戳，支付后写入）
  payment?: OrderPayment // 支付流水（支付成功后写入，见 OrderPayment 注释）
}

/**
 * 生成订单号：yyyyMMddHHmmss + 4位随机数
 * 例：20260823103015 + 4821 → 202608231030154821
 *
 * 【知识点】String.padStart(n, '0') 补零
 */
export function generateOrderNo(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const random = Math.floor(Math.random() * 9000 + 1000)
  return `${dateStr}${random}`
}

/**
 * 取订单应付金额（分）
 * 优先用服务端下发的 totalPriceCents；历史订单没有该字段时由 totalPrice 兜底换算。
 */
export function orderAmountCents(order: Pick<Order, 'totalPriceCents' | 'totalPrice'>): number {
  return typeof order.totalPriceCents === 'number'
    ? order.totalPriceCents
    : toCents(order.totalPrice)
}

/** 创建订单的请求体（客户端只提供商品ID/数量/规格，价格由服务端确定） */
export interface CreateOrderPayload {
  items: Array<{ productId: string, quantity: number, specs: string }>
  address: OrderAddress
  remark?: string
}

/** 云函数统一返回结构 */
interface CloudFnResult {
  success: boolean
  message?: string
  code?: string
  orderId?: string
}

/**
 * 云函数调用的两种返回形态
 *  1) 函数正常执行：{ result: { success, message, code } }
 *  2) 请求被网关/安全规则拦下（函数根本没执行）：{ code, message }
 *     例如函数安全规则不放行匿名调用时会返回 code = 'EXCEED_AUTHORITY'
 *     （H5 / App 端是匿名登录身份，最容易被这条规则拦住）
 */
interface CallFunctionResponse {
  result?: CloudFnResult
  code?: string
  message?: string
  error?: { code?: string, message?: string }
}

/**
 * 把云函数调用的失败转成可读错误
 *
 * 为什么要区分「网关拦截」与「业务失败」？
 * 前者说明请求压根没进函数（通常是权限/安全规则问题），
 * 若统一抛「订单创建失败」，排查时完全不知道该从哪下手。
 */
function toFnError(res: unknown, fallback: string): Error {
  const { result, code, message, error } = (res ?? {}) as CallFunctionResponse
  const gatewayCode = code || error?.code
  if (gatewayCode) {
    return new Error(`${fallback}：${message || error?.message || gatewayCode}（${gatewayCode}）`)
  }
  return new Error(result?.message || fallback)
}

/**
 * 调用云函数创建订单（服务端定价 + 校验）
 * @returns 新建订单的文档 _id
 */
export async function createOrderViaCloud(payload: CreateOrderPayload): Promise<string> {
  const res = await app.callFunction({ name: 'createOrder', data: payload })
  const result = (res?.result ?? {}) as CloudFnResult
  if (!result.success || !result.orderId) {
    throw toFnError(res, '订单创建失败')
  }
  return result.orderId
}

/**
 * 调用云函数更新订单状态（服务端校验归属 + 状态流转）
 */
export async function updateOrderStatusViaCloud(orderId: string, status: OrderStatus): Promise<void> {
  const res = await app.callFunction({
    name: 'updateOrderStatus',
    data: { orderId, status },
  })
  const result = (res?.result ?? {}) as CloudFnResult
  if (!result.success) {
    throw toFnError(res, '订单状态更新失败')
  }
}
