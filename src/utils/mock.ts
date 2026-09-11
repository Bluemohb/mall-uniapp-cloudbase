/**
 * ============================================================
 * 🧪 Mock 商品数据层（开发环境专用）
 * ============================================================
 * 用途：
 * - 开发环境（pnpm dev:*，process.env.NODE_ENV === 'development'）
 *   直接使用本地 mock/products_02.json 的商品数据，不依赖云端，
 *   方便在没有配置好 CloudBase / 网络受限时开发调试页面。
 * - 生产构建（pnpm build:*，process.env.NODE_ENV === 'production'）
 *   自动禁用 Mock，全部走 CloudBase 云数据库，保证线上数据真实。
 *
 * 【切换原理】
 *   USE_MOCK = process.env.NODE_ENV !== 'production'
 *   vite/uni-app 会在编译时把 process.env.NODE_ENV 替换成
 *   'development' 或 'production'，于是 USE_MOCK 也被编译成固定值：
 *   - dev 构建 → USE_MOCK = true  → 列表/首页/详情读本地 JSON
 *   - build 构建 → USE_MOCK = false → 死代码被摇树移除，不打包 mock 数据
 * ============================================================
 */
import products from '../../mock/products_02.json'

/**
 * 是否启用 Mock（非生产构建启用，生产构建自动禁用）
 *
 * 这里读 process.env 是刻意为之：uni-app / Vite 会在构建期把它静态替换成
 * 'development' | 'production' 字面量（不会真的依赖 Node 的 process 模块）。
 */
// eslint-disable-next-line node/prefer-global/process
export const USE_MOCK = process.env.NODE_ENV !== 'production'

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

// 提示当前数据源（仅开发环境打印一次）
if (USE_MOCK) {
  console.log(`🧪 [Mock] 商品数据源：本地 mock/products_02.json（${PRODUCTS.length} 条）`)
}
else {
  console.log('☁️ [CloudBase] 商品数据源：云数据库 products 集合')
}
