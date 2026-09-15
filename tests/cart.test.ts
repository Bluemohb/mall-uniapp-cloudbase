import type { CartItem } from '../src/utils/cart'

import { mergeCartItems, sanitizeItems, signature } from '../src/utils/cart'

import { describe, expect, it, vi } from 'vitest'

/**
 * cart.ts 在模块顶层就执行了 createUserScopedStore(...)，
 * 真实实现会去摸 uni / CloudBase 的运行时 API。这里把它替换成空壳，
 * 让我们能单独测其中的纯函数策略。
 */
vi.mock('../src/utils/user-scoped-store', () => ({
  createUserScopedStore: () => ({
    ensureUid: () => '',
    resetUid: () => {},
    storageKey: 'cart_test',
    read: () => [],
    write: () => {},
    syncOnStartup: () => Promise.resolve(),
  }),
}))

function item(over: Partial<CartItem> = {}): CartItem {
  return {
    productId: 'p1',
    name: '测试商品',
    image: '',
    price: 10,
    specs: '默认',
    quantity: 1,
    selected: true,
    addTime: 0,
    ...over,
  }
}

describe('cart: sanitizeItems 清洗脏数据', () => {
  it('非数组输入返回空数组', () => {
    expect(sanitizeItems(undefined)).toEqual([])
    expect(sanitizeItems({})).toEqual([])
  })

  it('丢弃没有 productId 的条目', () => {
    const result = sanitizeItems([{ name: '没有 id' }, { productId: 'p1' }])
    expect(result).toHaveLength(1)
    expect(result[0].productId).toBe('p1')
  })

  it('数量非法时兜底为 1', () => {
    const result = sanitizeItems([
      { productId: 'a', quantity: 0 },
      { productId: 'b', quantity: -3 },
      { productId: 'c', quantity: 2.7 },
    ])
    expect(result.map(i => i.quantity)).toEqual([1, 1, 2])
  })

  it('selected 缺省为 true，只有显式 false 才算未选', () => {
    const result = sanitizeItems([
      { productId: 'a' },
      { productId: 'b', selected: false },
    ])
    expect(result.map(i => i.selected)).toEqual([true, false])
  })

  it('缺失 addTime 时补 0，避免每次读取都生成新值造成签名抖动', () => {
    expect(sanitizeItems([{ productId: 'a' }])[0].addTime).toBe(0)
  })
})

describe('cart: signature 内容签名', () => {
  it('与顺序无关', () => {
    const a = item({ productId: 'p1' })
    const b = item({ productId: 'p2' })
    expect(signature([a, b])).toBe(signature([b, a]))
  })

  it('数量或选中态变化会改变签名', () => {
    const base = item({ quantity: 1 })
    expect(signature([base])).not.toBe(signature([item({ quantity: 2 })]))
    expect(signature([base])).not.toBe(signature([item({ selected: false })]))
  })

  it('内容相同则签名相同', () => {
    expect(signature([item(), item()])).toBe(signature([item(), item()]))
  })
})

describe('cart: mergeCartItems 合并', () => {
  it('同商品同规格取较大数量', () => {
    const result = mergeCartItems(
      [item({ quantity: 1 })],
      [item({ quantity: 3 })],
    )
    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(3)
  })

  it('幂等：合并结果再合并同一批数据不会翻倍', () => {
    const extra = [item({ quantity: 3 })]
    const once = mergeCartItems([item({ quantity: 1 })], extra)
    const twice = mergeCartItems(once, extra)
    expect(twice[0].quantity).toBe(3)
  })

  it('规格不同视为两条', () => {
    const result = mergeCartItems(
      [item({ specs: '红色' })],
      [item({ specs: '蓝色' })],
    )
    expect(result).toHaveLength(2)
  })

  it('结果按 addTime 升序', () => {
    const result = mergeCartItems(
      [item({ productId: 'late', addTime: 200 })],
      [item({ productId: 'early', addTime: 100 })],
    )
    expect(result.map(i => i.productId)).toEqual(['early', 'late'])
  })
})
