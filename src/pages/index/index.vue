<script setup lang="ts">
// 跳转到商品列表页（新功能！）
function goToProducts() {
  uni.navigateTo({
    url: '/pages/products/products',
  })
}

// 跳转到购物车
function goToCart() {
  uni.navigateTo({
    url: '/pages/cart/cart',
  })
}

// 跳转到演示页面
function goToDemo() {
  uni.navigateTo({
    url: '/pages/demo/demo',
  })
}

// 跳转到登录页面
function goToLogin() {
  uni.navigateTo({
    url: '/pages/login/index',
  })
}

// 跳转到用户信息页面
function goToProfile() {
  uni.navigateTo({
    url: '/pages/profile/profile',
  })
}

// 跳转到收货地址管理
function goToAddress() {
  uni.navigateTo({
    url: '/pages/address/address-list',
  })
}

// 打开文档
function openDocs() {
  // #ifdef H5
  window.open('https://docs.cloudbase.net/', '_blank')
  // #endif

  // #ifndef H5
  uni.setClipboardData({
    data: 'https://docs.cloudbase.net/',
    success: () => {
      uni.showToast({
        title: '文档地址已复制',
        icon: 'success',
      })
    },
  })
  // #endif
}
</script>

<template>
  <view class="actions">
    <!-- 新加：商品列表入口 -->
    <button class="btn btn-primary" @click="goToProducts">
      🛍️ 商品列表
    </button>
    <!-- 新加：购物车入口 -->
    <button class="btn btn-warning" @click="goToCart">
      🛒 购物车
    </button>
    <button class="btn btn-success" @click="goToDemo">
      体验云开发功能
    </button>
    <button class="btn btn-info" @click="goToLogin">
      选择登录方式
    </button>
    <button class="btn btn-info" @click="goToAddress">
      📍 收货地址
    </button>
    <button class="btn btn-warning" @click="goToProfile">
      查看用户信息
    </button>
    <button class="btn btn-secondary" @click="openDocs">
      查看文档
    </button>
  </view>
  <view class="footer">
    <image class="logo" src="https://7463-tcb-advanced-a656fc-1257967285.tcb.qcloud.la/mcp/powered-by-cloudbase-badge.svg" mode="widthFix" />
  </view>
</template>

<style scoped>
.actions {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-bottom: 40rpx;
}

.btn {
  width: 100%;
  padding: 20rpx 30rpx;
  border-radius: 40rpx;
  border: none;
  font-size: 28rpx;
  font-weight: bold;
  text-align: center;
}

.btn-primary {
  background: linear-gradient(45deg, #ff6b6b, #ee5a24);
  color: white;
  box-shadow: 0 8rpx 20rpx rgba(255, 107, 107, 0.3);
}

.btn-success {
  background: linear-gradient(45deg, #56ab2f, #a8e6cf);
  color: white;
  box-shadow: 0 8rpx 20rpx rgba(86, 171, 47, 0.3);
}

.btn-info {
  background: linear-gradient(45deg, #3498db, #74b9ff);
  color: white;
  box-shadow: 0 8rpx 20rpx rgba(52, 152, 219, 0.3);
}

.btn-warning {
  background: linear-gradient(45deg, #f39c12, #f1c40f);
  color: white;
  box-shadow: 0 8rpx 20rpx rgba(243, 156, 18, 0.3);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2rpx solid rgba(255, 255, 255, 0.3);
}

.footer {
  margin-top: 60rpx;
  text-align: center;
}

.footer .logo {
  width: 300rpx;
  opacity: 0.8;
}
</style>
