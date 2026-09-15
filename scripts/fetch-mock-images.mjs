#!/usr/bin/env node
/**
 * ============================================================
 * 📦 Mock 商品图本地化工具
 * ============================================================
 * 把 mock/products_02.json 里的网图（picsum.photos）下载到本地，
 * 让小程序 / H5 直接以本地路径访问，摆脱对外部图床的依赖。
 *
 * 【为什么输出到 src/static/mock 而不是 mock/images】
 *   小程序运行时只能访问「包内资源」。uni-app 只把 src/static/**
 *   原样复制到产物根目录；项目根的 mock/ 不在构建输入里，放在那里的
 *   文件小程序根本读不到（H5 同理）。所以物理落点必须在 src/static/
 *   下，JSON 里引用写作 /static/mock/xxx.webp。
 *
 * 【为什么只下主图 + 用 webp】
 *   主包上限 2MB 是硬约束，而当前产物已约 0.94MB。实测：
 *     - 200 张原尺寸图 ≈ 6MB（爆包 3 倍）
 *     - 即便全部压到 300x300 webp 也要 1.6MB，合计仍超 2MB
 *   所以取「每个商品只保留 1 张主图」的策略：
 *     - 主图下载为 webp（同等观感比 jpg 小约 45%），约 9KB/张
 *     - 详情图 images 复用主图路径，不新增物理文件
 *   合计 50 张 ≈ 450KB，产物约 1.4MB，为后续功能留足余量。
 *   详情页在 images 为空/单张时会自动回落主图（见 product-detail.vue）。
 *
 * 用法：
 *   node scripts/fetch-mock-images.mjs              # 全量下载
 *   node scripts/fetch-mock-images.mjs --limit 5    # 只处理前 5 个商品（试跑）
 *   node scripts/fetch-mock-images.mjs --write      # 下载后改写 JSON 为本地路径
 *   node scripts/fetch-mock-images.mjs --force      # 已存在也重新下载
 *   node scripts/fetch-mock-images.mjs --clean      # 清空已下载的图
 * ============================================================
 */
import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOCK_JSON = path.join(ROOT, 'mock', 'products_02.json')
/** 小程序可访问的静态资源落点（uni-app 会复制到产物根目录） */
const OUT_DIR = path.join(ROOT, 'src', 'static', 'mock')
/** JSON 里写入的引用前缀 */
const URL_PREFIX = '/static/mock'
/** 输出格式：webp 在小程序与 H5 均受支持，体积明显优于 jpg */
const EXT = 'webp'
/** 主图下载尺寸：列表卡片约 175px 物理像素，2 倍图足够 */
const MAIN_SIZE = 320

const CONCURRENCY = 8
const TIMEOUT_MS = 20000
const RETRY = 3
const BUDGET = 2 * 1024 * 1024

// ============================================================
// 参数
// ============================================================
const argv = process.argv.slice(2)
function readFlag(name, fallback) {
  const i = argv.indexOf(`--${name}`)
  if (i === -1)
    return fallback
  const v = argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}
const LIMIT = Number(readFlag('limit', 0)) || 0
const FORCE = readFlag('force', false) === true
const WRITE = readFlag('write', false) === true
const CLEAN = readFlag('clean', false) === true

// ============================================================
// 工具
// ============================================================

/** picsum URL -> { seed }；非 picsum 返回 null */
function parsePicsum(url) {
  if (typeof url !== 'string' || !url)
    return null
  const m = /picsum\.photos\/seed\/([^/]+)\//.exec(url)
  return m ? { seed: m[1] } : null
}

/** seed -> 文件名（统一小写，避免大小写冲突） */
function toFileName(seed) {
  const safe = String(seed).toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  return `${safe}-${MAIN_SIZE}.${EXT}`
}

function toDownloadUrl(seed) {
  return `https://picsum.photos/seed/${seed}/${MAIN_SIZE}/${MAIN_SIZE}.${EXT}`
}

function toLocalPath(seed) {
  return `${URL_PREFIX}/${toFileName(seed)}`
}

/** 主图 URL -> 本地路径；无法解析则原样返回 */
function mainImageToLocal(url) {
  const info = parsePicsum(url)
  return info ? toLocalPath(info.seed) : url
}

/** 校验 WebP 头（RIFF....WEBP），防止把错误页存成图片 */
function isWebp(buf) {
  return buf.length > 12
    && buf.slice(0, 4).toString('ascii') === 'RIFF'
    && buf.slice(8, 12).toString('ascii') === 'WEBP'
}

async function download(url) {
  let lastErr
  for (let i = 1; i <= RETRY; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!res.ok)
        throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (!isWebp(buf))
        throw new Error('非 WebP 响应')
      return buf
    }
    catch (err) {
      lastErr = err
      if (i < RETRY)
        await new Promise(r => setTimeout(r, 400 * i))
    }
  }
  throw lastErr
}

async function pool(tasks, size) {
  let cursor = 0
  const workers = Array.from({ length: Math.min(size, tasks.length) }, async () => {
    while (cursor < tasks.length)
      await tasks[cursor++]()
  })
  await Promise.all(workers)
}

// ============================================================
// 清理
// ============================================================
if (CLEAN) {
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true })
    console.log(`🧹 已清空 ${path.relative(ROOT, OUT_DIR)}`)
  }
  else {
    console.log('🧹 目录不存在，无需清理')
  }
  process.exit(0)
}

// ============================================================
// 收集任务（只收主图：详情图复用主图，不单独下载）
// ============================================================
const products = JSON.parse(fs.readFileSync(MOCK_JSON, 'utf8'))
const targets = LIMIT > 0 ? products.slice(0, LIMIT) : products

const jobs = new Map()
let nonPicsum = 0

for (const p of targets) {
  const info = parsePicsum(p.image)
  if (!info) {
    nonPicsum++
    continue
  }
  const file = toFileName(info.seed)
  if (!jobs.has(file))
    jobs.set(file, { url: toDownloadUrl(info.seed), file })
}

const all = [...jobs.values()]
console.log(`📋 待下载 ${all.length} 张（商品 ${targets.length} 个）${nonPicsum ? `，跳过非 picsum ${nonPicsum} 个` : ''}`)
console.log(`📁 输出 ${path.relative(ROOT, OUT_DIR)}`)

fs.mkdirSync(OUT_DIR, { recursive: true })

let done = 0
let downloaded = 0
let cached = 0
let totalBytes = 0
const failed = []
const t0 = Date.now()

await pool(
  all.map(job => async () => {
    const dest = path.join(OUT_DIR, job.file)
    if (!FORCE && fs.existsSync(dest) && isWebp(fs.readFileSync(dest))) {
      cached++
      totalBytes += fs.statSync(dest).size
    }
    else {
      try {
        const buf = await download(job.url)
        fs.writeFileSync(dest, buf)
        totalBytes += buf.length
        downloaded++
      }
      catch (err) {
        failed.push({ file: job.file, reason: err.message })
      }
    }
    done++
    if (done % 25 === 0 || done === all.length)
      console.log(`  进度 ${done}/${all.length}`)
  }),
  CONCURRENCY,
)

const secs = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`\n✅ 新下载 ${downloaded} 张，复用 ${cached} 张，失败 ${failed.length} 张，耗时 ${secs}s`)
console.log(`📦 体积 ${(totalBytes / 1024).toFixed(0)} KB / ${all.length} 张，均值 ${Math.round(totalBytes / Math.max(all.length, 1) / 1024)} KB`)
console.log(`👍 预计产物 ≈ ${(0.94 + totalBytes / 1024 / 1024).toFixed(2)} MB（主包上限 2MB）`)

if (failed.length) {
  console.log(`\n❌ 失败 ${failed.length} 张（前 10）：`)
  failed.slice(0, 10).forEach(f => console.log(`  ${f.file} — ${f.reason}`))
}

// ============================================================
// 改写 JSON
// ============================================================
if (WRITE) {
  if (LIMIT > 0) {
    console.log('\n⚠️ --limit 与 --write 不能同时用（会只改部分商品），已跳过写入')
  }
  else {
    let changed = 0
    const next = products.map((p) => {
      const image = mainImageToLocal(p.image)
      // 详情图复用主图：不新增物理文件，详情页单图展示（代码已支持回落）
      const images = [image]
      const before = [p.image, ...(p.images || [])].length
      if (image !== p.image)
        changed += before - 1
      return { ...p, image, images }
    })
    fs.writeFileSync(MOCK_JSON, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    console.log(`\n📝 已改写 ${path.relative(ROOT, MOCK_JSON)}：${changed} 处网图 URL -> 本地路径`)
    console.log('   （详情图 images 收敛为 1 项并复用主图，200 处引用全部本地化）')
  }
}

process.exitCode = failed.length > 0 ? 1 : 0
