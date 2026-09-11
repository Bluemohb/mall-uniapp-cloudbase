/**
 * ============================================================
 * 💰 金额计算工具（整数「分」运算）
 * ============================================================
 * 为什么不用浮点数直接算？
 *   JS 的 Number 是 IEEE-754 双精度浮点，0.1 + 0.2 === 0.30000000000000004，
 *   商品价格累加（尤其带小数）会出现「分」级误差，最终导致订单金额对不上。
 *
 * 做法：把「元」统一转为整数「分」参与加减乘，
 *       只在「展示」和「落库」时才转回「元」。
 * ============================================================
 */

/** 「元」→「分」（四舍五入到整数分），入参非法时返回 0 */
export function toCents(yuan: number): number {
  if (!Number.isFinite(yuan))
    return 0
  return Math.round(yuan * 100)
}

/** 「分」→「元」 */
export function toYuan(cents: number): number {
  return Math.round(cents) / 100
}

/**
 * 计算 Σ(单价 × 数量)，返回「分」
 * @param items 至少包含 price（元）与 quantity 的条目数组
 */
export function calcTotalCents(
  items: ReadonlyArray<{ price: number, quantity: number }>,
): number {
  return items.reduce((sum, item) => sum + toCents(item.price) * (item.quantity || 0), 0)
}

/** 把「分」格式化为两位小数字符串（如 1230 → "12.30"） */
export function formatCents(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2)
}

/** 把「元」格式化为两位小数字符串（如 12.3 → "12.30"） */
export function formatMoney(yuan: number): string {
  return formatCents(toCents(yuan))
}
