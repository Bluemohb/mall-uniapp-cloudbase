<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { auth, ensureLogin, getUserIdentities, isMpWeixin, linkIdentityWithProvider, logout } from '../../utils/cloudbase'

const userInfo = ref<any>(null)
const session = ref<any>(null)
const isAnonymous = ref(false)
const identities = ref<any[]>([])
const isWeixin = ref(false)

/**
 * 微信小程序的 AppID 格式：wx + 16 位十六进制（如 wxcf60813f02eccf5c）
 * 本环境 SDK 返回的身份源形如 { id: 'wxcf60813f02eccf5c', name: '...', bind: true }，
 * 并没有 provider 字段，所以这里直接用 id / name 的形状来判断。
 */
const WX_APPID_RE = /^wx[0-9a-f]{16}$/i

/** 取身份源上所有可能带类型信息的字段值 */
function identityValues(item: any): string[] {
  return [item?.provider, item?.id, item?.name, item?.provider_name]
    .map(v => String(v ?? '').trim())
    .filter(Boolean)
}

/** 判断某个身份源是否为微信（OpenID 登录 / AppID 形态） */
function isWechatIdentity(item: any) {
  return identityValues(item).some((v) => {
    const s = v.toLowerCase()
    return WX_APPID_RE.test(s) || s === 'wx' || s.includes('wechat') || s.includes('openid')
  })
}

/** 判断某个身份源是否为手机号 */
function isPhoneIdentity(item: any) {
  return identityValues(item).some(v => v.toLowerCase().includes('phone'))
}

/** 身份徽章文案 */
const identityLabel = computed(() => {
  if (isAnonymous.value)
    return '匿名用户'
  if (hasBoundWechat.value)
    return '微信用户'
  if (hasBoundPhone.value)
    return '手机号用户'
  if (userInfo.value?.email)
    return '邮箱用户'
  return '正式用户'
})

/** 是否已绑定手机号 */
const hasBoundPhone = computed(() => {
  if (userInfo.value?.phone)
    return true
  return identities.value.some(isPhoneIdentity)
})

/**
 * 是否已绑定微信（openid 登录本身即微信身份）
 * 兜底：小程序端 openid 静默登录成功 + 存在身份源 = 微信身份
 * （本环境身份源不含 provider 字段，只能靠 AppID 形状和端环境来判定）
 */
const hasBoundWechat = computed(() => {
  if (identities.value.some(isWechatIdentity))
    return true
  return isWeixin.value && !isAnonymous.value && identities.value.length > 0
})

// 获取用户信息
// onMounted 与 onShow 可能连续触发，这里做并发去重，避免重复拉取（日志里出现两份）
let loadingUserInfo = false
async function getUserInfo() {
  if (loadingUserInfo)
    return
  loadingUserInfo = true

  try {
    isWeixin.value = isMpWeixin()

    // 先确保已登录：App 启动时的自动登录是异步的，真机网络较慢时
    // 页面可能先于登录完成读取会话，导致误判为"未登录"。
    // 这里主动兜底：已有会话直接通过，无会话则触发登录（openid → 匿名兜底）。
    await ensureLogin()

    const { data } = await auth.getSession()

    if (data && data.session) {
      session.value = data.session
      userInfo.value = data.session.user
      isAnonymous.value = !!data.session.user?.is_anonymous
      console.log('用户登录状态loginState:', data.session)
      console.log('完整用户信息loginState.user:', data.session.user)

      // 查询已绑定的身份源（微信 / 手机号 / 邮箱等）
      // 注意：匿名会话 scope 为 anonymous，无权调用 getUserIdentities（会报
      // "user scope want [ user ], but got [ anonymous ]"），匿名用户直接跳过。
      if (isAnonymous.value) {
        identities.value = []
      }
      else {
        try {
          const res = await getUserIdentities()
          identities.value = res?.identities || []
          // 转成普通对象再打印，否则控制台里显示成 Proxy，看不清 provider 字段
          console.log('已绑定身份源:', JSON.parse(JSON.stringify(identities.value)))
        }
        catch (e) {
          console.warn('查询身份源失败:', e)
          identities.value = []
        }
      }
    }
    else {
      session.value = null
      userInfo.value = null
      isAnonymous.value = false
      identities.value = []
      console.log('用户未登录')
    }
  }
  catch (error) {
    console.error('获取用户信息失败:', error)
    session.value = null
    userInfo.value = null
    isAnonymous.value = false
  }
  finally {
    loadingUserInfo = false
  }
}

/**
 * 把 SDK 给的时间归一化为毫秒时间戳
 * 实测本环境 session.expires_at 是 Date 对象（Tue Sep 01 2026 06:29:27 GMT+0800），
 * 其他版本 / 其他端可能是秒级或毫秒级数字，这里三种都兼容。
 */
function toTimestampMs(value: any): number {
  if (!value)
    return 0
  if (value instanceof Date)
    return value.getTime()
  const n = Number(value)
  if (!n || isNaN(n))
    return 0
  return n > 1e12 ? n : n * 1000
}

/**
 * 最后登录时间
 * 本环境：openid 静默登录不回写 user.last_sign_in_at，身份源里也没有时间字段，
 * 因此退到第三级 —— 用「当前会话 token 的签发时刻」近似：
 * token 签发时刻 = expires_at（过期时刻） − expires_in（有效期 7200s）
 */
const lastLoginAt = computed(() => {
  const fromUser = userInfo.value?.last_sign_in_at
    || identities.value?.[0]?.last_sign_in_at
    || identities.value?.[0]?.created_at
  if (fromUser)
    return fromUser

  const atMs = toTimestampMs(session.value?.expires_at)
  // expires_in 是「时长」而非时刻，恒为秒（7200），单独换算
  const expiresIn = Number(session.value?.expires_in)
  if (atMs && expiresIn)
    return atMs - expiresIn * 1000

  return ''
})

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
    const phone = user.phone.replace(/^\+86\s?/, '') // 去掉+86前缀
    if (phone.length === 11) {
      return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
    }
    return phone
  }

  // 如果有邮箱，显示脱敏的邮箱
  if (user.email) {
    const emailParts = user.email.split('@')
    if (emailParts.length === 2) {
      const username = emailParts[0]
      const domain = emailParts[1]
      if (username.length > 2) {
        return `${username.substring(0, 2)}***@${domain}`
      }
    }
    return user.email
  }

  // 匿名用户显示部分UID
  if (user.is_anonymous && user.id) {
    return `匿名用户 (${user.id.substring(0, 8)}...)`
  }

  // 已绑定微信但没设置昵称（openid 登录不会带昵称）：用 uid 后 4 位兜底，避免显示"未设置"
  if (user.id && hasBoundWechat.value) {
    return `微信用户 ${String(user.id).slice(-4)}`
  }

  return '未设置'
}

// 格式化日期（支持秒级时间戳、毫秒时间戳、ISO 字符串）
function formatDate(timestamp: number | string) {
  if (!timestamp)
    return '未知'

  try {
    // 处理不同的时间戳格式
    let date: Date

    // 如果是秒级时间戳，转换为毫秒
    if (timestamp.toString().length === 10) {
      date = new Date(timestamp * 1000)
    }
    else {
      date = new Date(timestamp)
    }

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return '无效日期'
    }

    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }
  catch (error) {
    console.error('日期格式化失败:', error)
    return '格式错误'
  }
}

// 退出登录
async function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await logout()
          session.value = null
          userInfo.value = null
          uni.showToast({
            title: '已退出登录',
            icon: 'success',
          })
          uni.switchTab({
            url: '/pages/index/index',
          })
        }
        catch (error: any) {
          uni.showToast({
            title: error.message || '退出失败',
            icon: 'none',
          })
        }
      }
    },
  })
}

// ============================================================
// 个人中心：订单与服务入口（第6步新增）
// ============================================================

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

// 跳转到登录页面
function goToLogin() {
  uni.navigateTo({
    url: '/pages/login/index',
  })
}

// 匿名用户：跳登录页绑定手机号/微信（uid 不变，数据自动继承）
function goBindIdentity() {
  uni.navigateTo({
    url: '/pages/login/index',
  })
}

// 非微信端（H5/Web）：OAuth 绑定微信账号到当前账号（匿名转正，uid 不变）
async function bindWechat() {
  uni.showLoading({ title: '跳转微信授权...' })
  try {
    await linkIdentityWithProvider('wechat')
    // OAuth 跳转后由 SDK 自动处理回调，绑定结果通过 onAuthStateChange 事件通知
    uni.hideLoading()
  }
  catch (error: any) {
    uni.hideLoading()
    uni.showToast({
      title: error.message || '绑定失败，请重试',
      icon: 'none',
    })
  }
}

onMounted(() => {
  getUserInfo()
})

// 从登录页返回、或登录异步完成后回到本页时，
// 若之前渲染的是"匿名用户"（或还没拿到信息），重新拉取一次，避免停留在旧状态
onShow(() => {
  if (!userInfo.value || isAnonymous.value) {
    getUserInfo()
  }
})
</script>

<template>
  <view class="profile-page">
    <!-- ========== 顶部用户卡片 ========== -->
    <view class="user-card">
      <view class="avatar">
        {{ userInfo ? getUserName(userInfo).charAt(0) : '👤' }}
      </view>
      <view class="user-meta">
        <text class="nickname">{{ userInfo ? getUserName(userInfo) : '未登录' }}</text>
        <view class="identity-badge" :class="{ anon: isAnonymous }">
          {{ identityLabel }}
        </view>
      </view>
      <view v-if="!userInfo" class="card-action" @click="goToLogin">去登录</view>
    </view>

    <!-- ========== 身份绑定提示 ========== -->
    <view v-if="userInfo && isAnonymous" class="bind-card" @click="goBindIdentity">
      <view class="bind-text">
        <text class="bind-title">当前为游客身份</text>
        <text class="bind-desc">绑定手机号 / 微信，订单与地址永久保留</text>
      </view>
      <text class="bind-arrow">立即绑定 ›</text>
    </view>

    <view v-else-if="userInfo && identityLabel === '微信用户'" class="bind-card stable">
      <view class="bind-text">
        <text class="bind-title">✅ 已通过微信登录</text>
        <text class="bind-desc">身份稳定，清缓存 / 换设备订单数据不丢失</text>
      </view>
    </view>

    <view v-else-if="userInfo && !isWeixin && !hasBoundWechat" class="bind-card" @click="bindWechat">
      <view class="bind-text">
        <text class="bind-title">绑定微信账号</text>
        <text class="bind-desc">绑定后可用微信登录，当前数据自动保留</text>
      </view>
      <text class="bind-arrow">去绑定 ›</text>
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

    <!-- ========== 账号信息 ========== -->
    <view v-if="userInfo" class="card-section">
      <view class="section-header">
        <text class="section-title">账号信息</text>
      </view>
      <view class="info-list">
        <view class="info-row">
          <text class="info-label">用户ID</text>
          <text class="info-value">{{ userInfo.id || '未知' }}</text>
        </view>
        <view v-if="userInfo.phone" class="info-row">
          <text class="info-label">手机号</text>
          <text class="info-value">{{ userInfo.phone }}</text>
        </view>
        <view v-if="userInfo.email" class="info-row">
          <text class="info-label">邮箱</text>
          <text class="info-value">{{ userInfo.email }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">创建时间</text>
          <text class="info-value">{{ isAnonymous ? '绑定正式身份后可见' : formatDate(userInfo.created_at) }}</text>
        </view>
        <view v-if="!isAnonymous && lastLoginAt" class="info-row">
          <text class="info-label">最后登录</text>
          <text class="info-value">{{ formatDate(lastLoginAt) }}</text>
        </view>
      </view>
    </view>

    <!-- ========== 服务列表 ========== -->
    <view class="card-section menu-list">
      <view class="menu-item" @click="goAddress">
        <text class="menu-icon">📍</text>
        <text class="menu-text">收货地址</text>
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

    <!-- ========== 退出登录 ========== -->
    <view v-if="userInfo" class="logout-btn" @click="handleLogout">
      退出登录
    </view>

    <view class="bottom-space" />
  </view>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 40rpx;
}

/* ========== 顶部用户卡片 ========== */
.user-card {
  display: flex;
  align-items: center;
  padding: 48rpx 32rpx;
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  border: 4rpx solid rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 52rpx;
  color: #fff;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.user-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
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

.card-action {
  padding: 12rpx 32rpx;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 32rpx;
  font-size: 26rpx;
  color: #fff;
  flex-shrink: 0;
}

/* ========== 身份徽章 ========== */
.identity-badge {
  align-self: flex-start;
  padding: 6rpx 20rpx;
  border-radius: 30rpx;
  font-size: 22rpx;
  color: #667eea;
  background: rgba(255, 255, 255, 0.9);
}

.identity-badge.anon {
  color: #888;
  background: rgba(255, 255, 255, 0.7);
}

/* ========== 绑定引导卡片 ========== */
.bind-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20rpx 24rpx;
  padding: 24rpx 28rpx;
  border-radius: 16rpx;
  background: #fff7e6;
  border: 2rpx solid #ffd591;
}

.bind-card.stable {
  background: #f6ffed;
  border-color: #b7eb8f;
}

.bind-text {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  flex: 1;
}

.bind-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.bind-desc {
  font-size: 24rpx;
  color: #888;
  line-height: 1.4;
}

.bind-arrow {
  font-size: 26rpx;
  color: #e6a23c;
  flex-shrink: 0;
}

.bind-card.stable .bind-arrow {
  display: none;
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
  color: #333;
}

.section-more {
  font-size: 24rpx;
  color: #999;
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
  color: #333;
}

/* ========== 账号信息 ========== */
.info-list {
  display: flex;
  flex-direction: column;
}

.info-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
  gap: 24rpx;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 26rpx;
  color: #999;
  flex-shrink: 0;
}

.info-value {
  font-size: 26rpx;
  color: #333;
  word-break: break-all;
  text-align: right;
  line-height: 1.4;
}

/* ========== 服务列表 ========== */
.menu-list {
  padding: 0 24rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 26rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
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
  color: #333;
}

.menu-arrow {
  font-size: 32rpx;
  color: #ccc;
}

/* ========== 退出登录 ========== */
.logout-btn {
  margin: 30rpx 24rpx 0;
  height: 88rpx;
  line-height: 88rpx;
  background: #ff4757;
  color: white;
  text-align: center;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.logout-btn:active {
  background: #ff3838;
}

.bottom-space {
  height: 20rpx;
}
</style>
