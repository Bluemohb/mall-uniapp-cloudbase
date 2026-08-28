<script setup lang="ts">
import { isMpWeixin, login, signInWithOpenId, signInWithPhoneAuth } from '../../utils/cloudbase'

// 匿名登录（多端游客模式）
// - 微信端：App 启动已自动 OpenID 登录，无需再游客登录（避免换号丢数据）
// - 其他端（H5/App）：匿名登录兜底，后续可通过"绑定手机号/微信"转正（uid 不变）
async function anonymousLogin() {
  if (isMpWeixin()) {
    uni.showToast({
      title: '微信端已自动登录，无需游客登录',
      icon: 'none',
    })
    return
  }

  try {
    uni.showLoading({
      title: '登录中...',
    })

    // 使用现有的初始化函数，若没登录会自动进行匿名登录
    await login()

    uni.hideLoading()
    setTimeout(() => {
      uni.navigateTo({
        url: '/pages/index/index',
      })
    }, 1000)
  }
  catch (error: any) {
    uni.hideLoading()
    uni.showToast({
      title: error.message || '登录失败',
      icon: 'none',
    })
  }
}

// 添加 openIdLogin 方法
async function openIdLogin() {
  uni.showLoading({
    title: '正在登录...',
  })

  try {
    const loginResult = await signInWithOpenId()
    console.log('微信 OpenID 登录成功:', loginResult)
    uni.hideLoading()

    uni.showToast({
      title: '登录成功',
      icon: 'success',
    })
    // 登录成功后，跳转到首页并关闭所有历史页面
    setTimeout(() => {
      uni.navigateTo({
        url: '/pages/index/index',
      })
    }, 1000)
  }
  catch (error: any) {
    uni.hideLoading()
    console.error('微信 OpenID 登录失败:', error)
    uni.showToast({
      title: error.message || '登录失败，请重试',
      icon: 'none',
    })
  }
}

// 微信小程序手机号授权登录
async function handleGetPhoneNumber(event: any) {
  // console.log("event:", event)
  if (!event.detail.code) {
    console.error('获取手机号失败:', event.detail.errMsg)
    uni.showToast({
      title: '获取手机号失败',
      icon: 'none',
    })
    return
  }
  console.log('获取到动态令牌(code):', event.detail.code)
  uni.showLoading({
    title: '登录中...',
  })
  try {
    // 手机号授权登录
    const loginResult = await signInWithPhoneAuth(event.detail.code)
    console.log('手机号授权登录结果:', loginResult)
    uni.hideLoading()
    uni.showToast({
      title: '登录成功',
      icon: 'success',
    })
    // 延迟跳转到首页
    setTimeout(() => {
      uni.navigateTo({
        url: '/pages/index/index',
      })
    }, 1000)
  }
  catch (error: any) {
    // 处理登录失败
    console.error('手机号授权登录失败:', error)
    uni.showToast({
      title: error.message || '登录失败',
      icon: 'none',
    })
  }
  finally {
    uni.hideLoading()
  }
}

// 密码登录
function passwordLogin() {
  uni.navigateTo({
    url: '/pages/login/password-login',
  })
}

// 手机验证码登录
function phoneLogin() {
  uni.navigateTo({
    url: '/pages/login/phone-login',
  })
}

// 邮箱验证码登录
function emailLogin() {
  uni.navigateTo({
    url: '/pages/login/email-login',
  })
}
</script>

<template>
  <view class="login-container">
    <view class="login-header">
      <text class="title">选择登录方式</text>
      <text class="subtitle">请选择您喜欢的登录方式</text>
    </view>

    <view class="login-options">
      <!-- 微信 OpenID 登录（主推） -->
      <view class="login-option recommended" @click="openIdLogin">
        <view class="option-icon">
          💬
        </view>
        <view class="option-content">
          <view class="option-title-row">
            <text class="option-title">微信一键登录</text>
            <text class="option-tag">推荐</text>
          </view>
          <text class="option-desc">身份与微信绑定、永久稳定，清缓存/换设备不丢订单</text>
        </view>
        <view class="option-arrow">
          >
        </view>
      </view>

      <!-- 微信小程序手机号授权登录 -->
      <button
        open-type="getPhoneNumber"
        class="login-option-button"
        @getphonenumber="handleGetPhoneNumber"
      >
        <view class="option-icon">
          📞
        </view>
        <view class="option-content">
          <text class="option-title">微信手机号授权登录</text>
          <text class="option-desc">绑定手机号，换设备也可找回订单</text>
        </view>
        <view class="option-arrow">
          >
        </view>
      </button>

      <!-- 游客模式（非微信端匿名兜底） -->
      <view class="login-option" @click="anonymousLogin">
        <view class="option-icon">
          👤
        </view>
        <view class="option-content">
          <text class="option-title">游客模式（匿名体验）</text>
          <text class="option-desc">无需注册，快速体验（微信端已自动登录）</text>
        </view>
        <view class="option-arrow">
          >
        </view>
      </view>

      <!-- 手机验证码登录 -->
      <view class="login-option" @click="phoneLogin">
        <view class="option-icon">
          📱
        </view>
        <view class="option-content">
          <text class="option-title">手机验证码登录</text>
          <text class="option-desc">使用手机号获取验证码登录</text>
        </view>
        <view class="option-arrow">
          >
        </view>
      </view>

      <!-- 密码登录 -->
      <view class="login-option" @click="passwordLogin">
        <view class="option-icon">
          🔐
        </view>
        <view class="option-content">
          <text class="option-title">密码登录</text>
          <text class="option-desc">使用手机号/邮箱/用户名 + 密码登录</text>
        </view>
        <view class="option-arrow">
          >
        </view>
      </view>

      <!-- 邮箱验证码登录 -->
      <view class="login-option" @click="emailLogin">
        <view class="option-icon">
          📧
        </view>
        <view class="option-content">
          <text class="option-title">邮箱验证码登录</text>
          <text class="option-desc">使用邮箱获取验证码登录</text>
        </view>
        <view class="option-arrow">
          >
        </view>
      </view>
    </view>

    <view class="footer-text">
      <text>选择登录方式即表示您同意我们的</text>
      <text class="link-text">服务条款</text>
      <text>和</text>
      <text class="link-text">隐私政策</text>
    </view>
  </view>
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
}

.login-options {
  background: white;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 20rpx 40rpx rgba(0, 0, 0, 0.1);
  margin-bottom: 60rpx;
}

.login-option {
  display: flex;
  align-items: center;
  padding: 40rpx 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  transition: background-color 0.3s;
}

.login-option:last-child {
  border-bottom: none;
}

.login-option:active {
  background-color: #f8f9fa;
}

.login-option-button {
  /* 复制 .login-option 的样式 */
  display: flex;
  align-items: center;
  padding: 40rpx 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  transition: background-color 0.3s;
  /* 重置 button 的默认样式 */
  background-color: white;
  border-radius: 0;
  margin: 0;
  line-height: 1.4;
  text-align: left;
}

.login-option-button::after {
  border: none; /* 移除按钮的默认边框 */
}

.login-option-button:active {
  background-color: #f8f9fa;
}

.option-icon {
  font-size: 48rpx;
  margin-right: 30rpx;
  width: 80rpx;
  text-align: center;
}

.option-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.option-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.option-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.option-tag {
  padding: 2rpx 14rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  color: #fff;
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
}

.login-option.recommended {
  background: #f7f9ff;
}

.option-desc {
  font-size: 26rpx;
  color: #666;
  line-height: 1.4;
}

.option-arrow {
  font-size: 32rpx;
  color: #ccc;
  font-weight: bold;
}

.footer-text {
  text-align: center;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
}

.link-text {
  color: white;
  text-decoration: underline;
}
</style>
