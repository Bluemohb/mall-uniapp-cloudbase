<!--
  ============================================================
  🏠 首页 - 购物小程序第6步（首页整合）
  ============================================================
  这个页面展示了：
  1. 搜索栏（点击进入独立搜索页 pages/search/search）
  2. Banner 轮播（swiper + 渐变卡片，无需外部图片）
  3. 分类金刚区（点击跳转商品列表并过滤分类）
  4. 热卖推荐（从 CloudBase products 集合按销量查询）

  【知识点】
  - switchTab()：跳转到 tabBar 页面必须用它，navigateTo 会失败
  - 分类联动：用本地存储 products_category 传递"分类意图"，
    商品列表页 onShow 时读取并刷新，兼容 tabBar 页面不销毁的特性
  ============================================================
-->
<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { app } from '@/utils/cloudbase'

// 商品卡片公共组件：本项目的 easycom 自动扫描未生效（编译产物里组件未被注册），
// 必须显式引入，由 <script setup> 自动注册到本页面
import GoodsCard from '@/components/goods-card/goods-card.vue'

// Mock 数据层：由全局开关 USE_MOCK 控制（见 src/utils/mock.ts）
import { USE_MOCK, mockGetRecommend } from '@/utils/mock'

// ============================================================
// 数据类型
// ============================================================

/** 商品（首页推荐用到的字段子集） */
interface Product {
  _id: string
  name: string
  price: number
  originalPrice?: number
  image: string
  sales?: number
}

/** 分类入口 */
interface Category {
  name: string
  icon: string
  value: string
  bg: string
}

// ============================================================
// 响应式数据
// ============================================================

/** 推荐商品列表 */
const recommendList = ref<Product[]>([])

/** Banner 轮播数据（渐变卡片，不依赖外部图片） */
const banners = [
  { title: '夏日焕新', sub: '新品上市 限时优惠', bg: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { title: '精选好物', sub: '全场包邮 品质保障', bg: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { title: '会员专享', sub: '登录立享专属价格', bg: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
]

/** 分类金刚区（value 传给商品列表页作为 category 过滤条件） */
const categories: Category[] = [
  { name: '全部商品', icon: '🛍️', value: '', bg: '#667eea' },
  { name: '数码', icon: '📱', value: '数码', bg: '#4facfe' },
  { name: '服饰', icon: '👕', value: '服饰', bg: '#f093fb' },
  { name: '食品', icon: '🍎', value: '食品', bg: '#f5576c' },
]

// ============================================================
// 数据加载
// ============================================================

/**
 * 查询热卖推荐商品（按销量倒序取前6件）
 * orderBy 指定不存在的字段时云端也能执行，但排序不稳定，
 * 这里兜底：失败则按创建时间倒序再试一次
 */
async function fetchRecommend() {
  // ===== Mock 模式（开发环境）：按销量 sales 倒序取前 6 件 =====
  if (USE_MOCK) {
    recommendList.value = mockGetRecommend(6) as Product[]
    return
  }

  try {
    const db = app.database()
    const res = await db.collection('products')
      .orderBy('sales', 'desc')
      .limit(6)
      .get()
    recommendList.value = (res.data || []) as Product[]
  }
  catch (error) {
    console.warn('按销量查询失败，回退按时间排序:', error)
    try {
      const db = app.database()
      const res = await db.collection('products')
        .orderBy('createTime', 'desc')
        .limit(6)
        .get()
      recommendList.value = (res.data || []) as Product[]
    }
    catch (e) {
      console.error('加载推荐商品失败:', e)
    }
  }
}

// ============================================================
// 事件处理
// ============================================================

/** 跳转搜索页（搜索框点击） */
function goSearch() {
  uni.navigateTo({ url: '/pages/search/search' })
}

/** 跳转商品列表（tabBar 页用 switchTab） */
function goProducts() {
  uni.switchTab({ url: '/pages/products/products' })
}

/** 点击分类：把分类写入本地存储，再切换到商品列表页 */
function goCategory(value: string) {
  uni.setStorageSync('products_category', String(value))
  uni.switchTab({ url: '/pages/products/products' })
}

/** 跳转商品详情 */
function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/product-detail/product-detail?id=${id}` })
}

// ============================================================
// 生命周期
// ============================================================

onShow(() => {
  // 每次回到首页都刷新推荐（比如下单后库存/销量可能变化）
  fetchRecommend()
})
</script>

<template>
  <view class="home-page">
    <!-- ========== 搜索栏（点击进入搜索页） ========== -->
    <view class="search-bar" @click="goSearch">
      <view class="search-input">
        <text class="search-icon">🔍</text>
        <text class="search-placeholder">搜索商品</text>
      </view>
    </view>

    <!-- ========== Banner 轮播 ========== -->
    <swiper
      class="banner-swiper"
      :autoplay="true"
      :circular="true"
      :interval="4000"
      indicator-dots
      indicator-color="rgba(255,255,255,0.5)"
      indicator-active-color="#ffffff"
    >
      <swiper-item v-for="(banner, i) in banners" :key="i">
        <view class="banner-item" :style="{ background: banner.bg }">
          <text class="banner-title">{{ banner.title }}</text>
          <text class="banner-sub">{{ banner.sub }}</text>
          <text class="banner-deco">🛒</text>
        </view>
      </swiper-item>
    </swiper>

    <!-- ========== 分类金刚区 ========== -->
    <view class="category-grid">
      <view v-for="cat in categories" :key="cat.name" class="category-item">
        <!-- 点击热区仅限图标+文字所在内容块，避免误触格子内空白 -->
        <view class="category-cell" @click="goCategory(cat.value)">
          <view class="category-icon" :style="{ background: cat.bg }">
            {{ cat.icon }}
          </view>
          <text class="category-name">{{ cat.name }}</text>
        </view>
      </view>
    </view>

    <!-- ========== 热卖推荐 ========== -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">🔥 热卖推荐</text>
        <text class="section-more" @click="goProducts">更多 ›</text>
      </view>

      <!-- 商品卡片：公共组件 components/goods-card（已在 script setup 显式引入） -->
      <view class="product-grid">
        <goods-card
          v-for="product in recommendList"
          :key="product._id"
          :product="product"
          @click="goDetail"
        />
      </view>

      <!-- 推荐为空时显示占位 -->
      <view v-if="recommendList.length === 0" class="empty-recommend">
        <text class="empty-text">暂无推荐商品</text>
      </view>
    </view>

    <view class="bottom-space" />
  </view>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 30rpx;
}

/* ========== 搜索栏 ========== */
.search-bar {
  padding: 20rpx 24rpx;
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.search-input {
  display: flex;
  align-items: center;
  height: 68rpx;
  padding: 0 24rpx;
  background-color: #fff;
  border-radius: 34rpx;
}

.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.search-placeholder {
  font-size: 28rpx;
  color: #bbb;
}

/* ========== Banner ========== */
.banner-swiper {
  height: 300rpx;
}

.banner-item {
  position: relative;
  height: 300rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 48rpx;
  overflow: hidden;
}

.banner-title {
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 12rpx;
}

.banner-sub {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
}

.banner-deco {
  position: absolute;
  right: 40rpx;
  bottom: 30rpx;
  font-size: 120rpx;
  opacity: 0.25;
}

/* ========== 分类金刚区 ========== */
.category-grid {
  display: flex;
  background-color: #fff;
  padding: 30rpx 0;
  margin: 20rpx 24rpx;
  border-radius: 16rpx;
}

.category-item {
  flex: 1;
  display: flex;
  justify-content: center;
}

/* 内容块（图标+文字），点击热区随内容宽度，不铺满整格 */
.category-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.category-icon {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
  color: #fff;
}

.category-name {
  font-size: 24rpx;
  color: #333;
}

/* ========== 推荐商品 ========== */
.section {
  margin: 0 24rpx;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.section-more {
  font-size: 26rpx;
  color: #999;
}

/* 卡片本身样式已抽到 components/goods-card，这里只负责网格布局 */
/* 两列栅格：列宽由这里决定，卡片组件内部撑满即可
   （用 grid 而不是 flex，避免小程序自定义组件宿主节点宽度被内容撑开） */
.product-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 4%;
  row-gap: 20rpx;
}

/* ========== 空状态 ========== */
.empty-recommend {
  padding: 60rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: #bbb;
}

.bottom-space {
  height: 20rpx;
}
</style>
