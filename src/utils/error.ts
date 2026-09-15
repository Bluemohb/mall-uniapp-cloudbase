/**
 * ============================================================
 * ⚠️ 统一错误处理
 * ============================================================
 * 背景：此前各页面的 catch 块各写各的，存在三种风格并存：
 *   1. 只 console.error，用户完全无感知（页面静默空白）
 *   2. `uni.showToast({ icon: 'error' })` —— 带 ❌ 图标，文案长度受限还容易一闪而过
 *   3. `uni.showToast({ icon: 'none' })` —— 纯文字，本项目更常用的写法
 *
 * 约定（新增代码一律遵守）：
 *   - **用户操作触发、且没有兜底** → `reportError('上下文', err, { toast: '交给用户看的文案' })`
 *     内部固定 console.error + icon:'none' 的 toast，两件事一起做，不会漏。
 *   - **有本地兜底、可以静默降级** → `reportError('上下文', err, { toast: false })`
 *     只打日志不打扰用户，但「为什么静默」在调用处一眼可见。
 *   - 需要把错误转成文案自己渲染（如登录页展示 SDK 原始错误）→ 用 `getErrorMessage`。
 *
 * 为什么统一用 icon:'none'：小程序 toast 的 'error' 图标会挤占文案宽度，
 * 中文长句会被截断，而本项目的提示基本都是「XX失败，请重试」这类短句，纯文字更稳。
 * ============================================================
 */
import { showToast } from './index'

/** 从异常里取可读文案的候选字段（按优先级） */
const MESSAGE_FIELDS = ['error_description', 'message', 'errMsg', 'msg', 'errorMessage'] as const

/**
 * 把 unknown 异常转成可读文案
 *
 * CloudBase SDK 的错误形状不统一：有的是 Error 实例，有的是
 * `{ error, error_description }` 或 `{ errMsg }` 的普通对象，这里统一兜住。
 *
 * @param error 捕获到的异常
 * @param fallback 取不到文案时的兜底文案
 */
export function getErrorMessage(error: unknown, fallback = '操作失败'): string {
  if (error instanceof Error && error.message.trim())
    return error.message

  if (typeof error === 'string' && error.trim())
    return error

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    for (const field of MESSAGE_FIELDS) {
      const value = record[field]
      if (typeof value === 'string' && value.trim())
        return value
    }
  }

  return fallback
}

export interface ReportErrorOptions {
  /**
   * 弹给用户的文案；传 false 表示「静默降级」，只打日志不弹窗
   * @default '操作失败，请稍后重试'
   */
  toast?: string | false
  /** toast 显示时长（毫秒） @default 2000 */
  duration?: number
  /** 日志级别：预期内的降级用 warn，真异常用 error @default 'error' */
  level?: 'error' | 'warn'
}

/**
 * 统一的错误上报：打日志 +（可选）弹提示
 *
 * @param context 出错的上下文，用于日志定位，如 '加载购物车'
 * @param error 捕获到的异常
 * @param options 见 ReportErrorOptions
 */
export function reportError(context: string, error: unknown, options: ReportErrorOptions = {}): void {
  const { toast = '操作失败，请稍后重试', duration = 2000, level = 'error' } = options

  if (level === 'warn') {
    console.warn(`[${context}]`, error)
  }
  else {
    console.error(`[${context}]`, error)
  }

  if (toast === false)
    return

  showToast(toast, 'none', duration)
}
