<!--
  ============================================================
  🛒 购物车页 - 购物小程序第3步
  ============================================================
  这个页面展示了：
  - 从本地存储读取购物车数据
  - 商品选中/取消选中、全选/全不选
  - 数量增减（最少1）
  - 滑动删除/批量删除
  - 实时计算合计金额
  - 空购物车状态

  【知识点】
  - uni.getStorageSync / uni.setStorageSync：本地数据持久化
  - computed：响应式计算合计金额
  - 微信小程序的触摸事件（滑动删除）
  ============================================================
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'

// ============================================================
// 第1部分：类型定义
// ============================================================

/** 购物车单项 */
interface CartItem {
  productId: string
  name: string
  image: string
  price: number
  specs: string
  quantity: number
  selected: boolean
  addTime: number
}

// ============================================================
// 第2部分：响应式数据
// ============================================================

/** 购物车列表 */
const cartList = ref<CartItem[]>([])

/** 是否编辑模式 */
const isEditMode = ref(false)

// ============================================================
// 第3部分：计算属性
// ============================================================

/** 已选中商品数量 */
const selectedCount = computed(() =>
  cartList.value.filter(item => item.selected).reduce((sum, item) => sum + item.quantity, 0),
)

/** 合计金额（仅计算选中的商品） */
const totalPrice = computed(() =>
  cartList.value
    .filter(item => item.selected)
    .reduce((sum, item) => sum + item.price * item.quantity, 0),
)

/** 是否全选 */
const isAllSelected = computed(() =>
  cartList.value.length > 0 && cartList.value.every(item => item.selected),
)

// ============================================================
// 第4部分：数据加载
// ============================================================

/**
 * 从本地存储加载购物车数据
 */
function loadCartData() {
  try {
    cartList.value = uni.getStorageSync('cart_list') || []
  } catch (error) {
    console.error('加载购物车数据失败:', error)
    cartList.value = []
  }
}

/**
 * 保存购物车数据到本地存储
 */
function saveCartData() {
  uni.setStorageSync('cart_list', cartList.value)
}

// 监听数据变化自动保存
watch(cartList, () => {
  saveCartData()
}, { deep: true })

// ============================================================
// 第5部分：交互方法
// ============================================================

/** 切换单个商品的选中状态 */
function toggleSelect(index: number) {
  cartList.value[index].selected = !cartList.value[index].selected
}

/** 全选 / 取消全选 */
function toggleSelectAll() {
  const newState = !isAllSelected.value
  cartList.value.forEach((item) => {
    item.selected = newState
  })
}

/** 修改数量 */
function changeQty(index: number, delta: number) {
  const item = cartList.value[index]
  const newQty = item.quantity + delta
  if (newQty < 1) return
  item.quantity = newQty
}

/** 删除单项 */
function removeItem(index: number) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除「${cartList.value[index].name}」吗？`,
    success: (res) => {
      if (res.confirm) {
        cartList.value.splice(index, 1)
        // 如果全部删完了，退出编辑模式
        if (cartList.value.length === 0) {
          isEditMode.value = false
        }
      }
    },
  })
}

/** 批量删除选中商品 */
function batchDelete() {
  if (selectedCount.value === 0) {
    uni.showToast({ title: '请先选择商品', icon: 'none' })
    return
  }

  uni.showModal({
    title: '确认删除',
    content: `确定要删除选中的 ${selectedCount.value} 件商品吗？`,
    success: (res) => {
      if (res.confirm) {
        cartList.value = cartList.value.filter(item => !item.selected)
        if (cartList.value.length === 0) {
          isEditMode.value = false
        }
      }
    },
  })
}

/** 切换编辑模式 */
function toggleEditMode() {
  isEditMode.value = !isEditMode.value
}

/** 跳转商品详情 */
function goToDetail(productId: string) {
  uni.navigateTo({ url: `/pages/product-detail/product-detail?id=${productId}` })
}

/** 返回上一页 */
function goBack() {
  uni.navigateBack()
}

/** 去逛逛（跳转商品列表） */
function goShopping() {
  uni.navigateTo({ url: '/pages/products/products' })
}

/** 去结算 */
function goCheckout() {
  if (selectedCount.value === 0) {
    uni.showToast({ title: '请先选择商品', icon: 'none' })
    return
  }

  // 获取选中的商品
  const selectedItems = cartList.value.filter(item => item.selected)

  // 保存选中商品信息，供订单页使用
  uni.setStorageSync('checkout_items', selectedItems)

  // 跳转订单确认页（后续步骤实现）
  uni.showToast({ title: '订单功能即将上线', icon: 'none' })
}

// ============================================================
// 第6部分：生命周期
// ============================================================

/**
 * onShow: 每次页面显示时重新加载购物车数据
 * 这样从其他页面返回时数据是最新的
 */
onShow(() => {
  loadCartData()
})
</script>

<template>
  <view class="cart-page">
    <!-- ========== 顶部导航栏（自定义） ========== -->
    <view class="cart-header">
      <view class="header-back" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="header-title">购物车</text>
      <view class="header-action" @click="toggleEditMode">
        <text>{{ isEditMode ? '完成' : '管理' }}</text>
      </view>
    </view>

    <!-- ========== 空购物车状态 ========== -->
    <view v-if="cartList.length === 0" class="empty-state">
      <view class="empty-icon">
        🛒
      </view>
      <text class="empty-text">购物车是空的</text>
      <text class="empty-hint">快去挑选心仪的商品吧</text>
      <view class="empty-btn" @click="goShopping">
        去逛逛
      </view>
    </view>

    <!-- ========== 购物车列表 ========== -->
    <template v-else>
      <!-- 购物车商品列表 -->
      <scroll-view class="cart-scroll" scroll-y enhanced :show-scrollbar="false">
        <view
          v-for="(item, index) in cartList"
          :key="item.productId + item.specs"
          class="cart-item"
          :class="{ 'cart-item-edit': isEditMode }"
        >
          <!-- 选中框 -->
          <view
            class="check-box"
            :class="{ checked: item.selected }"
            @click="toggleSelect(index)"
          >
            <text v-if="item.selected" class="check-icon">✓</text>
          </view>

          <!-- 商品信息 -->
          <view class="item-main" @click="goToDetail(item.productId)">
            <image
              :src="item.image || '/static/placeholder.png'"
              class="item-image"
              mode="aspectFill"
            />
            <view class="item-info">
              <text class="item-name">{{ item.name }}</text>
              <text v-if="item.specs" class="item-specs">{{ item.specs }}</text>
              <view class="item-bottom">
                <text class="item-price">¥{{ item.price.toFixed(2) }}</text>
                <!-- 数量控制 -->
                <view class="qty-control">
                  <view
                    class="qty-btn"
                    :class="{ disabled: item.quantity <= 1 }"
                    @click.stop="changeQty(index, -1)"
                  >
                    <text>−</text>
                  </view>
                  <text class="qty-num">{{ item.quantity }}</text>
                  <view class="qty-btn" @click.stop="changeQty(index, 1)">
                    <text>+</text>
                  </view>
                </view>
              </view>
            </view>
          </view>

          <!-- 删除按钮（编辑模式下显示） -->
          <view
            v-if="isEditMode"
            class="delete-btn"
            @click="removeItem(index)"
          >
            <text>删除</text>
          </view>
        </view>

        <!-- 底部占位（避免被底部操作栏遮挡） -->
        <view class="bottom-placeholder" />
      </scroll-view>

      <!-- ========== 底部结算栏 ========== -->
      <view class="cart-footer">
        <view class="footer-left">
          <!-- 全选 -->
          <view class="check-box" :class="{ checked: isAllSelected }" @click="toggleSelectAll">
            <text v-if="isAllSelected" class="check-icon">✓</text>
          </view>
          <text class="select-all-text">全选</text>
        </view>

        <view v-if="!isEditMode" class="footer-right">
          <view class="total-info">
            <text class="total-label">合计：</text>
            <text class="total-price">¥{{ totalPrice.toFixed(2) }}</text>
          </view>
          <view
            class="settle-btn"
            :class="{ disabled: selectedCount === 0 }"
            @click="goCheckout"
          >
            结算({{ selectedCount }})
          </view>
        </view>

        <view v-else class="footer-right">
          <view
            class="batch-delete-btn"
            :class="{ disabled: selectedCount === 0 }"
            @click="batchDelete"
          >
            删除({{ selectedCount }})
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped>
/* ============================================================
   页面整体布局
   ============================================================ */
.cart-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
}

/* ========== 顶部导航 ========== */
.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
  height: 88rpx;
  background-color: #fff;
  border-bottom: 1rpx solid #eee;
}

.header-back {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 50rpx;
  color: #333;
  font-weight: 300;
  line-height: 1;
}

.header-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
}

.header-action {
  width: 60rpx;
  text-align: right;
}

.header-action {
  font-size: 28rpx;
  color: #667eea;
}

/* ========== 空状态 ========== */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-bottom: 200rpx;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 30rpx;
  opacity: 0.6;
}

.empty-text {
  font-size: 32rpx;
  color: #999;
  margin-bottom: 12rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: #bbb;
  margin-bottom: 40rpx;
}

.empty-btn {
  padding: 16rpx 60rpx;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 28rpx;
  border-radius: 40rpx;
}

/* ========== 购物车列表 ========== */
.cart-scroll {
  flex: 1;
  padding-top: 16rpx;
}

.cart-item {
  display: flex;
  align-items: center;
  padding: 24rpx 24rpx;
  margin: 0 24rpx 16rpx;
  background-color: #fff;
  border-radius: 16rpx;
  transition: transform 0.2s;
}

.cart-item-edit {
  /* 编辑模式下的过渡 */
}

/* ========== 选中框 ========== */
.check-box {
  width: 44rpx;
  height: 44rpx;
  border: 3rpx solid #ddd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
  transition: all 0.2s;
}

.check-box.checked {
  background-color: #667eea;
  border-color: #667eea;
}

.check-icon {
  font-size: 24rpx;
  color: #fff;
  font-weight: bold;
}

/* ========== 商品主体 ========== */
.item-main {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.item-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background-color: #f0f0f0;
  flex-shrink: 0;
  margin-right: 20rpx;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.item-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8rpx;
}

.item-specs {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 16rpx;
}

.item-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.item-price {
  font-size: 32rpx;
  font-weight: 600;
  color: #e7493b;
}

/* ========== 数量控制 ========== */
.qty-control {
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.qty-btn {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #ddd;
  border-radius: 50%;
  font-size: 32rpx;
  color: #666;
  background-color: #fafafa;
}

.qty-btn.disabled {
  opacity: 0.4;
}

.qty-num {
  width: 60rpx;
  text-align: center;
  font-size: 28rpx;
  color: #333;
}

/* ========== 删除按钮 ========== */
.delete-btn {
  width: 100rpx;
  height: 160rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e7493b;
  border-radius: 12rpx;
  margin-left: 16rpx;
  flex-shrink: 0;
}

.delete-btn text {
  color: #fff;
  font-size: 26rpx;
}

/* ========== 底部占位 ========== */
.bottom-placeholder {
  height: 120rpx;
}

/* ========== 底部结算栏 ========== */
.cart-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background-color: #fff;
  border-top: 1rpx solid #eee;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}

.footer-left {
  display: flex;
  align-items: center;
}

.select-all-text {
  font-size: 28rpx;
  color: #333;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.total-info {
  display: flex;
  align-items: baseline;
}

.total-label {
  font-size: 26rpx;
  color: #666;
}

.total-price {
  font-size: 36rpx;
  font-weight: 700;
  color: #e7493b;
}

/* ========== 结算按钮 ========== */
.settle-btn {
  padding: 16rpx 40rpx;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 28rpx;
  font-weight: 500;
  border-radius: 40rpx;
}

.settle-btn.disabled {
  opacity: 0.5;
}

/* ========== 批量删除按钮 ========== */
.batch-delete-btn {
  padding: 16rpx 40rpx;
  background-color: #e7493b;
  color: #fff;
  font-size: 28rpx;
  font-weight: 500;
  border-radius: 40rpx;
}

.batch-delete-btn.disabled {
  opacity: 0.5;
}
</style>
