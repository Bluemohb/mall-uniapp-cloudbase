#!/usr/bin/env node
/**
 * ============================================================
 * 🧹 上线前清理 Mock 数据与 Mock 图
 * ============================================================
 * 为什么要单独做一个脚本：uni-app 会「无条件」把 src/static/** 复制到
 * 产物，跟数据是否走云端无关。所以上线前只删 mock/products_02.json 是
 * 不够的——src/static/mock 下的图照样进包，主包白占约 600KB。
 *
 * 本脚本做两件事：
 *   1. 删除 src/static/mock（本地 mock 图）
 *   2. 把 mock/products_02.json 置为 []（保留文件，避免 mock.ts 的静态
 *      import 编译报错；生产构建 USE_MOCK=false，本就不会读它）
 *
 * 恢复方式（二选一）：
 *   git checkout -- mock/products_02.json   # 还原数据
 *   pnpm run mock:images                    # 重新下载图 + 改写数据
 * ============================================================
 */
import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOCK_JSON = path.join(ROOT, 'mock', 'products_02.json')
const IMG_DIR = path.join(ROOT, 'src', 'static', 'mock')

let freed = 0

if (fs.existsSync(IMG_DIR)) {
  for (const f of fs.readdirSync(IMG_DIR))
    freed += fs.statSync(path.join(IMG_DIR, f)).size
  fs.rmSync(IMG_DIR, { recursive: true, force: true })
  console.log(`🧹 已删除本地 mock 图：${path.relative(ROOT, IMG_DIR)}（释放 ${(freed / 1024).toFixed(0)} KB）`)
}
else {
  console.log('🧹 本地 mock 图目录不存在，跳过')
}

if (fs.existsSync(MOCK_JSON)) {
  const before = fs.statSync(MOCK_JSON).size
  fs.writeFileSync(MOCK_JSON, '[]\n', 'utf8')
  console.log(`🧹 已清空 mock 数据：${path.relative(ROOT, MOCK_JSON)}（${(before / 1024).toFixed(0)} KB -> 0 KB）`)
}
else {
  console.log('🧹 mock 数据文件不存在，跳过')
}

console.log(`\n✅ 共释放约 ${((freed) / 1024).toFixed(0)} KB 图片 + mock JSON 体积`)
console.log('⚠️  清理后开发环境（USE_MOCK=true）将无商品数据，这是预期行为')
console.log('   恢复：git checkout -- mock/products_02.json && pnpm run mock:images')
