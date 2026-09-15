import uni from '@dcloudio/vite-plugin-uni'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  base: './',
  // optimizeDeps: {
  //   exclude: ['@cloudbase/adapter-uni-app'],  // 排除 @cloudbase/adapter-uni-app 依赖
  // },
  server: {
    host: '0.0.0.0', // 使用IP地址代替localhost
    // 仅 H5 开发 + Web 端 OAuth 重定向登录（signInWithRedirect）时需要；小程序端走 OpenID 静默登录，不经过此代理。
    proxy: {
      '/__auth': {
        target: 'https://envId-appid.tcloudbaseapp.com/',
        changeOrigin: true,
      },
    },
    // allowedHosts: true  // 允许所有主机访问
  },
})
