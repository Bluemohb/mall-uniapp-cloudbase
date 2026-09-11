/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  // 用裸 DefineComponent（其类型参数本身已有默认值），避免出现 any / {} 字面量
  const component: DefineComponent
  export default component
}

/**
 * 构建期由 Vite / uni-app 静态替换（process.env.NODE_ENV → 'development' | 'production'）。
 * 这里只声明用到的字段，避免引入 @types/node 污染小程序端全局类型。
 */
declare const process: {
  env: {
    NODE_ENV?: string
    [key: string]: string | undefined
  }
}

/**
 * .env 中的自定义变量（Vite 只把 VITE_ 前缀的变量暴露给客户端）。
 *
 * 这里与 vite/client 提供的同名全局接口做「声明合并」，
 * 所以只需补充本项目实际用到的字段，无需重复声明 BASE_URL / MODE 等内置项。
 */
interface ImportMetaEnv {
  /** 云开发环境 ID */
  readonly VITE_ENV_ID?: string
  /** 客户端 Publishable Key（可公开，切勿把 SecretKey 打入前端） */
  readonly VITE_PUBLISHABLE_KEY?: string
  /**
   * 全局 Mock 开关：'true' 读本地 mock，'false' 走云端。
   * 不配置时回退为「非生产构建启用」（dev 开 / build 关）。
   */
  readonly VITE_USE_MOCK?: string
  /**
   * 订单专用 Mock 开关：取值同上，不配置时继承 VITE_USE_MOCK。
   * 用途：开发环境也能直连云端 orders 集合，用真实数据调试订单链路。
   */
  readonly VITE_ORDER_MOCK?: string
}
