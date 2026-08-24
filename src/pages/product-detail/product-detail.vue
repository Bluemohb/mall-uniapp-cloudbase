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

// 【重要】uni-app 页面生命周期钩子，必须从 @dcloudio/uni-app 导入
import { onLoad } from '@dcloudio/uni-app'

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
 * 当前显示的商品价格
 * 暂时直接用 product.price，后续规格影响价格时可扩展
 */
const displayPrice = computed(() => product.value?.price ?? 0)

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
 */
const isMaxQuantity = computed(() => {
  if (!product.value?.stock) return false
  return quantity.value >= product.value.stock
})

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
  if (product.value?.stock && quantity.value >= product.value.stock) {
    uni.showToast({ title: '库存不足', icon: 'none' })
    return
  }
  quantity.value++
}

/**
 * 切换收藏状态
 *
 * 【知识点】本地存储 uni.setStorageSync / getStorageSync
 * 这里用本地存储维护收藏状态，实际项目建议存到数据库
 */
function toggleFavorite() {
  isFavorited.value = !isFavorited.value

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
    // 构造购物车商品对象
    const cartItem = {
      productId: product.value!._id,
      name: product.value!.name,
      image: product.value!.image,
      price: product.value!.price,
      specs: selectedSpecsText.value,   // 如 "黑色 / XL"
      quantity: quantity.value,
      selected: true,                   // 购物车中默认勾选
      addTime: Date.now(),
    }

    // 从本地存储读取现有购物车
    const cartList = uni.getStorageSync('cart_list') || []

    // 查找购物车中是否已有同商品同规格的项
    const existIndex = cartList.findIndex(
      (item: any) =>
        item.productId === cartItem.productId
        && item.specs === cartItem.specs
    )

    if (existIndex !== -1) {
      // 已存在：累加数量
      cartList[existIndex].quantity += quantity.value
    } else {
      // 不存在：新增
      cartList.push(cartItem)
    }

    // 写回本地存储
    uni.setStorageSync('cart_list', cartList)

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
    price: product.value.price,
    specs: selectedSpecsText.value,   // 如 "黑色 / XL"
    quantity: quantity.value,
  }

  // 写入本地存储，供订单确认页读取
  uni.setStorageSync('buy_now_item', [buyNowItem])

  // 跳转订单确认页（from=buynow 表示来自立即购买）
  uni.navigateTo({ url: '/pages/order/order-confirm?from=buynow' })
}

/**
 * 跳转购物车
 */
function goToCart() {
  uni.navigateTo({ url: '/pages/cart/cart' })
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
onLoad((options: any) => {
  if (options?.id) {
    productId.value = options.id
    fetchProductDetail(options.id)
  } else {
    uni.showToast({ title: '参数错误', icon: 'error' })
  }
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
        indicator-active-color="#667eea"
        @change="(e: any) => currentImageIndex = e.detail.current"
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
          <text class="price">¥{{ displayPrice }}</text>
          <text
            v-if="product.originalPrice && product.originalPrice > product.price"
            class="original-price"
          >
            ¥{{ product.originalPrice }}
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
          <text v-if="product.stock" class="meta-item">
            库存 {{ product.stock }}
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
        :disabled="!allSpecsSelected"
        @click="addToCart"
      >
        加入购物车
      </button>

      <!-- 立即购买按钮 -->
      <button
        class="btn-buy"
        :disabled="!allSpecsSelected"
        @click="buyNow"
      >
        立即购买
      </button>
    </view>
  </view>
</template>

<!--
  ============================================================
  样式部分
  ============================================================
-->
<style scoped>
.detail-page {
  min-height: 100vh;
  background-color: #f5f5f5;
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
  color: #999;
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
  color: #ff4757;
}

.original-price {
  font-size: 26rpx;
  color: #999;
  text-decoration: line-through;
}

.product-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
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
  color: #999;
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
  color: #666;
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
  background: #f5f5f5;
  border-radius: 8rpx;
  font-size: 26rpx;
  color: #333;
  border: 2rpx solid transparent;
}

.spec-tag--active {
  background: #ede9fe;
  color: #667eea;
  border-color: #667eea;
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
  color: #333;
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
  background: #f5f5f5;
  font-size: 32rpx;
  color: #333;
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
  color: #333;
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
  color: #333;
  display: block;
  margin-bottom: 12rpx;
}

.desc-content {
  font-size: 26rpx;
  color: #666;
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
  color: #999;
}

.btn-cart {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  background: linear-gradient(135deg, #ffd700, #ffb800);
  color: #333;
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
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
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
