/**
 * JS 侧主题色值 —— 与 uni.scss 中的 $app-* 变量一一对应
 *
 * 用途：scss 变量只在 <style lang="scss"> 编译期生效，覆盖不到这些场景：
 *   1. 模板里的内联 :style / :class 动态色值
 *   2. <script> 中以字符串形式传递的配色（如轮播图背景）
 *   3. 常量映射表里的状态色（如 ORDER_STATUS_MAP）
 *
 * 改主题时：改本文件 + src/uni.scss 两处（pages.json 的导航栏/tabBar 另算，
 * 小程序原生配置只吃十六进制字面量，见 pages.json 顶部注释）。
 */
export const THEME = {
  /** 品牌主色（按钮 / 选中态 / 链接） */
  primary: '#667eea',
  /** 品牌主色深调（渐变终点） */
  primaryDeep: '#764ba2',
  /** 品牌主色渐变 */
  gradientPrimary: 'linear-gradient(135deg, #667eea, #764ba2)',

  /** 价格 / 金额 */
  price: '#e7493b',
  priceAlt: '#ff4757',

  /** 危险操作（删除 / 退出登录） */
  danger: '#ff6b6b',
  dangerDeep: '#ee5a24',
  gradientDanger: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',

  /** 成功状态 */
  success: '#52c41a',

  /** 评分星 */
  star: '#ffd700',
  starDeep: '#ffb800',
  gradientStar: 'linear-gradient(135deg, #ffd700, #ffb800)',

  /** 中性文字与背景 */
  textPrimary: '#333',
  textSecondary: '#666',
  textMuted: '#999',
  /** 禁用 / 已取消态 */
  textDisabled: '#bbbbbb',
  bgPage: '#f5f5f5',
} as const

export type ThemeKey = keyof typeof THEME
