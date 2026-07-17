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
      3.5 示例数据（学习用）
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

/** 是否正在写入示例数据 */
const isSeeding = ref(false)

/**
 * 计算属性：是否显示空状态
 * 当不在加载中 且 列表为空时，显示"暂无商品"提示
 */
const showEmpty = computed(() => !isLoading.value && productList.value.length === 0)

// ============================================================
// 第3.5部分：示例数据（学习用）
// ============================================================

/**
 * 示例商品数据
 * 用于快速填充数据库，方便看到效果
 *
 * 【知识点】图片 URL 使用 picsum.photos 占位图片服务
 * 你也可以替换为自己的图片链接
 */
const sampleProducts = [
  {
    name: '清爽纯棉T恤 夏季新款',
    price: 79,
    originalPrice: 159,
    image: 'https://picsum.photos/seed/tshirt/400/400',
    images: ['https://picsum.photos/seed/tshirt1/750/750', 'https://picsum.photos/seed/tshirt2/750/750', 'https://picsum.photos/seed/tshirt3/750/750'],
    category: '服装',
    sales: 1280,
    stock: 99,
    rating: 4.8,
    description: '100%纯棉面料，亲肤透气，夏日必备基础款。',
    specs: [
      { name: '颜色', values: [{ label: '白色', value: 'white' }, { label: '黑色', value: 'black' }, { label: '灰色', value: 'gray' }] },
      { name: '尺码', values: [{ label: 'S', value: 'S' }, { label: 'M', value: 'M' }, { label: 'L', value: 'L' }, { label: 'XL', value: 'XL' }] },
    ],
  },
  {
    name: '无线蓝牙耳机 Pro',
    price: 299,
    originalPrice: 499,
    image: 'https://picsum.photos/seed/earphone/400/400',
    images: ['https://picsum.photos/seed/earphone1/750/750', 'https://picsum.photos/seed/earphone2/750/750', 'https://picsum.photos/seed/earphone3/750/750'],
    category: '数码',
    sales: 3560,
    stock: 50,
    rating: 4.9,
    description: '主动降噪，30小时续航，Hi-Fi音质。',
    specs: [
      { name: '颜色', values: [{ label: '星光白', value: 'white' }, { label: '曜石黑', value: 'black' }, { label: '雾霾蓝', value: 'blue' }] },
    ],
  },
  {
    name: '北欧风简约台灯',
    price: 128,
    originalPrice: 199,
    image: 'https://picsum.photos/seed/lamp/400/400',
    images: ['https://picsum.photos/seed/lamp1/750/750', 'https://picsum.photos/seed/lamp2/750/750'],
    category: '家居',
    sales: 890,
    stock: 120,
    rating: 4.6,
    description: '三档调光，护眼LED，书房卧室两用。',
    specs: [
      { name: '颜色', values: [{ label: '米白色', value: 'white' }, { label: '深灰色', value: 'gray' }] },
    ],
  },
  {
    name: '大容量双肩包 旅行必备',
    price: 159,
    originalPrice: 259,
    image: 'https://picsum.photos/seed/bag/400/400',
    images: ['https://picsum.photos/seed/bag1/750/750', 'https://picsum.photos/seed/bag2/750/750', 'https://picsum.photos/seed/bag3/750/750'],
    category: '配饰',
    sales: 2100,
    stock: 75,
    rating: 4.7,
    description: '防泼水面料，多隔层设计，可放15.6寸笔记本。',
    specs: [
      { name: '颜色', values: [{ label: '经典黑', value: 'black' }, { label: '海军蓝', value: 'navy' }, { label: '卡其色', value: 'khaki' }] },
    ],
  },
  {
    name: '速干运动短裤 透气跑步',
    price: 89,
    image: 'https://picsum.photos/seed/shorts/400/400',
    images: ['https://picsum.photos/seed/shorts1/750/750', 'https://picsum.photos/seed/shorts2/750/750'],
    category: '服装',
    sales: 1680,
    stock: 200,
    rating: 4.5,
    description: '四面弹力面料，速干排汗，运动无束缚。',
    specs: [
      { name: '颜色', values: [{ label: '黑色', value: 'black' }, { label: '深灰', value: 'gray' }] },
      { name: '尺码', values: [{ label: 'M', value: 'M' }, { label: 'L', value: 'L' }, { label: 'XL', value: 'XL' }, { label: '2XL', value: '2XL' }] },
    ],
  },
  {
    name: '智能手环 心率监测版',
    price: 199,
    originalPrice: 329,
    image: 'https://picsum.photos/seed/watch/400/400',
    images: ['https://picsum.photos/seed/watch1/750/750', 'https://picsum.photos/seed/watch2/750/750', 'https://picsum.photos/seed/watch3/750/750'],
    category: '数码',
    sales: 5420,
    stock: 30,
    rating: 4.8,
    description: '全天候心率监测，血氧检测，14天超长续航。',
    specs: [
      { name: '颜色', values: [{ label: '午夜黑', value: 'black' }, { label: '星光银', value: 'silver' }] },
    ],
  },
  {
    name: '日式陶瓷碗 套装4只',
    price: 68,
    image: 'https://picsum.photos/seed/bowl/400/400',
    images: ['https://picsum.photos/seed/bowl1/750/750', 'https://picsum.photos/seed/bowl2/750/750'],
    category: '家居',
    sales: 760,
    stock: 300,
    rating: 4.4,
    description: '釉下彩工艺，安全无毒，微波炉可用。',
  },
  {
    name: '复古圆框墨镜 男女通用',
    price: 129,
    originalPrice: 229,
    image: 'https://picsum.photos/seed/sunglass/400/400',
    images: ['https://picsum.photos/seed/sunglass1/750/750', 'https://picsum.photos/seed/sunglass2/750/750'],
    category: '配饰',
    sales: 980,
    stock: 85,
    rating: 4.6,
    description: '偏光镜片，UV400防护，金属框架轻巧舒适。',
    specs: [
      { name: '颜色', values: [{ label: '黑色', value: 'black' }, { label: '茶色', value: 'brown' }, { label: '银色', value: 'silver' }] },
    ],
  },
]

/**
 * 将示例数据写入 CloudBase 数据库
 *
 * 【知识点】CloudBase 写入操作：
 * - collection('集合名').add(数据)  添加单条数据
 * - 也可以批量添加，但这里逐条添加更安全
 * - 集合不存在时，CloudBase 会自动创建
 */
async function seedSampleData() {
  // 防止重复点击
  if (isSeeding.value) return

  isSeeding.value = true
  uni.showLoading({ title: '正在写入示例数据...' })

  try {
    const db = app.database()
    const now = Date.now()

    // 逐条写入数据（CloudBase 的 add 方法一次只能添加一条）
    for (const product of sampleProducts) {
      await db.collection('products').add({
        ...product,           // 展开商品数据
        createTime: now + Math.random() * 1000,  // 加随机偏移，让排序有区分度
      })
    }

    uni.hideLoading()
    uni.showToast({
      title: '示例数据写入成功！',
      icon: 'success',
    })

    // 重新加载商品列表
    await fetchProducts(true)
  } catch (error) {
    uni.hideLoading()
    console.error('写入示例数据失败:', error)
    uni.showToast({
      title: '写入失败，请检查数据库权限',
      icon: 'error',
      duration: 3000,
    })
  } finally {
    isSeeding.value = false
  }
}

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

  try {
    // ===== 核心：CloudBase 数据库查询 =====

    // 第1步：获取数据库引用
    const db = app.database()

    // 第2步：构建查询
    // collection() 参数是集合名，这里叫 'products'
    // 如果集合不存在，CloudBase 会在首次写入时自动创建
    const query = db.collection('products')
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
  // 首次进入时加载数据
  if (productList.value.length === 0) {
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
 * 去购物车页面
 */
function goToCart() {
  uni.navigateTo({
    url: '/pages/cart/cart',
  })
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
    <!--
      商品卡片网格布局
      使用 flex 布局，每行2列
    -->
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

      <!--
        【学习用】加载示例数据按钮
        点击后会将上面定义的 sampleProducts 数组写入 CloudBase 数据库
        这样你就能立即看到商品列表效果了！
      -->
      <button
        class="seed-btn"
        :disabled="isSeeding"
        @click="seedSampleData"
      >
        {{ isSeeding ? '正在写入...' : '📥 加载示例商品数据' }}
      </button>
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

/* 示例数据写入按钮 */
.seed-btn {
  margin-top: 40rpx;
  padding: 16rpx 48rpx;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  border-radius: 40rpx;
  font-size: 28rpx;
}

.seed-btn[disabled] {
  opacity: 0.6;
}
</style>
