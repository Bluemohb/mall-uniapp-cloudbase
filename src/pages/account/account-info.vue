<!--
  ============================================================
  👤 账号信息页（独立页，入口在个人中心的"账号信息"菜单）
  ============================================================
  将原"用户信息"页（个人中心）中的账号相关内容集中到此页：
  - 顶部用户卡片：头像 / 昵称 / 身份徽章
  - 游客 / 微信身份绑定引导卡片（bind-card）
  - 账号绑定入口：微信（微信端=openid+头像昵称填写）、手机号、邮箱
  - 账号信息：用户ID / 手机号 / 邮箱 / 创建时间 / 最后登录
  - 退出登录
  ============================================================
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { auth, ensureLogin, getUserIdentities, isMpWeixin, linkIdentityWithProvider, logout } from '../../utils/cloudbase'
import { getWechatProfile, setWechatProfile } from '../../utils/index'

const userInfo = ref<any>(null)
const session = ref<any>(null)
const isAnonymous = ref(false)
const identities = ref<any[]>([])
const isWeixin = ref(false)

/** 本地缓存的微信头像昵称（个人中心与本页共用显示，可在此编辑） */
const wechatProfile = ref<any>(getWechatProfile())

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

/** 脱敏后的手机号（已绑定且有号码时显示） */
const phoneDisplay = computed(() => {
  const raw = userInfo.value?.phone ? String(userInfo.value.phone) : ''
  const p = raw.replace(/^\+86\s?/, '')
  return p.length === 11 ? p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : raw
})

/** 已绑定的邮箱（userInfo.email 优先，身份源含 @ 形状兜底） */
const boundEmail = computed(() => {
  if (userInfo.value?.email)
    return String(userInfo.value.email)
  const found = identities.value.find((it: any) => identityValues(it).some(v => v.includes('@')))
  return found ? (found?.name || found?.id || '已绑定') : ''
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
    isWeixin.value = isMpWeixin()

    // 先确保已登录：App 启动时的自动登录是异步的，这里主动兜底一次
    await ensureLogin()

    const { data } = await auth.getSession()

    if (data && data.session) {
      session.value = data.session
      userInfo.value = data.session.user
      isAnonymous.value = !!data.session.user?.is_anonymous

      // 匿名会话 scope 为 anonymous，无权调用 getUserIdentities，直接跳过
      if (isAnonymous.value) {
        identities.value = []
      }
      else {
        try {
          const res = await getUserIdentities()
          identities.value = res?.identities || []
        }
        catch (e) {
          console.warn('查询身份源失败:', e)
          identities.value = []
        }
      }

      // 回页 / 绑定后刷新本地微信资料
      wechatProfile.value = getWechatProfile()
    }
    else {
      session.value = null
      userInfo.value = null
      isAnonymous.value = false
      identities.value = []
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
 * 兼容 Date 对象 / 秒级 / 毫秒级数字
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
 * 本环境 openid 静默登录不回写 last_sign_in_at，退到第三级：
 * 用「当前会话 token 的签发时刻」近似 = expires_at − expires_in
 */
const lastLoginAt = computed(() => {
  const fromUser = userInfo.value?.last_sign_in_at
    || identities.value?.[0]?.last_sign_in_at
    || identities.value?.[0]?.created_at
  if (fromUser)
    return fromUser

  const atMs = toTimestampMs(session.value?.expires_at)
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

  // 已绑定微信但没设置昵称（openid 登录不会带昵称）：用 uid 后 4 位兜底
  if (user.id && hasBoundWechat.value)
    return `微信用户 ${String(user.id).slice(-4)}`

  return '未设置'
}

// 格式化日期
function formatDate(timestamp: number | string) {
  if (!timestamp)
    return '未知'

  try {
    let date: Date
    if (timestamp.toString().length === 10)
      date = new Date(timestamp * 1000)
    else
      date = new Date(timestamp)

    if (isNaN(date.getTime()))
      return '无效日期'

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

// ============================================================
// 跳转与绑定操作
// ============================================================

function goToLogin() {
  uni.navigateTo({
    url: '/pages/login/index',
  })
}

/** 退出登录（原个人中心按钮迁移至此） */
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

/** 绑定手机号入口 */
function goPhoneBinding() {
  if (hasBoundPhone.value) {
    uni.showToast({
      title: phoneDisplay.value ? `当前已绑定 ${phoneDisplay.value}` : '当前已绑定手机号',
      icon: 'none',
    })
    return
  }
  // 匿名用户：先转正（登录页提供手机号一键授权 / 验证码两种绑定路径）
  // 正式用户：补绑手机号走验证码登录页
  uni.navigateTo({
    url: isAnonymous.value ? '/pages/login/index' : '/pages/login/phone-login',
  })
}

/** 绑定邮箱入口 */
function goEmailBinding() {
  if (boundEmail.value) {
    uni.showToast({
      title: '当前已绑定邮箱',
      icon: 'none',
    })
    return
  }
  uni.navigateTo({
    url: '/pages/login/email-login',
  })
}

/** 绑定微信入口 */
async function handleWechatRow() {
  // 已绑定：微信小程序端可继续完善/更换微信头像昵称
  if (hasBoundWechat.value) {
    if (isWeixin.value) {
      openWechatProfileSheet()
    }
    else {
      uni.showToast({
        title: '已绑定微信账号',
        icon: 'success',
      })
    }
    return
  }

  // 非微信端（H5/App）：OAuth 跳转微信授权页绑定
  if (!isWeixin.value) {
    uni.showLoading({ title: '跳转微信授权...' })
    try {
      await linkIdentityWithProvider('wechat')
      uni.hideLoading()
      // OAuth 绑定结果通过 onAuthStateChange 事件通知
    }
    catch (error: any) {
      uni.hideLoading()
      uni.showToast({
        title: error.message || '绑定失败，请重试',
        icon: 'none',
      })
    }
    return
  }

  // 微信小程序端：openid 静默绑定（把游客身份升级为微信正式用户，uid 不变）
  uni.showLoading({ title: '正在绑定微信...' })
  try {
    await ensureLogin()
    await getUserInfo()
    uni.hideLoading()
    if (hasBoundWechat.value) {
      uni.showToast({ title: '已绑定微信', icon: 'success' })
      // 绑定成功后可顺手完善头像昵称
      setTimeout(() => openWechatProfileSheet(), 600)
    }
    else {
      uni.showToast({ title: '绑定失败，请稍后重试', icon: 'none' })
    }
  }
  catch (error: any) {
    uni.hideLoading()
    uni.showToast({
      title: error.message || '绑定失败，请重试',
      icon: 'none',
    })
  }
}

// ============================================================
// 微信头像 / 昵称填写（chooseAvatar + nickname，仅微信小程序）
// ============================================================

const showProfileSheet = ref(false)
const sheetAvatar = ref('')
const sheetNick = ref('')

function openWechatProfileSheet() {
  sheetAvatar.value = avatarUrl.value
  sheetNick.value = displayName.value
  showProfileSheet.value = true
}

function closeProfileSheet() {
  showProfileSheet.value = false
}

function onChooseAvatar(e: any) {
  // e.detail.avatarUrl 为本地临时路径；真机长期展示需上传云存储后替换为 https 地址
  sheetAvatar.value = e.detail.avatarUrl || ''
}

function saveWechatProfile() {
  const nick = sheetNick.value.trim()
  const profile: any = { avatarUrl: sheetAvatar.value }
  if (nick)
    profile.nickName = nick
  setWechatProfile(profile)
  wechatProfile.value = profile
  showProfileSheet.value = false
  uni.showToast({
    title: '已保存',
    icon: 'success',
  })
}

// 页面每次显示都刷新（从登录/绑定流程返回后状态保持最新）
onShow(() => {
  getUserInfo()
})
</script>

<template>
  <view class="account-page">
    <!-- ========== 顶部用户卡片（头像 / 昵称 / 身份徽章） ========== -->
    <view class="user-card">
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
        <view class="identity-badge" :class="{ anon: isAnonymous }">
          {{ identityLabel }}
        </view>
      </view>
      <view v-if="!userInfo" class="card-action" @click="goToLogin">去登录</view>
    </view>

    <!-- ========== 游客 / 微信身份绑定引导卡片 ========== -->
    <view v-if="userInfo && isAnonymous" class="bind-card" @click="goToLogin">
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

    <!-- ========== 账号绑定入口 ========== -->
    <view v-if="userInfo" class="card-section">
      <view class="section-header">
        <text class="section-title">账号绑定</text>
      </view>
      <view class="bind-row" @click="handleWechatRow">
        <text class="bind-row-icon">💬</text>
        <text class="bind-row-name">绑定微信</text>
        <view class="bind-row-right">
          <text v-if="hasBoundWechat" class="bind-row-value bound">已绑定</text>
          <text v-else class="bind-row-value">未绑定</text>
          <text class="bind-row-arrow">›</text>
        </view>
      </view>
      <view class="bind-row" @click="goPhoneBinding">
        <text class="bind-row-icon">📱</text>
        <text class="bind-row-name">绑定手机号</text>
        <view class="bind-row-right">
          <text v-if="hasBoundPhone" class="bind-row-value bound">{{ phoneDisplay || '已绑定' }}</text>
          <text v-else class="bind-row-value">未绑定</text>
          <text class="bind-row-arrow">›</text>
        </view>
      </view>
      <view class="bind-row" @click="goEmailBinding">
        <text class="bind-row-icon">📧</text>
        <text class="bind-row-name">绑定邮箱</text>
        <view class="bind-row-right">
          <text v-if="boundEmail" class="bind-row-value bound">{{ boundEmail }}</text>
          <text v-else class="bind-row-value">未绑定</text>
          <text class="bind-row-arrow">›</text>
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
        <view v-if="hasBoundPhone" class="info-row">
          <text class="info-label">手机号</text>
          <text class="info-value">{{ phoneDisplay || '已绑定' }}</text>
        </view>
        <view v-if="boundEmail" class="info-row">
          <text class="info-label">邮箱</text>
          <text class="info-value">{{ boundEmail }}</text>
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

    <!-- ========== 退出登录 ========== -->
    <view v-if="userInfo" class="logout-btn" @click="handleLogout">
      退出登录
    </view>

    <view class="bottom-space" />

    <!-- ========== 微信头像昵称填写弹层（仅微信小程序） ========== -->
    <view v-if="showProfileSheet" class="sheet-mask" @click="closeProfileSheet">
      <view class="sheet-panel" @click.stop>
        <view class="sheet-header">
          <text class="sheet-title">微信头像与昵称</text>
          <text class="sheet-close" @click="closeProfileSheet">✕</text>
        </view>
        <text class="sheet-tip">点击下方按钮获取微信头像，昵称将展示在个人中心</text>

        <button
          class="avatar-picker"
          open-type="chooseAvatar"
          @chooseavatar="onChooseAvatar"
        >
          <image v-if="sheetAvatar" class="picker-img" :src="sheetAvatar" mode="aspectFill"></image>
          <text v-else class="picker-placeholder">选择头像</text>
        </button>

        <view class="nick-input-wrap">
          <input
            v-model="sheetNick"
            class="nick-input"
            type="nickname"
            placeholder="请输入昵称"
            maxlength="20"
          >
        </view>

        <view class="sheet-actions">
          <view class="sheet-btn cancel" @click="closeProfileSheet">取消</view>
          <view class="sheet-btn save" @click="saveWechatProfile">保存</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.account-page {
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
  margin-bottom: 12rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

/* ========== 账号绑定入口 ========== */
.bind-row {
  display: flex;
  align-items: center;
  padding: 26rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.bind-row:last-child {
  border-bottom: none;
}

.bind-row:active {
  background: #fafafa;
}

.bind-row-icon {
  font-size: 34rpx;
  margin-right: 20rpx;
}

.bind-row-name {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.bind-row-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.bind-row-value {
  font-size: 26rpx;
  color: #bbb;
  max-width: 340rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bind-row-value.bound {
  color: #52c41a;
}

.bind-row-arrow {
  font-size: 32rpx;
  color: #ccc;
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

/* ========== 微信头像昵称弹层 ========== */
.sheet-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 999;
}

.sheet-panel {
  width: 100%;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.sheet-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.sheet-close {
  font-size: 32rpx;
  color: #999;
  padding: 0 8rpx;
}

.sheet-tip {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-bottom: 32rpx;
}

.avatar-picker {
  width: 140rpx;
  height: 140rpx;
  margin: 0 auto 32rpx;
  border-radius: 50%;
  overflow: hidden;
  background: #f0f2f5;
  border: none;
  padding: 0;
  line-height: 140rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-picker::after {
  border: none;
}

.picker-img {
  width: 100%;
  height: 100%;
}

.picker-placeholder {
  font-size: 24rpx;
  color: #999;
}

.nick-input-wrap {
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  padding: 0 24rpx;
  margin-bottom: 40rpx;
  background: #fafafa;
}

.nick-input {
  height: 88rpx;
  font-size: 30rpx;
}

.sheet-actions {
  display: flex;
  gap: 20rpx;
}

.sheet-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.sheet-btn.cancel {
  background: #f0f0f0;
  color: #666;
}

.sheet-btn.save {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}
</style>
