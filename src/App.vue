<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { checkEnvironment, ensureLogin } from './utils/cloudbase'
import { syncCartOnStartup } from './utils/cart'

onLaunch(async () => {
  console.log('App Launch')

  // 检查云开发环境配置
  if (!checkEnvironment()) {
    console.warn('云开发环境ID未配置，请在 src/utils/cloudbase.ts 中配置')
    return
  }

  try {
    // 启动即无感登录：微信端 openid 静默登录（失败回退匿名）/ 其他端匿名兜底
    // 确保用户身份稳定，清缓存后重新登录仍是同一用户，数据不丢失
    const logged = await ensureLogin()
    if (logged) {
      console.log('✅ 启动自动登录成功')

      // 登录后合并购物车：把本地临时车并入云端 carts 集合
      // （内部幂等，重复调用共享同一结果；失败只影响购物车同步，不阻塞启动）
      await syncCartOnStartup()
    }
    else {
      console.warn('⚠️ 启动自动登录失败，将在访问需登录的功能时重试')
    }
  }
  catch (error) {
    console.error('启动自动登录异常:', error)
  }
})

onShow(() => {
  console.log('App Show')
})

onHide(() => {
  console.log('App Hide')
})
</script>

<style>
/* 全局样式 */
page {
  background-color: #f5f5f5;
}

/* 通用按钮样式 */
.btn {
  border-radius: 12rpx;
  font-size: 28rpx;
  padding: 20rpx 40rpx;
  border: none;
  transition: all 0.3s ease;
}

.btn-primary {
  background-color: #007aff;
  color: white;
}

.btn-primary:active {
  background-color: #0056cc;
}

.btn-secondary {
  background-color: #f0f0f0;
  color: #333;
}

.btn-secondary:active {
  background-color: #e0e0e0;
}

.btn:disabled {
  opacity: 0.5;
}

/* 通用卡片样式 */
.card {
  background: white;
  border-radius: 16rpx;
  padding: 30rpx;
  margin: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

/* 通用输入框样式 */
.input {
  padding: 20rpx;
  border: 2rpx solid #ddd;
  border-radius: 12rpx;
  font-size: 28rpx;
  background-color: white;
}

.input:focus {
  border-color: #007aff;
}
</style>
