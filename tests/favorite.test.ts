import type { FavoriteItem } from '../src/utils/favorite'

import { mergeFavorites, sanitizeFavorites, signature } from '../src/utils/favorite'

import { describe, expect, it, vi } from 'vitest'

/** 同 cart.test.ts：替换掉模块顶层的 store 工厂，只测纯函数策略 */
vi.mock('../src/utils/user-scoped-store', () => ({
  createUserScopedStore: () => ({
    ensureUid: () => '',
    resetUid: () => {},
    storageKey: 'favorite_test',
    read: () => [],
    write: () => {},
    syncOnStartup: () => Promise.resolve(),
  }),
}))

function fav(over: Partial<FavoriteItem> = {}): FavoriteItem {
  return {
    productId: 'p1',
    name: '测试商品',
    image: '',
    price: 10,
    addTime: 0,
    ...over,
  }
}

describe('favorite: sanitizeFavorites 清洗与去重', () => {
  it('非数组输入返回空数组', () => {
    expect(sanitizeFavorites(undefined)).toEqual([])
  })

  it('按 productId 去重，保留首次出现的条目', () => {
    const result = sanitizeFavorites([
      { productId: 'p1', name: '第一次' },
      { productId: 'p1', name: '重复项' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('第一次')
  })

  it('丢弃没有 productId 的条目', () => {
    expect(sanitizeFavorites([{ name: '没有 id' }])).toEqual([])
  })
})

describe('favorite: signature 内容签名', () => {
  it('只看 productId 与 addTime，与顺序无关', () => {
    const a = fav({ productId: 'p1', addTime: 1 })
    const b = fav({ productId: 'p2', addTime: 2 })
    expect(signature([a, b])).toBe(signature([b, a]))
  })

  it('快照字段变化不影响签名（价格/名称变动不算内容变化）', () => {
    const before = fav({ name: '旧名', price: 10 })
    const after = fav({ name: '新名', price: 99 })
    expect(signature([before])).toBe(signature([after]))
  })
})

describe('favorite: mergeFavorites 合并', () => {
  it('按 productId 取并集', () => {
    const result = mergeFavorites(
      [fav({ productId: 'p1' })],
      [fav({ productId: 'p2' })],
    )
    expect(result.map(i => i.productId).sort()).toEqual(['p1', 'p2'])
  })

  it('同一商品保留较早的 addTime（收藏时间以第一次为准）', () => {
    const result = mergeFavorites(
      [fav({ productId: 'p1', addTime: 200 })],
      [fav({ productId: 'p1', addTime: 100 })],
    )
    expect(result).toHaveLength(1)
    expect(result[0].addTime).toBe(100)
  })

  it('幂等：合并结果再合并同一批数据不产生新条目', () => {
    const extra = [fav({ productId: 'p2' })]
    const once = mergeFavorites([fav({ productId: 'p1' })], extra)
    const twice = mergeFavorites(once, extra)
    expect(twice).toHaveLength(2)
  })

  it('结果按 addTime 倒序，最新收藏在前', () => {
    const result = mergeFavorites(
      [fav({ productId: 'old', addTime: 100 })],
      [fav({ productId: 'new', addTime: 300 })],
    )
    expect(result.map(i => i.productId)).toEqual(['new', 'old'])
  })
})
