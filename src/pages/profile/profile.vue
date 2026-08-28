<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { auth, ensureLogin, getUserIdentities, isMpWeixin, linkIdentityWithProvider, logout } from '../../utils/cloudbase'

const userInfo = ref<any>(null)
const session = ref<any>(null)
const isAnonymous = ref(false)
const identities = ref<any[]>([])
const isWeixin = ref(false)

/** 身份徽章文案 */
const identityLabel = computed(() => {
  if (isAnonymous.value)
    return '匿名用户'
  const providers = identities.value.map((i: any) => i.provider)
  if (providers.includes('wechat') || providers.includes('openid'))
    return '微信用户'
  if (providers.includes('phone') || userInfo.value?.phone)
    return '手机号用户'
  if (userInfo.value?.email)
    return '邮箱用户'
  return '正式用户'
})

/** 是否已绑定手机号 */
const hasBoundPhone = computed(() => {
  if (userInfo.value?.phone)
    return true
  return identities.value.some((i: any) => i.provider === 'phone')
})

/** 是否已绑定微信（openid 登录本身即微信身份） */
const hasBoundWechat = computed(() => {
  const providers = identities.value.map((i: any) => i.provider)
  return providers.includes('wechat') || providers.includes('openid')
})

// 获取用户信息
async function getUserInfo() {
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
          console.log('已绑定身份源:', identities.value)
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

  return '未设置'
}

// 格式化日期
function formatDate(timestamp: number) {
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
          uni.navigateTo({
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
</script>

<template>
  <view class="profile-container">
    <view class="profile-header">
      <text class="title">用户信息</text>
    </view>

    <view class="profile-content">
      <view v-if="userInfo" class="user-info">
        <!-- 身份徽章 -->
        <view class="identity-badge" :class="{ anon: isAnonymous }">
          {{ identityLabel }}
        </view>

        <!-- 匿名用户：引导绑定正式身份（uid 不变，数据自动继承） -->
        <view v-if="isAnonymous" class="bind-card">
          <text class="bind-title">当前为游客身份</text>
          <text class="bind-desc">绑定手机号 / 微信后，订单、地址将永久保留，换设备也不丢失</text>
          <button class="bind-btn" @click="goBindIdentity">
            立即绑定（保留当前数据）
          </button>
        </view>

        <!-- 微信正式用户：提示身份稳定 -->
        <view v-else-if="identityLabel === '微信用户'" class="bind-card stable">
          <text class="bind-title">✅ 已通过微信登录</text>
          <text class="bind-desc">账号与微信绑定，身份稳定，清缓存 / 换设备均不会丢失订单数据</text>
        </view>

        <!-- 非微信端（H5/App）：未绑定微信时提供 OAuth 绑定（匿名转正） -->
        <view v-else-if="!isWeixin && !hasBoundWechat" class="bind-card">
          <text class="bind-title">绑定微信账号</text>
          <text class="bind-desc">绑定后可用微信登录，当前数据自动保留</text>
          <button class="bind-btn" @click="bindWechat">
            绑定微信
          </button>
        </view>

        <view class="info-item">
          <text class="label">用户ID:</text>
          <text class="value">{{ userInfo.id || '未知' }}</text>
        </view>
        <!-- <view class="info-item">
          <text class="label">登录类型:</text>
          <text class="value">{{ session.scope }}</text>
        </view> -->
        <view v-if="userInfo.phone" class="info-item">
          <text class="label">手机号:</text>
          <text class="value">{{ userInfo.phone }}</text>
        </view>
        <view v-if="userInfo.email" class="info-item">
          <text class="label">邮箱:</text>
          <text class="value">{{ userInfo.email }}</text>
        </view>
        <view class="info-item">
          <text class="label">用户名:</text>
          <text class="value">{{ getUserName(userInfo) }}</text>
        </view>
        <view class="info-item">
          <text class="label">创建时间:</text>
          <text class="value">{{ isAnonymous ? '绑定正式身份后可见' : formatDate(userInfo.created_at) }}</text>
        </view>
        <view class="info-item">
          <text class="label">最后登录:</text>
          <text class="value">{{ isAnonymous ? '绑定正式身份后可见' : formatDate(userInfo.last_sign_in_at) }}</text>
        </view>

        <button class="logout-btn" @click="handleLogout">
          退出登录
        </button>
      </view>

      <view v-else class="no-user">
        <text class="no-user-text">未登录</text>
        <button class="login-btn" @click="goToLogin">
          去登录
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.profile-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx;
}

.profile-header {
  text-align: center;
  margin-bottom: 60rpx;
}

.title {
  font-size: 48rpx;
  font-weight: bold;
  color: white;
}

.profile-content {
  background: white;
  border-radius: 20rpx;
  padding: 40rpx;
  box-shadow: 0 20rpx 40rpx rgba(0, 0, 0, 0.1);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

/* ========== 身份徽章 ========== */
.identity-badge {
  display: inline-block;
  align-self: flex-start;
  padding: 10rpx 24rpx;
  border-radius: 30rpx;
  font-size: 24rpx;
  color: #fff;
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.identity-badge.anon {
  background: #999;
}

/* ========== 绑定引导卡片 ========== */
.bind-card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 28rpx;
  margin-top: 10rpx;
  border-radius: 16rpx;
  background: #fff7e6;
  border: 2rpx solid #ffd591;
}

.bind-card.stable {
  background: #f6ffed;
  border-color: #b7eb8f;
}

.bind-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.bind-desc {
  font-size: 26rpx;
  color: #666;
  line-height: 1.5;
}

.bind-btn {
  margin-top: 12rpx;
  padding: 0 30rpx;
  height: 72rpx;
  line-height: 72rpx;
  font-size: 28rpx;
  color: #fff;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  border-radius: 36rpx;
}

.bind-btn:active {
  opacity: 0.85;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.info-item:last-of-type {
  border-bottom: none;
}

.label {
  font-size: 28rpx;
  color: #666;
  font-weight: 500;
}

.value {
  font-size: 32rpx;
  color: #333;
  word-break: break-all;
  line-height: 1.4;
}

.logout-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #ff4757;
  color: white;
  border: none;
  border-radius: 12rpx;
  font-size: 32rpx;
  font-weight: bold;
  margin-top: 40rpx;
}

.logout-btn:active {
  background: #ff3838;
}

.no-user {
  text-align: center;
  padding: 60rpx 20rpx;
}

.no-user-text {
  font-size: 32rpx;
  color: #999;
  display: block;
  margin-bottom: 40rpx;
}

.login-btn {
  width: 200rpx;
  height: 88rpx;
  line-height: 88rpx;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 12rpx;
  font-size: 28rpx;
  font-weight: bold;
}

.login-btn:active {
  background: #5a6fd8;
}
</style>
