<!--
  ============================================================
  👤 用户信息页（tabBar「我的」）
  ============================================================
  第7步重构后，本页只保留轻量信息与常用入口：
  - 顶部用户卡片（头像 / 昵称，点击进入"账号信息"独立页）
  - 我的订单
  - 服务列表（账号信息 / 收货地址 / 购物车 / 云开发文档）
  账号详情（身份徽章 / 账号绑定 / 账号信息 / 退出登录）
  已迁移到独立页：/pages/account/account-info
  ============================================================
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { auth, ensureLogin } from '../../utils/cloudbase'
import { getWechatProfile } from '../../utils/index'
import { reportError } from '../../utils/error'

const userInfo = ref<any>(null)
const isAnonymous = ref(false)

/** 本地缓存的微信头像昵称（账号信息页可编辑，两页共用显示） */
const wechatProfile = ref<any>(getWechatProfile())

/** 头像：本地微信头像优先，其次服务端 metadata */
const avatarUrl = computed(() => wechatProfile.value?.avatarUrl || userInfo.value?.user_metadata?.avatarUrl || '')

/** 显示名：本地昵称 > 服务端昵称 / 脱敏信息 */
const displayName = computed(() => {
  const localNick = wechatProfile.value?.nickName
  if (localNick)
    return localNick
  return userInfo.value ? getUserName(userInfo.value) : '未登录'
})

/** 无头像时的文字占位 */
const avatarChar = computed(() => (displayName.value || '👤').charAt(0))

// 获取用户信息（onMounted 与 onShow 连续触发时做并发去重）
let loadingUserInfo = false
async function getUserInfo() {
  if (loadingUserInfo)
    return
  loadingUserInfo = true

  try {
    // 无会话 / 匿名会话时自动走微信 openid（失败兜底匿名）
    await ensureLogin()

    const { data } = await auth.getSession()
    const u: any = data?.session?.user

    if (u?.id) {
      userInfo.value = u
      isAnonymous.value = !!u.is_anonymous
      // 账号信息页可能更新了微信头像昵称，回到本页时同步刷新
      wechatProfile.value = getWechatProfile()
    }
    else {
      userInfo.value = null
      isAnonymous.value = false
    }
  }
  catch (error) {
    // 静默降级：本页是 tabBar 页，未登录也会走到这里，
    // 弹 toast 会变成「一进『我的』就报错」，页面本身已能显示未登录态
    reportError('获取用户信息', error, { toast: false })
    userInfo.value = null
    isAnonymous.value = false
  }
  finally {
    loadingUserInfo = false
  }
}

// 获取用户名
function getUserName(user: any) {
  if (!user || !user.user_metadata)
    return '未知'

  // 优先显示用户设置的昵称
  if (user.user_metadata.nickName)
    return user.user_metadata.nickName
  if (user.user_metadata.username)
    return user.user_metadata.username

  // 如果有手机号，显示脱敏的手机号
  if (user.phone) {
    const phone = user.phone.replace(/^\+86\s?/, '')
    if (phone.length === 11)
      return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
    return phone
  }

  // 如果有邮箱，显示脱敏的邮箱
  if (user.email) {
    const emailParts = user.email.split('@')
    if (emailParts.length === 2) {
      const username = emailParts[0]
      const domain = emailParts[1]
      if (username.length > 2)
        return `${username.substring(0, 2)}***@${domain}`
    }
    return user.email
  }

  // 匿名用户显示部分UID
  if (user.is_anonymous && user.id)
    return `匿名用户 (${user.id.substring(0, 8)}...)`

  return '未设置'
}

// ============================================================
// 页面跳转
// ============================================================

/** 点击顶部卡片：登录态进账号信息页，未登录进登录页 */
function goAccountOrLogin() {
  if (userInfo.value) {
    uni.navigateTo({
      url: '/pages/account/account-info',
    })
  }
  else {
    uni.navigateTo({
      url: '/pages/login/index',
    })
  }
}

/** 跳转订单列表，可按状态过滤 */
function goOrders(status: string) {
  uni.navigateTo({
    url: `/pages/order/order-list${status ? `?status=${status}` : ''}`,
  })
}

/** 跳转购物车（tabBar 页用 switchTab） */
function goCart() {
  uni.switchTab({
    url: '/pages/cart/cart',
  })
}

/** 跳转收货地址 */
function goAddress() {
  uni.navigateTo({
    url: '/pages/address/address-list',
  })
}

/** 跳转我的收藏 */
function goFavorites() {
  uni.navigateTo({
    url: '/pages/favorite/favorite',
  })
}

/** 打开云开发文档 */
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

onMounted(() => {
  getUserInfo()
})

// 回到本页时刷新（登录 / 绑定流程返回后保持最新）
onShow(() => {
  if (!userInfo.value || isAnonymous.value) {
    getUserInfo()
  }
})
</script>

<template>
  <view class="profile-page">
    <!-- ========== 顶部用户卡片 ========== -->
    <view class="user-card" @click="goAccountOrLogin">
      <view class="avatar-wrap">
        <image
          v-if="avatarUrl"
          class="avatar-img"
          :src="avatarUrl"
          mode="aspectFill"
        >
        </image>
        <view v-else class="avatar-text">{{ avatarChar }}</view>
      </view>
      <view class="user-meta">
        <text class="nickname">{{ userInfo ? displayName : '未登录' }}</text>
        <text class="user-hint">{{ userInfo ? (isAnonymous ? '游客身份，点击完善账号信息' : '点击查看账号信息与绑定') : '点击登录体验完整功能' }}</text>
      </view>
      <view class="card-action">
        {{ userInfo ? '账号信息 ›' : '去登录' }}
      </view>
    </view>

    <!-- ========== 我的订单 ========== -->
    <view class="card-section">
      <view class="section-header">
        <text class="section-title">我的订单</text>
        <text class="section-more" @click="goOrders('')">查看全部 ›</text>
      </view>
      <view class="order-entries">
        <view class="order-entry" @click="goOrders('')">
          <text class="entry-icon">📋</text>
          <text class="entry-name">全部订单</text>
        </view>
        <view class="order-entry" @click="goOrders('pending')">
          <text class="entry-icon">💳</text>
          <text class="entry-name">待支付</text>
        </view>
        <view class="order-entry" @click="goOrders('shipped')">
          <text class="entry-icon">📦</text>
          <text class="entry-name">已发货</text>
        </view>
        <view class="order-entry" @click="goOrders('completed')">
          <text class="entry-icon">✅</text>
          <text class="entry-name">已完成</text>
        </view>
      </view>
    </view>

    <!-- ========== 服务列表 ========== -->
    <view class="card-section menu-list">
      <view class="menu-item" @click="goAccountOrLogin">
        <text class="menu-icon">👤</text>
        <text class="menu-text">账号信息</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goAddress">
        <text class="menu-icon">📍</text>
        <text class="menu-text">收货地址</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goFavorites">
        <text class="menu-icon">❤️</text>
        <text class="menu-text">我的收藏</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goCart">
        <text class="menu-icon">🛒</text>
        <text class="menu-text">购物车</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="openDocs">
        <text class="menu-icon">📚</text>
        <text class="menu-text">云开发文档</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="bottom-space" />
  </view>
</template>

<style scoped lang="scss">
.profile-page {
  min-height: 100vh;
  background-color: $app-bg-page;
  padding-bottom: 40rpx;
}

/* ========== 顶部用户卡片 ========== */
.user-card {
  display: flex;
  align-items: center;
  padding: 48rpx 32rpx;
  background: $app-gradient-primary;
}

.avatar-wrap {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  border: 4rpx solid rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.avatar-text {
  font-size: 52rpx;
  color: #fff;
}

.user-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}

.nickname {
  font-size: 36rpx;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-hint {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-action {
  padding: 12rpx 28rpx;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 32rpx;
  font-size: 24rpx;
  color: #fff;
  flex-shrink: 0;
}

/* ========== 通用卡片 ========== */
.card-section {
  margin: 20rpx 24rpx;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $app-text-primary;
}

.section-more {
  font-size: 24rpx;
  color: $app-text-muted;
}

/* ========== 我的订单 ========== */
.order-entries {
  display: flex;
}

.order-entry {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.entry-icon {
  font-size: 48rpx;
}

.entry-name {
  font-size: 24rpx;
  color: $app-text-primary;
}

/* ========== 服务列表 ========== */
.menu-list {
  padding: 0 24rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 26rpx 0;
  border-bottom: 1rpx solid $app-border-color;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  font-size: 34rpx;
  margin-right: 20rpx;
}

.menu-text {
  flex: 1;
  font-size: 28rpx;
  color: $app-text-primary;
}

.menu-arrow {
  font-size: 32rpx;
  color: #ccc;
}

.bottom-space {
  height: 20rpx;
}
</style>
