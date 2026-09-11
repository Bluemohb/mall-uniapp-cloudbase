/**
 * ============================================================
 * 🧪 Mock 数据层（商品查询 + Mock 开关中心）
 * ============================================================
 * 用途：
 * - 开关打开时使用本地 mock/products_02.json 的商品数据，不依赖云端，
 *   方便在没有配置好 CloudBase / 网络受限时开发调试页面。
 * - 开关关闭时全部走 CloudBase 云数据库，保证线上数据真实。
 *
 * 【两个开关（在 .env 里配置，详见 README「Mock 数据开关」）】
 *   VITE_USE_MOCK    全局开关：商品列表 / 首页推荐 / 搜索 / 商品详情
 *   VITE_ORDER_MOCK  订单专用开关：订单列表 / 订单详情 / 下单
 *   取值 'true' / 'false'；「订单」未配置时继承全局开关。
 *
 * 【为什么要把开关拆出来】
 *   原先写死 NODE_ENV，导致开发环境只能整体走 mock：想用控制台里的
 *   真实 orders 数据调试下单链路时，页面永远读本地 mock_orders，
 *   看不到云端数据。拆出开关后可以组合出「商品走 mock、订单走云端」。
 *
 * 【默认语义（两个变量都不配置时）】
 *   - dev（pnpm dev:*）     → 开启，读本地 mock
 *   - build（pnpm build:*） → 关闭，走云端，且死代码被摇树移除
 * ============================================================
 */
import products from '../../mock/products_02.json'

/**
 * 全局 Mock 开关
 *
 * 优先级：VITE_USE_MOCK 显式配置 > 非生产构建默认启用。
 *
 * 这里读 process.env 是刻意为之：uni-app / Vite 会在构建期把它静态替换成
 * 'development' | 'production' 字面量（不会真的依赖 Node 的 process 模块）；
 * import.meta.env.VITE_USE_MOCK 同样会在构建期被替换成字符串字面量。
 * 两者都是编译期常量，下面的表达式因此会在构建期被折叠成 true / false，
 * if (USE_MOCK) 分支在编译期就有确定结果。
 *
 * ⚠️ 另外要注意两点：
 * 1. 这两个变量必须在 .env.development / .env.production 里「显式声明」。
 *    未声明的 VITE_ 变量在构建期拿不到值，开关会退化成运行时读取，
 *    连常量折叠都会失效。
 * 2. mock 数据本身能否从产物中移除，取决于 rollup 的 chunk 划分：被多个
 *    页面共享时会拆出独立的 mock-*.js 公共 chunk，其中的 JSON 会保留在包里
 *    （不影响运行——开关为 false 时永远不会被读取）。
 */
const ENV_USE_MOCK = import.meta.env.VITE_USE_MOCK

export const USE_MOCK = ENV_USE_MOCK === 'true'
  // eslint-disable-next-line node/prefer-global/process
  || (ENV_USE_MOCK === undefined && process.env.NODE_ENV !== 'production')

/**
 * 订单专用 Mock 开关
 *
 * 未配置时继承 USE_MOCK，所以默认行为与拆分前保持一致；
 * 显式配成 'false' 即可在开发环境直连云端 orders 集合，
 * 用控制台里的真实订单调试「下单 → 列表 → 详情」链路。
 */
const ENV_ORDER_MOCK = import.meta.env.VITE_ORDER_MOCK

export const USE_ORDER_MOCK = ENV_ORDER_MOCK === 'true'
  ? true
  : ENV_ORDER_MOCK === 'false'
    ? false
    : USE_MOCK

// ============================================================
// 类型定义（与 mock json 结构一致）
// ============================================================

interface SpecValue {
  label: string
  value: string
}

interface Spec {
  name: string
  values: SpecValue[]
}

export interface MockProduct {
  _id: string
  name: string
  category?: string
  description?: string
  image: string
  images?: string[]
  price: number
  originalPrice?: number
  rating?: number
  sales?: number
  stock?: number
  specs?: Spec[]
  createTime?: number
}

// ============================================================
// 数据与查询函数（模拟云数据库 semantics）
// ============================================================

/** 全量 Mock 商品（编译期打包进 dev 产物） */
const PRODUCTS = (Array.isArray(products) ? products : []) as MockProduct[]

/**
 * 模拟列表分页查询（对应 products 页）
 * 语义与云端一致：createTime 倒序 + 可选分类过滤 + skip/limit 分页
 */
export function mockQueryProducts(options: {
  category?: string
  page?: number
  pageSize?: number
} = {}) {
  const category = options.category || ''
  const page = options.page || 1
  const pageSize = options.pageSize || 10

  // 分类过滤（与 where({ category }) 语义一致：精确匹配）
  const list = category
    ? PRODUCTS.filter(p => p.category === category)
    : [...PRODUCTS]

  // 按创建时间倒序（新商品在前）
  list.sort((a, b) => (b.createTime || 0) - (a.createTime || 0))

  const start = (page - 1) * pageSize
  const data = list.slice(start, start + pageSize)
  return {
    data,
    hasMore: start + pageSize < list.length,
  }
}

/**
 * 模拟首页热卖推荐（对应 index 页）
 * 语义与云端一致：按销量 sales 倒序取前 limit 件
 */
export function mockGetRecommend(limit = 6): MockProduct[] {
  return [...PRODUCTS]
    .sort((a, b) => (b.sales || 0) - (a.sales || 0))
    .slice(0, limit)
}

/**
 * 模拟按 _id 查询单条（对应商品详情页）
 * 语义与云端一致：doc(id).get() 精确查询
 */
export function mockGetProductById(id: string): MockProduct | undefined {
  return PRODUCTS.find(p => p._id === id)
}

/**
 * 模拟关键词模糊搜索（对应搜索页）
 * 语义与云端一致：name/category/description 任意字段包含关键词（忽略大小写）
 * 命中结果按 createTime 倒序 + skip/limit 分页
 */
export function mockSearchProducts(options: {
  keyword: string
  page?: number
  pageSize?: number
}) {
  const keyword = (options.keyword || '').trim().toLowerCase()
  const page = options.page || 1
  const pageSize = options.pageSize || 10

  let list = PRODUCTS
  if (keyword) {
    list = PRODUCTS.filter(p =>
      (p.name || '').toLowerCase().includes(keyword)
      || (p.category || '').toLowerCase().includes(keyword)
      || (p.description || '').toLowerCase().includes(keyword),
    )
  }

  // 按创建时间倒序（新商品在前）
  list.sort((a, b) => (b.createTime || 0) - (a.createTime || 0))

  const start = (page - 1) * pageSize
  const data = list.slice(start, start + pageSize)
  return {
    data,
    hasMore: start + pageSize < list.length,
  }
}

// 提示当前数据源（启动时打印一次，便于确认各模块到底走的哪条路）
if (USE_MOCK) {
  console.log(`🧪 [Mock] 商品数据源：本地 mock/products_02.json（${PRODUCTS.length} 条）`)
}
else {
  console.log('☁️ [CloudBase] 商品数据源：云数据库 products 集合')
}

// 订单数据源独立于商品，可能与商品不同（例如「商品走 mock、订单走云端」）
console.log(
  USE_ORDER_MOCK
    ? '🧪 [Mock] 订单数据源：本地 storage（mock_orders）'
    : '☁️ [CloudBase] 订单数据源：云数据库 orders 集合',
)
