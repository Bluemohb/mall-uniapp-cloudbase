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
