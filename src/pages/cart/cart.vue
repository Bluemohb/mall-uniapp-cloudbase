<!--
  ============================================================
  🛒 购物车页 - 购物小程序第3步
  ============================================================
  这个页面展示了：
  - 从本地存储读取购物车数据
  - 商品选中/取消选中、全选/全不选
  - 数量增减（最少1）
  - 批量删除
  - 实时计算合计金额
  - 空购物车状态

  【知识点】
  - uni.getStorageSync / uni.setStorageSync：本地数据持久化
  - computed：响应式计算合计金额
  - watch：监听数据变化自动保存
  ============================================================
-->
<template>
  <view class="cart-page">
    <!-- ========== 空购物车状态 ========== -->
    <view v-if="cartList.length === 0" class="empty-state">
      <view class="empty-icon">🛒</view>
      <text class="empty-text">购物车是空的</text>
      <text class="empty-hint">快去挑选心仪的商品吧</text>
      <view class="empty-btn" @click="goShopping">去逛逛</view>
    </view>

    <!-- ========== 购物车列表 ========== -->
    <template v-else>
      <scroll-view class="cart-scroll" scroll-y enhanced :show-scrollbar="false">
        <!-- 编辑模式切换 -->
        <view class="edit-bar">
          <text v-if="!isEditMode" class="edit-bar-hint">
            共 {{ cartList.length }} 件商品
          </text>
          <view class="edit-toggle" @click="isEditMode = !isEditMode">
            <text :style="{ color: isEditMode ? THEME.price : THEME.primary }">
              {{ isEditMode ? '完成' : '管理' }}
            </text>
          </view>
        </view>

        <view
          v-for="(item, index) in cartList"
          :key="item.productId + item.specs"
          class="cart-item"
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
              :src="item.image || '/static/logo.png'"
              class="item-image"
              mode="aspectFill"
              lazy-load
            />
            <view class="item-info">
              <text class="item-name">{{ item.name }}</text>
              <text v-if="item.specs" class="item-specs">{{ item.specs }}</text>
              <view class="item-bottom">
                <text class="item-price">¥{{ formatMoney(item.price) }}</text>
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

        <view class="bottom-placeholder" />
      </scroll-view>

      <!-- ========== 底部结算栏 ========== -->
      <view class="cart-footer">
        <view class="footer-left" @click="toggleSelectAll">
          <view class="check-box" :class="{ checked: isAllSelected }">
            <text v-if="isAllSelected" class="check-icon">✓</text>
          </view>
          <text class="select-all-text">全选</text>
        </view>

        <view class="footer-right">
          <view v-if="!isEditMode" class="total-info">
            <text class="total-label">合计：</text>
            <text class="total-price">¥{{ totalPriceText }}</text>
          </view>
          <view
            v-if="!isEditMode"
            class="settle-btn"
            :class="{ disabled: selectedCount === 0 }"
            @click="goCheckout"
          >
            结算({{ selectedCount }})
          </view>
          <view
            v-else
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

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { formatCents, formatMoney, calcTotalCents } from '@/utils/money'
import { readCart, syncCartOnStartup, writeCart } from '@/utils/cart'
import type { CartItem } from '@/utils/cart'
import { THEME } from '@/theme'
import { reportError } from '@/utils/error'

// ============================================================
// 响应式数据
// ============================================================

const cartList = ref<CartItem[]>([])
const isEditMode = ref(false)

// ============================================================
// 计算属性
// ============================================================

const selectedCount = computed(() =>
  cartList.value.filter(item => item.selected).reduce((sum, item) => sum + item.quantity, 0),
)

/** 已选商品合计（分）：整数运算，避免浮点误差 */
const totalCents = computed(() =>
  calcTotalCents(cartList.value.filter(item => item.selected)),
)

/** 合计金额展示文本（元，两位小数） */
const totalPriceText = computed(() => formatCents(totalCents.value))

const isAllSelected = computed(() =>
  cartList.value.length > 0 && cartList.value.every(item => item.selected),
)

// ============================================================
// 数据加载与持久化（云端 carts 集合 + 本地镜像，见 utils/cart.ts）
// ============================================================

async function loadCartData() {
  try {
    // 启动时已合并本地临时车（App.onLaunch），这里 await 同一个 Promise：
    // 保证「冷启动直接进购物车」时也能读到云端最新数据，且不重复请求
    await syncCartOnStartup()
    cartList.value = readCart()
  }
  catch (error) {
    reportError('加载购物车数据', error, { toast: '加载购物车失败' })
    cartList.value = []
  }
}

watch(cartList, () => {
  writeCart(cartList.value)
}, { deep: true })

// ============================================================
// 交互方法
// ============================================================

function toggleSelect(index: number) {
  cartList.value[index].selected = !cartList.value[index].selected
}

function toggleSelectAll() {
  const newState = !isAllSelected.value
  cartList.value.forEach((item) => { item.selected = newState })
}

function changeQty(index: number, delta: number) {
  const newQty = cartList.value[index].quantity + delta
  if (newQty < 1) return
  cartList.value[index].quantity = newQty
}

function removeItem(index: number) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除「${cartList.value[index].name}」吗？`,
    success: (res) => {
      if (res.confirm) {
        cartList.value.splice(index, 1)
        if (cartList.value.length === 0) {
          isEditMode.value = false
        }
      }
    },
  })
}

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

function goToDetail(productId: string) {
  uni.navigateTo({ url: `/pages/product-detail/product-detail?id=${productId}` })
}

function goShopping() {
  uni.switchTab({ url: '/pages/products/products' })
}

function goCheckout() {
  if (selectedCount.value === 0) {
    uni.showToast({ title: '请先选择商品', icon: 'none' })
    return
  }
  // 将选中的商品写入本地存储，供订单确认页读取
  const selectedItems = cartList.value.filter(item => item.selected)
  uni.setStorageSync('checkout_items', selectedItems)
  // 跳转到订单确认页（第5步：from=cart 表示来自购物车结算）
  uni.navigateTo({ url: '/pages/order/order-confirm?from=cart' })
}

// ============================================================
// 生命周期
// ============================================================

onShow(() => {
  void loadCartData()
})
</script>

<style scoped lang="scss">
.cart-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: $app-bg-page;
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
  color: $app-text-muted;
  margin-bottom: 12rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: #bbb;
  margin-bottom: 40rpx;
}

.empty-btn {
  padding: 16rpx 60rpx;
  background: $app-gradient-primary;
  color: #fff;
  font-size: 28rpx;
  border-radius: 40rpx;
}

/* ========== 编辑栏 ========== */
.edit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 30rpx;
  background-color: #fff;
  margin-bottom: 8rpx;
}

.edit-bar-hint {
  font-size: 26rpx;
  color: $app-text-muted;
}

.edit-toggle {
  font-size: 28rpx;
  font-weight: 500;
}

/* ========== 列表 ========== */
.cart-scroll {
  flex: 1;
  padding-top: 8rpx;
}

.cart-item {
  display: flex;
  align-items: center;
  padding: 24rpx 24rpx;
  margin: 0 24rpx 16rpx;
  background-color: #fff;
  border-radius: 16rpx;
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
}

.check-box.checked {
  background-color: $app-color-primary;
  border-color: $app-color-primary;
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
  color: $app-text-primary;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8rpx;
}

.item-specs {
  font-size: 24rpx;
  color: $app-text-muted;
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
  color: $app-color-price;
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
  color: $app-text-secondary;
  background-color: #fafafa;
}

.qty-btn.disabled {
  opacity: 0.4;
}

.qty-num {
  width: 60rpx;
  text-align: center;
  font-size: 28rpx;
  color: $app-text-primary;
}

/* ========== 删除按钮 ========== */
.delete-btn {
  width: 100rpx;
  height: 160rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: $app-color-price;
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
}

.footer-left {
  display: flex;
  align-items: center;
}

.select-all-text {
  font-size: 28rpx;
  color: $app-text-primary;
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
  color: $app-text-secondary;
}

.total-price {
  font-size: 36rpx;
  font-weight: 700;
  color: $app-color-price;
}

.settle-btn {
  padding: 16rpx 40rpx;
  background: $app-gradient-primary;
  color: #fff;
  font-size: 28rpx;
  font-weight: 500;
  border-radius: 40rpx;
}

.settle-btn.disabled {
  opacity: 0.5;
}

.batch-delete-btn {
  padding: 16rpx 40rpx;
  background-color: $app-color-price;
  color: #fff;
  font-size: 28rpx;
  font-weight: 500;
  border-radius: 40rpx;
}

.batch-delete-btn.disabled {
  opacity: 0.5;
}
</style>
