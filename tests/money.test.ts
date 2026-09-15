import { calcTotalCents, formatCents, formatMoney, toCents, toYuan } from '../src/utils/money'

import { describe, expect, it } from 'vitest'

describe('money: 元/分互转', () => {
  it('toCents 把元转成整数分', () => {
    expect(toCents(12.3)).toBe(1230)
    expect(toCents(0)).toBe(0)
    expect(toCents(19.99)).toBe(1999)
  })

  it('toCents 抹平浮点误差', () => {
    // JS 里 0.1 + 0.2 === 0.30000000000000004，转分后必须落在 30
    expect(toCents(0.1 + 0.2)).toBe(30)
  })

  it('toCents 对非法入参返回 0，避免 NaN 污染后续计算', () => {
    expect(toCents(Number.NaN)).toBe(0)
    expect(toCents(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('toYuan 把分转回元', () => {
    expect(toYuan(1230)).toBe(12.3)
    expect(toYuan(0)).toBe(0)
  })
})

describe('money: 合计', () => {
  it('calcTotalCents 累加 单价 × 数量', () => {
    expect(calcTotalCents([
      { price: 19.9, quantity: 2 }, // 1990 * 2
      { price: 5.5, quantity: 1 }, // 550
    ])).toBe(4530)
  })

  it('calcTotalCents 空数组为 0', () => {
    expect(calcTotalCents([])).toBe(0)
  })

  it('calcTotalCents 数量缺失时按 0 计', () => {
    const items = [{ price: 10 }] as unknown as Array<{ price: number, quantity: number }>
    expect(calcTotalCents(items)).toBe(0)
  })

  it('calcTotalCents 多件同价不出现分位误差', () => {
    // 0.07 * 3 用浮点算是 0.21000000000000002，走分则应稳定为 21
    expect(calcTotalCents([{ price: 0.07, quantity: 3 }])).toBe(21)
  })
})

describe('money: 展示格式化', () => {
  it('formatCents 固定两位小数', () => {
    expect(formatCents(1230)).toBe('12.30')
    expect(formatCents(0)).toBe('0.00')
    expect(formatCents(5)).toBe('0.05')
  })

  it('formatMoney 先转分再格式化，不残留浮点尾巴', () => {
    expect(formatMoney(12.3)).toBe('12.30')
    expect(formatMoney(0.1 + 0.2)).toBe('0.30')
  })
})
