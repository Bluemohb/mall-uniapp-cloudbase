/**
 * ============================================================
 * 📦 订单 Mock 数据层（由 USE_ORDER_MOCK 控制）
 * ============================================================
 * 用途：
 * - 开关打开时（USE_ORDER_MOCK === true）订单落本地 storage，
 *   不依赖云端集合 / 安全规则，即可完整演示
 *   「提交订单 → 订单详情 → 我的订单」闭环与状态流转。
 * - 开关关闭时订单读写走 CloudBase orders 集合，代码会被摇树移除。
 *
 * 开关默认继承全局 Mock 开关（USE_MOCK），可用 .env 里的
 * VITE_ORDER_MOCK 单独覆盖，从而在开发环境直连云端 orders 集合
 * 调试真实数据（见 src/utils/mock.ts 与 README「Mock 数据开关」）。
 *
 * 【与云端语义对齐】
 * - mockCreateOrder      ↔ orders.add()
 * - mockGetOrderById     ↔ orders.doc(id).get()
 * - mockUpdateOrder      ↔ orders.doc(id).update()
 * - mockQueryOrders      ↔ orders.where({...}).orderBy('createdAt','desc').skip/limit
 * ============================================================
 */
import type { Order, OrderStatus } from './order'

/** 本地订单存储 key */
const MOCK_ORDERS_KEY = 'mock_orders'

/** Mock 环境下的固定用户标识（避免依赖云端登录态） */
export const MOCK_USER_ID = 'mock-user'

/** Mock 订单（带 _id） */
export type MockOrder = Order & { _id: string }

// ============================================================
// 内部读写
// ============================================================

/** 读取本地全部订单 */
function readOrders(): MockOrder[] {
  try {
    const raw = uni.getStorageSync(MOCK_ORDERS_KEY)
    return Array.isArray(raw) ? (raw as MockOrder[]) : []
  }
  catch {
    return []
  }
}

/** 覆盖写入本地订单 */
function writeOrders(list: MockOrder[]) {
  uni.setStorageSync(MOCK_ORDERS_KEY, list)
}

// ============================================================
// Mock API（与云端语义一致）
// ============================================================

/**
 * 模拟创建订单（对应 orders.add）
 * 返回带 _id 的完整订单，供跳转详情页使用
 */
export function mockCreateOrder(data: Omit<Order, '_id'>): MockOrder {
  const order: MockOrder = {
    ...data,
    _id: `mock_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
  }
  const list = readOrders()
  list.unshift(order)
  writeOrders(list)
  return order
}

/**
 * 模拟按 _id 查询单条（对应 orders.doc(id).get()）
 */
export function mockGetOrderById(id: string): MockOrder | null {
  return readOrders().find(o => o._id === id) || null
}

/**
 * 模拟更新订单字段（对应 orders.doc(id).update()）
 * 更新成功返回更新后的订单，找不到返回 null
 */
export function mockUpdateOrder(
  id: string,
  patch: Partial<Order> & { updatedAt: number },
): MockOrder | null {
  const list = readOrders()
  const index = list.findIndex(o => o._id === id)
  if (index === -1) return null
  list[index] = { ...list[index], ...patch }
  writeOrders(list)
  return list[index]
}

/**
 * 模拟分页查询订单列表（对应 orders.where().orderBy().skip().limit()）
 * 本地调试为单人环境，不做 userId 过滤，仅按状态筛选 + 时间倒序
 */
export function mockQueryOrders(options: {
  status?: '' | OrderStatus
  page?: number
  pageSize?: number
} = {}) {
  const status = options.status || ''
  const page = options.page || 1
  const pageSize = options.pageSize || 10

  let list = readOrders()
  if (status) {
    list = list.filter(o => o.status === status)
  }
  // 最新订单在前（与云端 orderBy('createdAt','desc') 一致）
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  const start = (page - 1) * pageSize
  return {
    data: list.slice(start, start + pageSize),
    hasMore: start + pageSize < list.length,
  }
}
