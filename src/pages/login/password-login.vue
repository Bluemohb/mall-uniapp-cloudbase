<script setup lang="ts">
import { computed, ref } from 'vue'
import { signInWithPassword } from '../../utils/cloudbase'

// 响应式数据
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const usernameType = ref('')

// 计算属性
const canLogin = computed(() => {
  return username.value.trim().length >= 3 && password.value.length >= 6
})

// 判断用户名类型
function detectUsernameType(value: string) {
  if (!value)
    return ''

  if (/^1[3-9]\d{9}$/.test(value)) {
    return '手机号'
  }
  else if (/^\+\d{1,3}\s\d{4,20}$/.test(value)) {
    return '国际手机号'
  }
  else if (/^[\w.%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) {
    return '邮箱'
  }
  else if (/^\w{3,20}$/.test(value)) {
    return '用户名'
  }
  else if (value.length >= 3) {
    return '用户名'
  }

  return ''
}

// 获取输入提示
function getInputHint() {
  if (!username.value) {
    return '支持以下格式：手机号、邮箱地址、用户名'
  }

  switch (usernameType.value) {
    case '手机号':
      return '✅ 识别为手机号'
    case '国际手机号':
      return '✅ 识别为国际手机号'
    case '邮箱':
      return '✅ 识别为邮箱地址'
    case '用户名':
      return '✅ 识别为用户名'
    default:
      return '请输入有效的手机号、邮箱或用户名'
  }
}

// 用户名输入事件
function onUsernameInput() {
  usernameType.value = detectUsernameType(username.value.trim())
}

// 切换密码显示
function togglePassword() {
  showPassword.value = !showPassword.value
}

// 处理登录
async function handleLogin() {
  if (!canLogin.value) {
    uni.showToast({
      title: '请完善登录信息',
      icon: 'none',
    })
    return
  }

  try {
    loading.value = true
    uni.showLoading({
      title: '登录中...',
    })

    const loginResult = await signInWithPassword(username.value.trim(), password.value)

    uni.showToast({
      title: '登录成功',
      icon: 'success',
    })

    // 延迟跳转到首页
    setTimeout(() => {
      uni.reLaunch({
        url: '/pages/index/index',
      })
    }, 1500)
  }
  catch (error: any) {
    console.error('登录失败:', error)

    // 显示友好的错误信息
    let errorMessage = '登录失败'
    if (error.message) {
      errorMessage = error.message
    }

    uni.showToast({
      title: errorMessage,
      icon: 'none',
      duration: 3000,
    })
  }
  finally {
    loading.value = false
    uni.hideLoading()
  }
}

// 跳转到验证码登录
function goToCodeLogin() {
  uni.navigateBack()
}

// 返回
function goBack() {
  uni.navigateBack()
}
</script>

<template>
  <view class="login-container">
    <view class="login-header">
      <text class="title">密码登录</text>
      <text class="subtitle">支持手机号/邮箱/用户名 + 密码登录</text>
    </view>

    <view class="login-form">
      <!-- 用户名输入提示 -->
      <view class="input-hint">
        <text class="hint-text">{{ getInputHint() }}</text>
      </view>

      <!-- 账号输入 -->
      <view class="input-group">
        <text class="label">账号</text>
        <input
          v-model="username"
          class="input-field"
          type="text"
          placeholder="请输入手机号/邮箱/用户名"
          @input="onUsernameInput"
        >
        <view v-if="usernameType" class="input-type-indicator">
          <text class="type-text">{{ usernameType }}</text>
        </view>
      </view>

      <!-- 密码输入 -->
      <view class="input-group">
        <text class="label">密码</text>
        <view class="password-input-container">
          <input
            v-model="password"
            class="input-field password-input"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
          >
          <button class="toggle-password-btn" @click="togglePassword">
            {{ showPassword ? '🙈' : '👁️' }}
          </button>
        </view>
      </view>

      <!-- 登录按钮 -->
      <button
        class="login-btn"
        :disabled="!canLogin"
        @click="handleLogin"
      >
        {{ loading ? '登录中...' : '登录' }}
      </button>

      <!-- 快捷链接 -->
      <view class="quick-links">
        <text class="link-text" @click="goToCodeLogin">验证码登录</text>
        <text class="link-text" @click="goBack">返回</text>
      </view>
    </view>
  </view>
  <show-captcha />
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 60rpx 40rpx;
  box-sizing: border-box;
}

.login-header {
  text-align: center;
  margin-bottom: 80rpx;
}

.title {
  font-size: 48rpx;
  font-weight: bold;
  color: white;
  display: block;
  margin-bottom: 20rpx;
}

.subtitle {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.8);
  display: block;
  line-height: 1.4;
}

.login-form {
  background: white;
  border-radius: 20rpx;
  padding: 60rpx 40rpx;
  box-shadow: 0 20rpx 40rpx rgba(0, 0, 0, 0.1);
}

.input-hint {
  margin-bottom: 30rpx;
  padding: 20rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  border-left: 6rpx solid #667eea;
}

.hint-text {
  font-size: 24rpx;
  color: #666;
  line-height: 1.4;
}

.input-group {
  margin-bottom: 40rpx;
  position: relative;
}

.label {
  font-size: 28rpx;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
  font-weight: 500;
}

.input-field {
  width: 100%;
  height: 88rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 32rpx;
  box-sizing: border-box;
  background: #fafafa;
  transition: all 0.3s ease;
}

.input-field:focus {
  border-color: #667eea;
  background: white;
  box-shadow: 0 0 0 4rpx rgba(102, 126, 234, 0.1);
}

.input-type-indicator {
  position: absolute;
  right: 20rpx;
  top: 50%;
  transform: translateY(-50%);
  margin-top: 14rpx;
}

.type-text {
  font-size: 20rpx;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 500;
}

.password-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  flex: 1;
  padding-right: 100rpx;
}

.toggle-password-btn {
  position: absolute;
  right: 20rpx;
  width: 60rpx;
  height: 60rpx;
  background: transparent;
  border: none;
  font-size: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 12rpx;
  font-size: 32rpx;
  font-weight: bold;
  margin-top: 40rpx;
  transition: all 0.3s ease;
}

.login-btn:disabled {
  background: #ccc;
  color: #999;
}

.login-btn:not(:disabled):active {
  background: #5a6fd8;
  transform: translateY(2rpx);
}

.quick-links {
  display: flex;
  justify-content: space-between;
  margin-top: 40rpx;
}

.link-text {
  font-size: 28rpx;
  color: #667eea;
  text-decoration: underline;
}

.loading-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-content {
  background: white;
  padding: 40rpx 60rpx;
  border-radius: 12rpx;
  text-align: center;
}

.loading-content text {
  font-size: 28rpx;
  color: #333;
}
</style>
