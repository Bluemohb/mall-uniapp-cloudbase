/**
 * JSON 模块导入的类型声明
 * 允许 import xxx from '*.json'（如 mock/products_02.json）
 * 具体结构类型在引入处用 as 断言
 */
declare module '*.json' {
  const value: any
  export default value
}
