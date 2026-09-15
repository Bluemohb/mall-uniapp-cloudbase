#!/usr/bin/env node
/**
 * ============================================================
 * 🔁 商品数据单一数据源同步
 * ============================================================
 * mock/products_02.json  ──▶  cloudfunctions/seedProducts/products.json
 *   （本地 Mock 直接读）          （随云函数代码包上传，服务端读取）
 *
 * 为什么要有这个脚本：
 *   两边必须是同一份商品数据，否则会出现「Mock 模式看得到、云端模式查不到」
 *   的诡异现象（详情页用 doc(_id).get() 精确查询，_id 不一致就查不到）。
 *   以前靠 README 里的一行 Copy-Item 手工同步，改完数据忘了复制是迟早的事。
 *
 * 【唯一差异：图片 URL】
 *   商品实体（_id / 名称 / 价格 / 库存 / 规格 …）两边完全一致，只有图片不同：
 *     - Mock 用打进包里的本地图：/static/mock/phone-320.webp（离线可用、加载快）
 *     - 云端必须用网络图：https://picsum.photos/seed/phone/400/400
 *       因为 /static 是小程序包内路径，云端数据库和 H5 都读不到。
 *   所以本脚本不是「原样复制」，而是同步时把本地图映射成 picsum 网络图，
 *   映射用的 seed 就是文件名里那段（phone / watch2 / keyboard …）。
 *   这样既保住了单一数据源，又不会把本地路径泄漏到云端。
 *
 * 用法：
 *   pnpm run sync:products            # 同步（内容一致时不做任何写入）
 *   pnpm run sync:products -- --check # 只校验是否一致，不一致退出码 1（给 CI / pre-commit 用）
 *   pnpm run sync:products -- --force # 允许把空数组写入目标（慎用，见下方保护）
 *
 * 【空数据保护】
 *   pnpm run mock:purge 会把 mock/products_02.json 清空为 []。
 *   此时若正好跑同步，会把云函数的种子数据也清掉，导致下次灌库把线上
 *   products 集合清空。所以源为空数组、目标非空时默认拒绝写入，
 *   确需覆盖请显式加 --force。
 * ============================================================
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(ROOT, 'mock', 'products_02.json')
const TARGET = path.join(ROOT, 'cloudfunctions', 'seedProducts', 'products.json')

const args = new Set(process.argv.slice(2))
const isCheck = args.has('--check')
const isForce = args.has('--force')

const rel = p => path.relative(ROOT, p).split(path.sep).join('/')

/** 读文件并解析，失败时抛出带路径的错误 */
function readJson(file) {
  if (!fs.existsSync(file))
    throw new Error(`文件不存在：${rel(file)}`)

  const raw = fs.readFileSync(file, 'utf8')
  try {
    return { raw, data: JSON.parse(raw) }
  }
  catch (e) {
    throw new Error(`${rel(file)} 不是合法 JSON：${e.message}`)
  }
}

/** 归一化后再比较，避免「只有换行/缩进不同」被误判成不一致 */
function normalize(value) {
  return JSON.stringify(value)
}

// ============================================================
// 图片 URL 映射：本地 mock 图 → 云端网络图
// ============================================================

/** /static/mock/phone-320.webp → 中间那段就是 picsum 的 seed */
const LOCAL_IMAGE_RE = /^\/static\/mock\/(.+?)-\d+\.webp$/
const PICSUM = 'https://picsum.photos/seed'

/** 取图片 seed；不是本地 mock 路径（如已经是 http 链接）则返回空串 */
function imageSeed(url) {
  const matched = LOCAL_IMAGE_RE.exec(String(url ?? ''))
  return matched ? matched[1] : ''
}

/**
 * 把一条商品的图片字段换成云端网络链接
 * @param image 主图（本地路径或网络链接）
 * @param images 轮播图数组
 */
function toCloudImages(image, images) {
  const seed = imageSeed(image)

  // 主图不是本地 mock 路径：说明这份数据已经在用网络图，不要瞎改，
  // 只把数组里残留的本地路径逐个转换
  if (!seed) {
    return {
      image,
      images: (images ?? []).map(url => (imageSeed(url) ? `${PICSUM}/${imageSeed(url)}/750/750` : url)),
    }
  }

  return {
    image: `${PICSUM}/${seed}/400/400`,
    // 详情页轮播固定 3 张，与云端种子数据保持一致
    images: [1, 2, 3].map(i => `${PICSUM}/${seed}${i}/750/750`),
  }
}

/** 把源数据整体转换成「云端版」 */
function toCloudProducts(products) {
  return products.map(product => ({ ...product, ...toCloudImages(product.image, product.images) }))
}

function fail(message) {
  console.error(`\n❌ ${message}\n`)
  process.exit(1)
}

// ============================================================
// 主流程
// ============================================================

let source
try {
  source = readJson(SOURCE)
}
catch (e) {
  fail(e.message)
}

if (!Array.isArray(source.data))
  fail(`${rel(SOURCE)} 顶层必须是数组，当前是 ${typeof source.data}`)

const targetExists = fs.existsSync(TARGET)
const target = targetExists ? readJson(TARGET) : null

// 源是本地图，目标是网络图，比较前必须先把源转成云端版
const cloudProducts = toCloudProducts(source.data)

// ---- 空数据保护 ----
if (!isCheck && source.data.length === 0 && target && target.data.length > 0 && !isForce) {
  fail(
    `源数据是空数组，但目标还有 ${target.data.length} 条商品。\n`
    + `   这通常意味着你先跑过 pnpm run mock:purge。为避免把云函数种子数据清空，已中止。\n`
    + `   确认要覆盖请执行：pnpm run sync:products -- --force\n`
    + `   想恢复源数据：git checkout -- ${rel(SOURCE)}`,
  )
}

const inSync = target !== null && normalize(target.data) === normalize(cloudProducts)

// ---- 校验模式 ----
if (isCheck) {
  if (inSync) {
    console.log(`✅ 商品数据已同步：${rel(SOURCE)} → ${rel(TARGET)}（${cloudProducts.length} 条，图片已转网络链接）`)
    process.exit(0)
  }
  if (!targetExists) {
    fail(`${rel(TARGET)} 不存在，请执行 pnpm run sync:products`)
  }
  fail(
    `商品数据不一致：\n`
    + `   源 ${rel(SOURCE)}：${source.data.length} 条\n`
    + `   目标 ${rel(TARGET)}：${target.data.length} 条\n`
    + `   执行 pnpm run sync:products 同步后再试`,
  )
}

// ---- 同步模式 ----
if (inSync) {
  console.log(`✅ 商品数据已是最新，无需写入（${cloudProducts.length} 条）`)
  process.exit(0)
}

fs.mkdirSync(path.dirname(TARGET), { recursive: true })
fs.writeFileSync(TARGET, `${JSON.stringify(cloudProducts, null, 2)}\n`, 'utf8')

const from = targetExists ? `${target.data.length} 条` : '（新建）'
console.log(`🔁 已同步商品数据：${rel(SOURCE)} → ${rel(TARGET)}`)
console.log(`   ${from} → ${cloudProducts.length} 条，图片已映射为 picsum 网络链接`)
console.log('⚠️  云函数代码包里的 products.json 已更新，记得重新部署：tcb functions:deploy seedProducts')
