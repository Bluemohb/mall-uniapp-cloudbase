<!--
  ============================================================
  📄 商品详情页 - 购物小程序第2步
  ============================================================
  这个页面展示了：
  1. 如何接收路由参数（onLoad(options)）
  2. 如何查询 CloudBase 单条数据（doc().get()）
  3. 图片轮播组件（swiper）
  4. 规格选择交互
  5. 数量加减器组件
  6. 加入购物车 / 立即购买

  【学习要点】
  - onLoad(options) 的 options 包含页面跳转时传入的参数
  - swiper 组件的 autoplay、indicator-dots 等属性
  - watch 监听数据变化
-->
<script setup lang="ts">
// ============================================================
// 第1部分：导入依赖
// ============================================================
import { app } from '@/utils/cloudbase'
import { ref, computed, watch } from 'vue'

// Mock 数据层：由全局开关 USE_MOCK 控制（见 src/utils/mock.ts）
import { USE_MOCK, mockGetProductById } from '@/utils/mock'

// 金额格式化 + 按用户隔离的购物车存储
import { formatMoney } from '@/utils/money'
import { ensureCartUid, readCart, writeCart } from '@/utils/cart'
import type { CartItem } from '@/utils/cart'

// 收藏存储（云端 favorites 集合 + 本地镜像，见 utils/favorite.ts）
import { isFavorite, syncFavoritesOnStartup, toggleFavorite as toggleFavoriteStore } from '@/utils/favorite'

// 【重要】uni-app 页面生命周期钩子，必须从 @dcloudio/uni-app 导入
import { onLoad, onShow } from '@dcloudio/uni-app'
import { THEME } from '@/theme'

// ============================================================
// 第2部分：数据类型定义
// ============================================================

/** 商品详情（比列表的 Product 接口多了 images 等字段） */
interface ProductDetail {
  _id: string
  name: string
  price: number
  originalPrice?: number
  image: string          // 主图
  images?: string[]      // 详情页多图轮播
  category?: string
  sales?: number
  stock?: number         // 库存
  description?: string
  rating?: number
  specs?: ProductSpec[]  // 规格列表（颜色/尺寸）
  createTime?: number
}

/** 商品规格 */
interface ProductSpec {
  name: string           // 规格名，如"颜色"、"尺寸"
  values: SpecValue[]    // 规格值列表
}

/** 规格值 */
interface SpecValue {
  label: string          // 显示文本，如"黑色"、"XL"
  value: string          // 实际值
  price?: number         // 该规格单独定价（选填；不填则用商品基础价）
}

/** 轮播切换事件（只声明用到的字段） */
interface SwiperChangeEvent {
  detail: { current: number }
}

/** 商品详情页路由参数 */
interface ProductDetailQuery {
  id?: string
}

// ============================================================
// 第3部分：响应式数据
// ============================================================

/** 当前商品ID（从路由参数获取） */
const productId = ref('')

/** 商品详情数据 */
const product = ref<ProductDetail | null>(null)

/** 是否正在加载 */
const isLoading = ref(true)

/** 购买数量 */
const quantity = ref(1)

/** 当前选中的规格（key=规格名, value=选中的值） */
const selectedSpecs = ref<Record<string, string>>({})

/** 当前显示的图片索引（轮播用） */
const currentImageIndex = ref(0)

/** 是否已收藏 */
const isFavorited = ref(false)

/** 是否正在加入购物车 */
const isAddingToCart = ref(false)

// ============================================================
// 第4部分：计算属性
// ============================================================

/**
 * 当前显示的商品价格（元）
 *
 * 规则：先取商品基础价；若所选规格值带单独定价（SpecValue.price），
 * 则以规格价为准 —— 这样切换规格时价格会实时变化，与结算价一致。
 */
const displayPrice = computed(() => {
  let price = product.value?.price ?? 0
  const specs = product.value?.specs
  if (specs) {
    for (const spec of specs) {
      const selected = selectedSpecs.value[spec.name]
      const matched = spec.values.find(v => v.value === selected)
      if (matched && typeof matched.price === 'number') {
        price = matched.price
      }
    }
  }
  return price
})

/** 价格展示文本（元，两位小数） */
const displayPriceText = computed(() => formatMoney(displayPrice.value))

/** 划线原价展示文本；无折扣时为空串（模板据此隐藏） */
const originalPriceText = computed(() => {
  const original = product.value?.originalPrice
  if (typeof original !== 'number' || original <= displayPrice.value)
    return ''
  return `¥${formatMoney(original)}`
})

/**
 * 是否所有规格都已选择
 * 用于判断加入购物车按钮是否可用
 */
const allSpecsSelected = computed(() => {
  if (!product.value?.specs || product.value.specs.length === 0) {
    // 没有规格的商品，无需选择
    return true
  }
  return product.value.specs.every(
    spec => selectedSpecs.value[spec.name]
  )
})

/**
 * 已选规格的摘要文本，如 "黑色 / XL"
 */
const selectedSpecsText = computed(() => {
  if (!product.value?.specs) return ''
  return product.value.specs
    .map(spec => {
      const selected = selectedSpecs.value[spec.name]
      return selected || `请选择${spec.name}`
    })
    .join(' / ')
})

/**
 * 图片列表（轮播用的图片数组）
 * 优先用 images 数组，没有则用主图 image
 */
const imageList = computed(() => {
  if (product.value?.images && product.value.images.length > 0) {
    return product.value.images
  }
  return product.value?.image ? [product.value.image] : []
})

/**
 * 是否达到最大购买数量（库存限制）
 *
 * ⚠️ 注意区分「未设置库存」与「库存为 0」：
 * - undefined / null → 视为不限购
 * - 0 → 已售罄，数量已达上限（原实现用 !stock 判断，会把 0 误判为"不限购"）
 */
const isMaxQuantity = computed(() => {
  const stock = product.value?.stock
  if (typeof stock !== 'number') return false
  return quantity.value >= stock
})

/** 是否已售罄（库存为 0） */
const isSoldOut = computed(() => product.value?.stock === 0)

// ============================================================
// 第5部分：数据查询
// ============================================================

/**
 * 根据商品ID查询商品详情
 *
 * 【知识点】CloudBase 单条查询：
 * - doc('文档ID').get()  精确查询单条记录
 * - 比 collection().where({_id: xxx}) 更高效
 *
 * @param id - 商品文档ID
 */
async function fetchProductDetail(id: string) {
  isLoading.value = true

  // ===== Mock 模式（开发环境）：本地 JSON 按 _id 精确查询 =====
  if (USE_MOCK) {
    const p = mockGetProductById(id)
    if (p) {
      product.value = p as ProductDetail

      // 初始化规格选择（默认选第一个）
      if (product.value.specs) {
        const initial: Record<string, string> = {}
        product.value.specs.forEach(spec => {
          if (spec.values.length > 0) {
            initial[spec.name] = spec.values[0].value
          }
        })
        selectedSpecs.value = initial
      }

      console.log('📄 [Mock] 商品详情加载成功:', product.value.name)
    }
    else {
      uni.showToast({ title: '商品不存在', icon: 'error' })
    }
    isLoading.value = false
    return
  }

  try {
    const db = app.database()

    // 核心：根据文档ID查询单条数据
    const res = await db.collection('products').doc(id).get()

    if (res.data && res.data.length > 0) {
      product.value = res.data[0] as ProductDetail

      // 初始化规格选择（默认选第一个）
      if (product.value.specs) {
        const initial: Record<string, string> = {}
        product.value.specs.forEach(spec => {
          if (spec.values.length > 0) {
            initial[spec.name] = spec.values[0].value
          }
        })
        selectedSpecs.value = initial
      }

      console.log('📄 商品详情加载成功:', product.value.name)
    } else {
      uni.showToast({ title: '商品不存在', icon: 'error' })
    }
  } catch (error) {
    console.error('❌ 查询商品详情失败:', error)
    uni.showToast({ title: '加载失败', icon: 'error' })
  } finally {
    isLoading.value = false
  }
}

// ============================================================
// 第6部分：交互方法
// ============================================================

/**
 * 选择规格
 * 点击某个规格值时调用
 *
 * @param specName - 规格名（如"颜色"）
 * @param value - 规格值（如"黑色"）
 */
function selectSpec(specName: string, value: string) {
  selectedSpecs.value = {
    ...selectedSpecs.value,
    [specName]: value,
  }
}

/**
 * 判断某个规格值是否被选中（用于高亮显示）
 */
function isSpecSelected(specName: string, value: string): boolean {
  return selectedSpecs.value[specName] === value
}

/**
 * 减少数量（最小为1）
 */
function decreaseQuantity() {
  if (quantity.value > 1) {
    quantity.value--
  }
}

/**
 * 增加数量（不超过库存）
 */
function increaseQuantity() {
  const stock = product.value?.stock
  if (typeof stock === 'number' && quantity.value >= stock) {
    uni.showToast({ title: stock === 0 ? '该商品已售罄' : '库存不足', icon: 'none' })
    return
  }
  quantity.value++
}

/** 轮播切换：更新当前图片索引 */
function onSwiperChange(e: SwiperChangeEvent) {
  currentImageIndex.value = e.detail.current
}

/**
 * 切换收藏状态
 *
 * 收藏写云端 favorites 集合（按 userId 归属），本地留一份镜像：
 * 点击即时生效、离线也可用，后台再同步云端（见 utils/favorite.ts）。
 * 存的是商品快照（名称/图片/价格），收藏列表页可直接渲染。
 */
function toggleFavorite() {
  if (!product.value) return

  const p = product.value
  isFavorited.value = toggleFavoriteStore({
    productId: p._id,
    name: p.name,
    image: p.image,
    price: p.price,   // 收藏是商品级操作，记基础价（不含规格差价）
    category: p.category,
  })

  uni.showToast({
    title: isFavorited.value ? '已收藏' : '已取消收藏',
    icon: 'none',
  })
}

/**
 * 加入购物车
 *
 * 【知识点】购物车数据存储方案：
 * - 方案1：本地存储（简单，不同设备不同步）
 * - 方案2：CloudBase 数据库（多设备同步，需要用户登录）
 * 这里用方案1（本地存储），更简单直观
 */
async function addToCart() {
  // 检查规格是否已选择
  if (!allSpecsSelected.value) {
    uni.showToast({ title: '请选择完整规格', icon: 'none' })
    return
  }

  if (isAddingToCart.value) return
  isAddingToCart.value = true

  try {
    // 构造购物车商品对象（价格取 displayPrice，与所选规格保持一致）
    const cartItem: CartItem = {
      productId: product.value!._id,
      name: product.value!.name,
      image: product.value!.image,
      price: displayPrice.value,
      specs: selectedSpecsText.value,   // 如 "黑色 / XL"
      quantity: quantity.value,
      selected: true,                   // 购物车中默认勾选
      addTime: Date.now(),
    }

    // 购物车存云端 carts 集合（按 userId 归属）：先解析 uid，再读写本地镜像（会自动同步云端）
    await ensureCartUid()
    const cartList = readCart()

    // 查找购物车中是否已有同商品同规格的项
    const existIndex = cartList.findIndex(
      item => item.productId === cartItem.productId && item.specs === cartItem.specs,
    )

    if (existIndex !== -1) {
      // 已存在：累加数量
      cartList[existIndex].quantity += quantity.value
    }
    else {
      // 不存在：新增
      cartList.push(cartItem)
    }

    // 写回购物车（落本地镜像 + 后台同步云端 carts）
    writeCart(cartList)

    uni.showToast({
      title: '已加入购物车',
      icon: 'success',
    })

    // 重置数量
    quantity.value = 1
  } catch (error) {
    console.error('加入购物车失败:', error)
    uni.showToast({ title: '操作失败', icon: 'error' })
  } finally {
    isAddingToCart.value = false
  }
}

/**
 * 立即购买
 * 不走购物车，直接把当前商品（含规格和数量）写入本地存储，
 * 跳转到订单确认页（第5步实现）
 */
function buyNow() {
  if (!allSpecsSelected.value) {
    uni.showToast({ title: '请选择完整规格', icon: 'none' })
    return
  }

  if (!product.value) return

  // 构造"立即购买"的商品条目（与购物车条目结构一致）
  const buyNowItem = {
    productId: product.value._id,
    name: product.value.name,
    image: product.value.image,
    price: displayPrice.value,        // 与所选规格一致的价格
    specs: selectedSpecsText.value,   // 如 "黑色 / XL"
    quantity: quantity.value,
  }

  // 写入本地存储，供订单确认页读取
  uni.setStorageSync('buy_now_item', [buyNowItem])

  // 跳转订单确认页（from=buynow 表示来自立即购买）
  uni.navigateTo({ url: '/pages/order/order-confirm?from=buynow' })
}

/**
 * 跳转购物车（tabBar 页用 switchTab）
 */
function goToCart() {
  uni.switchTab({ url: '/pages/cart/cart' })
}

// ============================================================
// 第7部分：页面生命周期
// ============================================================

/**
 * onLoad: 获取页面参数
 *
 * 【知识点】路由参数获取：
 * 在 products.vue 中我们这样跳转：
 *   uni.navigateTo({ url: `/pages/product-detail/product-detail?id=${product._id}` })
 * 这里 options.id 就能获取到商品ID
 */
onLoad((options?: ProductDetailQuery) => {
  if (options?.id) {
    productId.value = options.id
    fetchProductDetail(options.id)
  }
  else {
    uni.showToast({ title: '参数错误', icon: 'error' })
  }
})

/**
 * onShow: 每次进入/返回本页都校正收藏态
 *
 * 场景：从收藏列表页取消收藏后返回，心形图标要跟着变
 * （onLoad 只在首次进入时执行一次，回显会停留在旧状态）。
 * 先按本地镜像立即回显，不等网络；再等启动合并完成后校正一次，
 * 覆盖「冷启动直接进详情页、云端收藏还没同步下来」的情况。
 */
onShow(() => {
  if (!productId.value) return

  isFavorited.value = isFavorite(productId.value)
  void syncFavoritesOnStartup().then(() => {
    if (productId.value)
      isFavorited.value = isFavorite(productId.value)
  })
})
</script>

<!--
  ============================================================
  模板部分
  ============================================================
-->
<template>
  <view class="detail-page">
    <!-- ========== 加载状态 ========== -->
    <view v-if="isLoading" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>

    <!-- ========== 商品内容（加载完成后显示） ========== -->
    <view v-if="product" class="detail-content">
      <!--
        图片轮播
        swiper 是 uni-app 内置的轮播组件
        circular: 循环播放
        autoplay: 自动播放
        indicator-dots: 显示指示点
        @change: 切换图片时触发
      -->
      <swiper
        class="image-swiper"
        :indicator-dots="imageList.length > 1"
        :autoplay="true"
        :circular="true"
        indicator-color="rgba(255,255,255,0.5)"
        :indicator-active-color="THEME.primary"
        @change="onSwiperChange"
      >
        <swiper-item
          v-for="(img, index) in imageList"
          :key="index"
        >
          <image
            class="swiper-image"
            :src="img"
            mode="aspectFill"
          />
        </swiper-item>
      </swiper>

      <!-- ========== 商品基本信息 ========== -->
      <view class="basic-info">
        <!-- 价格行 -->
        <view class="price-section">
          <text class="price">¥{{ displayPriceText }}</text>
          <text v-if="originalPriceText" class="original-price">
            {{ originalPriceText }}
          </text>
        </view>

        <!-- 商品名称 -->
        <text class="product-name">{{ product.name }}</text>

        <!-- 副信息行：销量 + 评分 -->
        <view class="meta-row">
          <text v-if="product.sales" class="meta-item">
            已售 {{ product.sales }}+
          </text>
          <text v-if="product.rating" class="meta-item rating">
            ★ {{ product.rating }}
          </text>
          <text v-if="typeof product.stock === 'number'" class="meta-item">
            {{ isSoldOut ? '已售罄' : `库存 ${product.stock}` }}
          </text>
        </view>
      </view>

      <!-- ========== 规格选择区 ========== -->
      <view v-if="product.specs && product.specs.length > 0" class="specs-section">
        <view
          v-for="spec in product.specs"
          :key="spec.name"
          class="spec-group"
        >
          <!-- 规格名称 -->
          <text class="spec-name">{{ spec.name }}</text>

          <!-- 规格值列表 -->
          <view class="spec-values">
            <text
              v-for="item in spec.values"
              :key="item.value"
              class="spec-tag"
              :class="{ 'spec-tag--active': isSpecSelected(spec.name, item.value) }"
              @click="selectSpec(spec.name, item.value)"
            >
              {{ item.label }}
            </text>
          </view>
        </view>
      </view>

      <!-- ========== 数量选择区 ========== -->
      <view class="quantity-section">
        <text class="quantity-label">数量</text>
        <view class="quantity-control">
          <text
            class="quantity-btn"
            :class="{ 'quantity-btn--disabled': quantity <= 1 }"
            @click="decreaseQuantity"
          >
            −
          </text>
          <text class="quantity-value">{{ quantity }}</text>
          <text
            class="quantity-btn"
            :class="{ 'quantity-btn--disabled': isMaxQuantity }"
            @click="increaseQuantity"
          >
            +
          </text>
        </view>
      </view>

      <!-- ========== 商品描述 ========== -->
      <view v-if="product.description" class="desc-section">
        <text class="desc-title">商品描述</text>
        <text class="desc-content">{{ product.description }}</text>
      </view>
    </view>

    <!-- ========== 底部操作栏（固定定位） ========== -->
    <view class="bottom-bar">
      <!-- 收藏按钮 -->
      <view class="action-icon" @click="toggleFavorite">
        <text class="icon-text">{{ isFavorited ? '❤️' : '🤍' }}</text>
        <text class="icon-label">收藏</text>
      </view>

      <!-- 购物车入口 -->
      <view class="action-icon" @click="goToCart">
        <text class="icon-text">🛒</text>
        <text class="icon-label">购物车</text>
      </view>

      <!-- 加入购物车按钮 -->
      <button
        class="btn-cart"
        :disabled="!allSpecsSelected || isSoldOut"
        @click="addToCart"
      >
        {{ isSoldOut ? '已售罄' : '加入购物车' }}
      </button>

      <!-- 立即购买按钮 -->
      <button
        class="btn-buy"
        :disabled="!allSpecsSelected || isSoldOut"
        @click="buyNow"
      >
        {{ isSoldOut ? '已售罄' : '立即购买' }}
      </button>
    </view>
  </view>
</template>

<!--
  ============================================================
  样式部分
  ============================================================
-->
<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  background-color: $app-bg-page;
  padding-bottom: 120rpx;  /* 留出底部栏高度 */
}

/* ========== 加载状态 ========== */
.loading-state {
  display: flex;
  justify-content: center;
  padding-top: 300rpx;
}
.loading-text {
  font-size: 28rpx;
  color: $app-text-muted;
}

/* ========== 图片轮播 ========== */
.image-swiper {
  width: 100%;
  height: 750rpx;          /* 1:1 方图 */
  background-color: #fff;
}
.swiper-image {
  width: 100%;
  height: 100%;
}

/* ========== 基本信息 ========== */
.basic-info {
  background: #fff;
  padding: 30rpx 30rpx 20rpx;
  margin-bottom: 16rpx;
}

.price-section {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.price {
  font-size: 48rpx;
  font-weight: bold;
  color: $app-color-price-alt;
}

.original-price {
  font-size: 26rpx;
  color: $app-text-muted;
  text-decoration: line-through;
}

.product-name {
  font-size: 32rpx;
  font-weight: 600;
  color: $app-text-primary;
  line-height: 1.5;
  display: block;
  margin-bottom: 12rpx;
}

.meta-row {
  display: flex;
  gap: 24rpx;
}

.meta-item {
  font-size: 24rpx;
  color: $app-text-muted;
}

.meta-item.rating {
  color: #f5a623;
  font-weight: bold;
}

/* ========== 规格选择 ========== */
.specs-section {
  background: #fff;
  padding: 24rpx 30rpx;
  margin-bottom: 16rpx;
}

.spec-group {
  margin-bottom: 20rpx;
}

.spec-group:last-child {
  margin-bottom: 0;
}

.spec-name {
  font-size: 26rpx;
  color: $app-text-secondary;
  display: block;
  margin-bottom: 14rpx;
}

.spec-values {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.spec-tag {
  padding: 10rpx 28rpx;
  background: $app-bg-page;
  border-radius: 8rpx;
  font-size: 26rpx;
  color: $app-text-primary;
  border: 2rpx solid transparent;
}

.spec-tag--active {
  background: #ede9fe;
  color: $app-color-primary;
  border-color: $app-color-primary;
  font-weight: 600;
}

/* ========== 数量选择 ========== */
.quantity-section {
  background: #fff;
  padding: 24rpx 30rpx;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.quantity-label {
  font-size: 28rpx;
  color: $app-text-primary;
}

.quantity-control {
  display: flex;
  align-items: center;
  gap: 0;
}

.quantity-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $app-bg-page;
  font-size: 32rpx;
  color: $app-text-primary;
}

.quantity-btn:first-child {
  border-radius: 8rpx 0 0 8rpx;
}

.quantity-btn:last-child {
  border-radius: 0 8rpx 8rpx 0;
}

.quantity-btn--disabled {
  color: #ccc;
}

.quantity-value {
  width: 80rpx;
  text-align: center;
  font-size: 28rpx;
  color: $app-text-primary;
  background: #fafafa;
  height: 56rpx;
  line-height: 56rpx;
}

/* ========== 商品描述 ========== */
.desc-section {
  background: #fff;
  padding: 24rpx 30rpx;
}

.desc-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $app-text-primary;
  display: block;
  margin-bottom: 12rpx;
}

.desc-content {
  font-size: 26rpx;
  color: $app-text-secondary;
  line-height: 1.8;
  display: block;
}

/* ========== 底部操作栏 ========== */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100rpx;
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 20rpx;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.05);
  z-index: 100;
}

.action-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 16rpx;
}

.icon-text {
  font-size: 36rpx;
  margin-bottom: 4rpx;
}

.icon-label {
  font-size: 20rpx;
  color: $app-text-muted;
}

.btn-cart {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  background: $app-gradient-star;
  color: $app-text-primary;
  font-size: 28rpx;
  font-weight: 600;
  border-radius: 36rpx;
  margin-left: 20rpx;
  border: none;
}

.btn-buy {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  background: $app-gradient-danger;
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
  border-radius: 36rpx;
  margin-left: 16rpx;
  border: none;
}

.btn-cart[disabled],
.btn-buy[disabled] {
  opacity: 0.5;
}
</style>
