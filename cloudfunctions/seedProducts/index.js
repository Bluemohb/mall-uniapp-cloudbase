/**
 * 种子商品数据云函数
 *
 * 使用 CloudBase 服务端 SDK（@cloudbase/node-sdk）
 * 云函数运行在服务端，拥有完整管理权限，不受客户端安全规则限制
 *
 * 【数据来源（二选一）】
 *   1) 调用时传参：app.callFunction({ name: 'seedProducts', data: { products: [...] } })
 *   2) 不传参：自动读取函数目录内的 products.json
 *      （该文件内容与 mock/products_02.json 保持一致，便于命令行/控制台直接触发）
 *
 * 【写入语义】
 *   以商品 _id 为准做 upsert（doc(_id).set）：
 *   - 文档已存在 → 覆盖更新
 *   - 文档不存在 → 创建
 *   因此重复调用不会产生重复数据，可安全地反复执行。
 */
const path = require('node:path')
const fs = require('node:fs')
const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({
  env: tcb.SYMBOL_CURRENT_ENV,
})

const db = app.database()

/** 读取函数目录内的 products.json（源数据来自 mock/products_02.json） */
function readLocalProducts() {
  const file = path.join(__dirname, 'products.json')
  if (!fs.existsSync(file)) {
    return []
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  return Array.isArray(parsed) ? parsed : []
}

exports.main = async (event, context) => {
  const inputProducts = event && event.products

  console.log('种子数据云函数被调用，是否传参:', Array.isArray(inputProducts))

  // 优先使用调用方传入的数组，否则回退到函数目录内的 products.json
  const products = Array.isArray(inputProducts) && inputProducts.length > 0
    ? inputProducts
    : readLocalProducts()

  // 参数校验
  if (products.length === 0) {
    return {
      success: false,
      message: '没有可写入的商品数据：既未传入 products 参数，函数目录下也没有 products.json',
      requestId: context.requestId,
    }
  }

  // 统一基准时间：数组越靠前的商品 createTime 越大，
  // 保证云端按 createTime 倒序查询时，顺序与 mock 数组保持一致
  const baseTime = Date.now()
  const results = {
    total: products.length,
    success: 0,
    failed: 0,
    errors: [],
  }

  try {
    for (const [index, product] of products.entries()) {
      try {
        const createTime = baseTime - index * 1000
        const _id = product._id

        if (_id) {
          // 指定 _id 覆盖写入，保证幂等
          const rest = { ...product }
          delete rest._id
          await db.collection('products').doc(String(_id)).set({
            ...rest,
            createTime,
          })
        }
        else {
          await db.collection('products').add({
            ...product,
            createTime,
          })
        }
        results.success++
      }
      catch (err) {
        results.failed++
        results.errors.push({ name: product.name, error: err.message })
      }
    }

    console.log('种子数据写入完成:', results)

    return {
      success: true,
      message: `写入完成：${results.success} 条成功，${results.failed} 条失败`,
      results,
      requestId: context.requestId,
    }
  }
  catch (error) {
    console.error('云函数执行错误:', error)
    return {
      success: false,
      message: error.message,
      requestId: context.requestId,
    }
  }
}
