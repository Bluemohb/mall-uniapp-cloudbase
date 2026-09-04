<!--
  ============================================================
  🛒 商品列表页 - 购物小程序第1步
  ============================================================
  这个页面展示了：
  1. 如何从 CloudBase 云数据库查询商品数据
  2. 如何使用 Vue 3 Composition API（ref, reactive, computed）
  3. 如何实现下拉刷新和上拉加载更多（分页）
  4. 如何实现商品卡片网格布局
  5. 如何跳转到商品详情页

  【学习要点】
  - <script setup> 是 Vue 3 推荐的写法，更简洁
  - ref() 用于定义响应式数据（基本类型）
  - reactive() 用于定义响应式对象
  - computed() 用于定义计算属性（依赖其他数据自动更新）
  - uni-app 的生命周期函数：onLoad, onShow, onReachBottom 等

  共以下几个部分：
    1. 导入依赖
    2. 定义数据类型（TypeScript 接口）
    3. 响应式数据定义
    4. 数据查询方法
    5. 页面生命周期
    6. 事件处理
-->
<script setup lang="ts">
// ============================================================
// 第1部分：导入依赖
// ============================================================

// 从我们的 cloudbase 工具模块引入默认的 app 实例
// 这个 app 在 src/utils/cloudbase.ts 中已经初始化好了
import { app } from '@/utils/cloudbase'

// 引入 Vue 3 的响应式 API
// ref: 包装基本类型为响应式数据
// reactive: 包装对象为响应式数据
// computed: 定义计算属性（自动追踪依赖）
import { ref, reactive, computed } from 'vue'

// 【重要】uni-app 页面生命周期钩子，必须从 @dcloudio/uni-app 导入
// 在 <script setup> 中使用这些钩子时，不能直接写函数名，必须显式 import
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'

// Mock 数据层：开发环境读本地 JSON，生产构建自动禁用（走云端）
import { USE_MOCK, mockQueryProducts } from '@/utils/mock'

// ============================================================
// 第2部分：定义数据类型（TypeScript 接口）
// ============================================================

/**
 * 商品数据接口
 * 定义了商品对象应该包含哪些字段
 * 这对应 CloudBase 数据库中 products 集合的文档结构
 */
interface Product {
  _id: string            // 文档ID（CloudBase 自动生成）
  name: string           // 商品名称
  price: number          // 商品价格（单位：元）
  originalPrice?: number // 原价（可选，用于显示折扣）
  image: string          // 商品主图 URL
  images?: string[]      // 商品图片列表（可选，详情页用）
  category?: string      // 商品分类（可选）
  sales?: number         // 月销量（可选）
  stock?: number         // 库存（可选）
  description?: string   // 商品描述（可选）
  rating?: number        // 评分（可选，如 4.5）
  createTime?: number    // 创建时间戳（可选）
}

// ============================================================
// 第3部分：响应式数据定义
// ============================================================

/** 商品列表数据 */
const productList = ref<Product[]>([])

/** 当前页码（用于分页加载更多） */
const currentPage = ref(1)

/** 每页加载多少条数据 */
const pageSize = 10

/** 是否正在加载数据（显示 loading 动画） */
const isLoading = ref(false)

/** 是否已加载完所有数据（显示"没有更多了"） */
const hasMore = ref(true)

/** 是否正在下拉刷新 */
const isRefreshing = ref(false)

/**
 * 当前分类过滤（空串 = 全部）
 * 与首页联动：首页把分类写入本地存储 products_category，
 * 本页 onShow 时读取，兼容 tabBar 页面不销毁、onLoad 只触发一次的特性
 */
const categoryFilter = ref('')

/**
 * 计算属性：是否显示空状态
 * 当不在加载中 且 列表为空时，显示"暂无商品"提示
 */
const showEmpty = computed(() => !isLoading.value && productList.value.length === 0)

// ============================================================
// 第4部分：数据查询方法
// ============================================================

/**
 * 从 CloudBase 数据库查询商品列表
 *
 * 【知识点】CloudBase NoSQL 数据库操作：
 * - app.database()  获取数据库实例
 * - collection('集合名')  选择集合（类似 SQL 中的表）
 * - where({})  条件过滤（类似 SQL 的 WHERE）
 * - orderBy('字段', 'asc/desc')  排序
 * - skip(n)  跳过 n 条记录（分页用）
 * - limit(n)  获取 n 条记录
 * - get()  执行查询
 *
 * 完整的链式调用示例：
 *   db.collection('products')
 *     .where({ category: '数码' })  // 筛选分类
 *     .orderBy('createTime', 'desc') // 按时间倒序
 *     .skip(0)                       // 跳过0条（第1页）
 *     .limit(10)                     // 取10条
 *     .get()                         // 执行查询
 *
 * @param isRefresh - 是否是下拉刷新（刷新时清空列表重新加载）
 */
async function fetchProducts(isRefresh = false) {
  // 防止重复加载
  if (isLoading.value) return

  // 如果已无更多数据且不是刷新操作，直接返回
  if (!hasMore.value && !isRefresh) return

  // 设置加载状态
  isLoading.value = true
  if (isRefresh) {
    // 下拉刷新时，重置页码和数据
    isRefreshing.value = true
    currentPage.value = 1
    hasMore.value = true
  }

  // ===== Mock 模式（开发环境，生产构建自动编译为 false 并摇树移除）=====
  // 语义与云端一致：分类过滤 + createTime 倒序 + skip/limit 分页
  if (USE_MOCK) {
    const result = mockQueryProducts({
      category: categoryFilter.value,
      page: currentPage.value,
      pageSize,
    })
    const data = result.data as Product[]
    if (isRefresh) {
      productList.value = data
    }
    else {
      productList.value = [...productList.value, ...data]
    }
    hasMore.value = result.hasMore
    if (result.hasMore) currentPage.value++
    isLoading.value = false
    isRefreshing.value = false
    return
  }

  try {
    // ===== 核心：CloudBase 数据库查询 =====

    // 第1步：获取数据库引用
    const db = app.database()

    // 第2步：构建查询
    // collection() 参数是集合名，这里叫 'products'
    // 如果集合不存在，CloudBase 会在首次写入时自动创建
    let query: any = db.collection('products')

    // 有分类过滤时追加 where 条件（首页分类入口联动）
    if (categoryFilter.value) {
      query = query.where({ category: categoryFilter.value })
    }

    query = query
      .orderBy('createTime', 'desc')  // 按创建时间倒序（新商品在前）
      .skip((currentPage.value - 1) * pageSize) // 跳过前面页的数据
      .limit(pageSize)                          // 限制返回条数

    // 第3步：执行查询
    // res.data 就是查询结果数组
    const res = await query.get()

    console.log('📦 查询到商品数量:', res.data.length)

    // 第4步：更新数据
    if (isRefresh) {
      // 刷新模式：直接替换整个列表
      productList.value = res.data as Product[]
    } else {
      // 加载更多模式：追加到现有列表
      productList.value = [...productList.value, ...(res.data as Product[])]
    }

    // 第5步：判断是否还有更多数据
    // 如果返回的数据少于 pageSize，说明已到最后一页
    if (res.data.length < pageSize) {
      hasMore.value = false
    } else {
      currentPage.value++ // 页码+1，下次查询下一页
    }
  } catch (error) {
    // 捕获错误
    console.error('❌ 查询商品失败:', error)

    // 给用户提示
    uni.showToast({
      title: '加载商品失败',
      icon: 'error',
    })
  } finally {
    // 无论成功还是失败，都要关闭加载状态
    isLoading.value = false
    isRefreshing.value = false
  }
}

/**
 * 下拉刷新处理
 * 【知识点】onPullDownRefresh 从 '@dcloudio/uni-app' 导入后，
 *   必须以 onPullDownRefresh(() => { ... }) 的形式注册，不能声明为普通函数
 */
onPullDownRefresh(async () => {
  await fetchProducts(true) // 传 true 表示刷新

  // 停止下拉刷新动画
  uni.stopPullDownRefresh()
})

/**
 * 触底加载更多处理
 * 【知识点】同理，onReachBottom 也必须以回调形式注册
 */
onReachBottom(async () => {
  if (!hasMore.value || isLoading.value) return
  await fetchProducts()
})

// ============================================================
// 第5部分：页面生命周期
// ============================================================

/**
 * onLoad: 页面首次加载时触发
 * 适合做一次性初始化，如获取页面参数
 */
onLoad(() => {
  console.log('🛒 商品列表页 - onLoad')
})

/**
 * onShow: 页面每次显示时都触发
 * 适合刷新数据，因为用户可能从详情页返回后希望看到最新数据
 */
onShow(() => {
  console.log('🛒 商品列表页 - onShow')
  // 读取首页金刚区写入的分类意图；分类变化时重置分页并重新加载
  // （tabBar 页面不销毁，再次进入时 onLoad 不会触发，只能靠 onShow 感知变化）
  const raw = uni.getStorageSync('products_category')
  // 防御：分类只接受字符串。若本地存储残留对象/数组等脏数据，
  // 分类标题会渲染成 "[object Object]"，这里视为无筛选并顺手清理
  if (raw !== '' && typeof raw !== 'string') {
    uni.setStorageSync('products_category', '')
  }
  const category = typeof raw === 'string' ? raw : ''
  if (category !== categoryFilter.value) {
    // 从不同分类进入：数据与页面位置都需要"换新"
    // （tabBar 页面不销毁，滚动位置会被保留，必须显式回顶）
    categoryFilter.value = category
    productList.value = []
    currentPage.value = 1
    hasMore.value = true
    scrollToTop()
    fetchProducts()
  }
  else if (productList.value.length === 0) {
    // 首次进入时加载数据
    fetchProducts()
  }
})

// ============================================================
// 第6部分：事件处理
// ============================================================

/**
 * 点击商品卡片，跳转到商品详情页
 *
 * 【知识点】uni.navigateTo() - 保留当前页面，跳转到新页面
 * 这里我们用带 id 参数的 URL，详情页可通过 onLoad(options) 获取
 *
 * @param productId - 商品ID
 */
function goToDetail(productId: string) {
  uni.navigateTo({
    url: `/pages/product-detail/product-detail?id=${productId}`,
  })
}

/**
 * 去购物车页面（tabBar 页用 switchTab）
 */
function goToCart() {
  uni.switchTab({
    url: '/pages/cart/cart',
  })
}

/**
 * 去搜索页（点击顶部搜索框）
 */
function goSearch() {
  uni.navigateTo({
    url: '/pages/search/search',
  })
}

/**
 * 页面回到顶部
 * 换分类/清除筛选时调用，避免停留在上一次列表的滚动位置
 */
function scrollToTop() {
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
}

/**
 * 清除分类筛选
 */
function clearCategory() {
  uni.setStorageSync('products_category', '')
  categoryFilter.value = ''
  productList.value = []
  currentPage.value = 1
  hasMore.value = true
  scrollToTop()
  fetchProducts()
}
</script>

<!--
  ============================================================
  模板部分（页面结构）
  ============================================================
  uni-app 使用 Vue 模板语法，组件标签用微信小程序的标签名：
  - <view>  等价于 <div>
  - <text>  等价于 <span>（文本必须包在 text 中）
  - <image> 等价于 <img>
  - <scroll-view> 可滚动区域
-->
<template>
  <view class="products-page">
    <!-- 顶部搜索框（点击进入搜索页） -->
    <view class="search-bar" @click="goSearch">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <text class="search-placeholder">搜索商品</text>
      </view>
    </view>

    <!--
      商品卡片网格布局
      使用 flex 布局，每行2列
    -->
    <!-- 分类标题（首页分类入口联动） -->
    <view v-if="categoryFilter" class="category-title">
      <text>{{ categoryFilter }}</text>
      <text class="category-clear" @click="clearCategory">清除筛选</text>
    </view>

    <view v-if="productList.length > 0" class="product-grid">
      <!--
        v-for 循环渲染商品列表
        :key 是 Vue 必需的，用于高效更新列表
      -->
      <view
        v-for="product in productList"
        :key="product._id"
        class="product-card"
        @click="goToDetail(product._id)"
      >
        <!-- 商品图片 -->
        <image
          class="product-image"
          :src="product.image"
          mode="aspectFill"
        />

        <!-- 商品信息 -->
        <view class="product-info">
          <!-- 商品名称，最多显示2行 -->
          <text class="product-name">{{ product.name }}</text>

          <!-- 价格行 -->
          <view class="price-row">
            <!-- 当前价格 -->
            <text class="price-current">¥{{ product.price }}</text>
            <!-- 原价（如果有折扣） -->
            <text
              v-if="product.originalPrice && product.originalPrice > product.price"
              class="price-original"
            >
              ¥{{ product.originalPrice }}
            </text>
          </view>

          <!-- 销量标签 -->
          <text
            v-if="product.sales"
            class="product-sales"
          >
            已售 {{ product.sales }}+
          </text>
        </view>
      </view>
    </view>

    <!--
      加载更多提示
      uni-load-more 是 uni-ui 组件库的加载状态组件
      easycom 会自动按需导入，无需手动 import
    -->
    <uni-load-more
      :status="isLoading ? 'loading' : (hasMore ? 'more' : 'noMore')"
    />

    <!-- 空状态：没有商品时显示 -->
    <view v-if="showEmpty" class="empty-state">
      <text class="empty-icon">📦</text>
      <text class="empty-text">暂无商品</text>
      <text class="empty-hint">商品正在快马加鞭上架中~</text>
    </view>
  </view>
</template>

<!--
  ============================================================
  样式部分
  ============================================================
  scoped 表示这些样式只作用于当前组件，不会影响其他页面
  rpx 是微信小程序专用单位，750rpx = 屏幕宽度
-->
<style scoped>
/* 页面容器 */
.products-page {
  padding: 20rpx;
  background-color: #f5f5f5;
  min-height: 100vh;
}

/* ========== 顶部搜索框 ========== */
.search-bar {
  padding: 4rpx 4rpx 16rpx;
}

.search-box {
  display: flex;
  align-items: center;
  height: 68rpx;
  padding: 0 24rpx;
  background-color: #fff;
  border-radius: 34rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.search-placeholder {
  font-size: 28rpx;
  color: #bbb;
}

/* ========== 分类标题 ========== */
.category-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 8rpx 20rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.category-clear {
  font-size: 24rpx;
  font-weight: normal;
  color: #667eea;
}

/* ========== 商品网格 ========== */
.product-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

/* ========== 商品卡片 ========== */
.product-card {
  width: 48%;                    /* 每行2列，留2%间距 */
  background: #fff;
  border-radius: 16rpx;          /* 圆角 */
  margin-bottom: 20rpx;
  overflow: hidden;              /* 隐藏超出圆角的内容 */
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);  /* 阴影 */
}

.product-card:active {
  transform: scale(0.98);        /* 点击时略微缩小，提供反馈 */
  transition: transform 0.15s;
}

/* 商品图片 */
.product-image {
  width: 100%;
  height: 340rpx;                /* 固定高度，保证对齐 */
  display: block;
  background-color: #f0f0f0;     /* 图片加载前显示灰色背景 */
}

/* 商品信息区域 */
.product-info {
  padding: 16rpx 20rpx 20rpx;
}

/* 商品名称 */
.product-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  /* 超过2行省略号 */
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
  margin-bottom: 12rpx;
  min-height: 78rpx;            /* 即使只有1行也占2行高度，保持对齐 */
}

/* 价格行 */
.price-row {
  display: flex;
  align-items: baseline;        /* 底部对齐（因为字体大小不同） */
  gap: 8rpx;
  margin-bottom: 8rpx;
}

/* 当前价格（红色加粗） */
.price-current {
  font-size: 32rpx;
  font-weight: bold;
  color: #ff4757;
}

/* 原价（灰色删除线） */
.price-original {
  font-size: 22rpx;
  color: #999;
  text-decoration: line-through; /* 删除线效果 */
}

/* 销量 */
.product-sales {
  font-size: 22rpx;
  color: #999;
}

/* ========== 空状态 ========== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 30rpx;
}

.empty-text {
  font-size: 32rpx;
  color: #999;
  margin-bottom: 10rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: #ccc;
}
</style>
