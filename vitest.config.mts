import { defineConfig } from 'vitest/config'

/**
 * Vitest 独立配置
 *
 * 为什么不复用 vite.config.ts：
 *   那里挂着 uni() 插件，会拉起小程序编译链路（页面扫描、条件编译、
 *   uni 模块解析），在 Node 测试环境下既没必要也容易报错。
 *   本项目的单测只覆盖 src/utils 下的纯函数，用裸 vite + node 环境足够。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
