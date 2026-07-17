/**
 * 种子商品数据云函数
 *
 * 使用 CloudBase 服务端 SDK（@cloudbase/node-sdk）
 * 云函数运行在服务端，拥有完整管理权限，不受客户端安全规则限制
 *
 * 调用方式：
 *   app.callFunction({ name: 'seedProducts', data: { products: [...] } })
 */
const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({
  env: tcb.SYMBOL_CURRENT_ENV,
})

const db = app.database()

exports.main = async (event, context) => {
  console.log('种子数据云函数被调用，参数:', event)

  const { products } = event

  // 参数校验
  if (!products || !Array.isArray(products) || products.length === 0) {
    return {
      success: false,
      message: '缺少商品数据参数（products 数组）',
      requestId: context.requestId,
    }
  }

  const now = Date.now()
  const results = {
    total: products.length,
    success: 0,
    failed: 0,
    errors: [],
  }

  try {
    for (const product of products) {
      try {
        await db.collection('products').add({
          ...product,
          createTime: now + Math.random() * 1000,
        })
        results.success++
      } catch (err) {
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
  } catch (error) {
    console.error('云函数执行错误:', error)
    return {
      success: false,
      message: error.message,
      requestId: context.requestId,
    }
  }
}
