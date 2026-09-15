<!--
  ============================================================
  🔍 搜索页 - 购物小程序第7步（真正的搜索）
  ============================================================
  完善首页/商品列表页的"搜索框"占位，提供独立搜索页：
  1. 输入框自动聚焦，键盘回车或点"搜索"发起搜索
  2. 搜索历史（本地存储，最多10条，支持单条删除与一键清空）
  3. 热门搜索标签（点击即搜）
  4. 结果列表：两列商品网格 + 分页加载更多 + 空结果引导
  5. 数据源：开发环境 Mock 本地 JSON，生产构建自动切换 CloudBase
     （name/category/description 模糊匹配，与 mockSearchProducts 语义一致）

  【知识点】
  - input 的 confirm-type="search"：键盘右下角显示"搜索"键
  - db.command.or + db.RegExp：云端实现多字段模糊搜索
  - 搜索历史用 uni.setStorageSync 持久化，词条去重后插队首
  ============================================================
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { app } from '@/utils/cloudbase'
import Skeleton from '@/components/skeleton/skeleton.vue'

// Mock 数据层：由全局开关 USE_MOCK 控制（见 src/utils/mock.ts）
import { USE_MOCK, mockSearchProducts } from '@/utils/mock'

// ============================================================
// 数据类型
// ============================================================

/** 搜索结果商品 */
interface Product {
  _id: string
  name: string
  price: number
  originalPrice?: number
  image: string
  sales?: number
}

// ============================================================
// 常量
// ============================================================

/** 搜索历史的本地存储 key */
const HISTORY_KEY = 'search_history'

/** 历史记录最大条数 */
const MAX_HISTORY = 10

/** 每页结果条数 */
const PAGE_SIZE = 10

/**
 * 热门搜索词（点击即搜）
 * 说明：演示用词均能命中 mock/云端 seed 商品；正式运营建议按
 * 商品运营数据维护（可改成从数据层动态下发）。
 */
const HOT_WORDS = ['手机', '耳机', '咖啡', '卫衣', '面膜', '运动']

// ============================================================
// 响应式数据
// ============================================================

/** 输入框当前文字 */
const keyword = ref('')

/** 搜索历史 */
const history = ref<string[]>([])

/** 是否已发起过搜索（true=展示结果视图，false=展示历史/热门） */
const searched = ref(false)

/** 当前生效的搜索词（keyword 可被清空，用它渲染结果标题） */
const activeKeyword = ref('')

/** 搜索结果列表 */
const resultList = ref<Product[]>([])

/** 当前页码 */
const currentPage = ref(1)

/** 是否正在加载 */
const isLoading = ref(false)

/** 是否还有更多数据 */
const hasMore = ref(true)

/** 是否有历史记录（控制历史区显隐） */
const hasHistory = computed(() => history.value.length > 0)

/** 是否显示空结果 */
const showEmpty = computed(() => !isLoading.value && resultList.value.length === 0)

/** 搜索结果未到达时显示骨架屏，避免白屏 */
const showSkeleton = computed(() => isLoading.value && resultList.value.length === 0)

// ============================================================
// 搜索历史（本地存储）
// ============================================================

/** 读取本地搜索历史 */
function loadHistory() {
  try {
    const raw = uni.getStorageSync(HISTORY_KEY)
    history.value = Array.isArray(raw)
      ? (raw as string[]).filter((w): w is string => typeof w === 'string' && w.trim() !== '')
      : []
  }
  catch {
    history.value = []
  }
}

/** 写入本地搜索历史（去重后置顶，最多 MAX_HISTORY 条） */
function saveHistory() {
  uni.setStorageSync(HISTORY_KEY, history.value.slice(0, MAX_HISTORY))
}

/** 新增一条历史（搜索成功发起时调用） */
function addHistory(word: string) {
  const w = word.trim()
  if (!w) return
  history.value = [w, ...history.value.filter(h => h !== w)].slice(0, MAX_HISTORY)
  saveHistory()
}

/** 删除单条历史 */
function removeHistory(word: string) {
  history.value = history.value.filter(h => h !== word)
  saveHistory()
}

/** 清空全部历史 */
function clearHistory() {
  history.value = []
  saveHistory()
}

// ============================================================
// 数据查询
// ============================================================

/** 正则特殊字符转义（防止用户输入破坏查询） */
function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 归一化搜索关键词（去首尾空格、压缩连续空格） */
function normalizeKeyword(word: string) {
  return (word || '').trim().replace(/\s+/g, ' ')
}

/**
 * 执行一次搜索
 * @param isRefresh - true=新词搜索/下拉刷新（重置分页）；false=加载下一页
 */
async function fetchSearch(isRefresh = false) {
  if (isLoading.value) return
  if (!hasMore.value && !isRefresh) return

  const kw = activeKeyword.value
  if (!kw) return

  isLoading.value = true
  if (isRefresh) {
    currentPage.value = 1
    hasMore.value = true
  }

  // ===== Mock 模式（开发环境）=====
  if (USE_MOCK) {
    const result = mockSearchProducts({
      keyword: kw,
      page: currentPage.value,
      pageSize: PAGE_SIZE,
    })
    const data = result.data as Product[]
    if (isRefresh) {
      resultList.value = data
    }
    else {
      resultList.value = [...resultList.value, ...data]
    }
    hasMore.value = result.hasMore
    if (result.hasMore) currentPage.value++
    isLoading.value = false
    return
  }

  try {
    const db = app.database()
    const _ = db.command
    const reg = db.RegExp({ regexp: escapeRegExp(kw), options: 'i' })

    // 云端模糊搜索：name / category / description 任一命中即可
    const query = db.collection('products')
      .where(_.or([
        { name: reg },
        { category: reg },
        { description: reg },
      ]))
      .orderBy('createTime', 'desc')
      .skip((currentPage.value - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)

    const res = await query.get()

    if (isRefresh) {
      resultList.value = res.data as Product[]
    }
    else {
      resultList.value = [...resultList.value, ...(res.data as Product[])]
    }

    if (res.data.length < PAGE_SIZE) {
      hasMore.value = false
    }
    else {
      currentPage.value++
    }
  }
  catch (error) {
    console.error('搜索失败:', error)
    uni.showToast({ title: '搜索失败，请稍后重试', icon: 'none' })
  }
  finally {
    isLoading.value = false
  }
}

// ============================================================
// 事件处理
// ============================================================

/** 发起搜索（回车 / 点搜索按钮 / 点历史 / 点热词统一入口） */
function doSearch() {
  const kw = normalizeKeyword(keyword.value)
  if (!kw) {
    uni.showToast({ title: '请输入搜索关键词', icon: 'none' })
    return
  }

  // 记录历史并切换到结果视图
  keyword.value = kw
  addHistory(kw)
  if (!searched.value || activeKeyword.value !== kw) {
    searched.value = true
    activeKeyword.value = kw
    resultList.value = []
    currentPage.value = 1
    hasMore.value = true
  }
  fetchSearch(true)
}

/** 点击热门词 / 历史词 */
function searchWord(word: string) {
  keyword.value = word
  doSearch()
}

/** 清空输入框（回到历史/热门视图） */
function clearInput() {
  keyword.value = ''
  searched.value = false
  activeKeyword.value = ''
  resultList.value = []
  hasMore.value = true
}

/** 返回上一页 */
function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  }
  else {
    uni.switchTab({ url: '/pages/index/index' })
  }
}

/** 跳转商品详情 */
function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/product-detail/product-detail?id=${id}` })
}

// ============================================================
// 生命周期
// ============================================================

onLoad(() => {
  loadHistory()
})

onReachBottom(() => {
  // 仅在结果视图且有更多数据时加载下一页
  if (searched.value && hasMore.value && !isLoading.value) {
    fetchSearch()
  }
})
</script>

<template>
  <view class="search-page">
    <!-- ========== 顶部搜索框 ========== -->
    <view class="search-header">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
        <input
          v-model="keyword"
          class="search-input"
          type="text"
          confirm-type="search"
          placeholder="搜索商品"
          placeholder-class="search-placeholder"
          :focus="true"
          :cursor-spacing="16"
          @confirm="doSearch"
        />
        <text
          v-if="keyword"
          class="clear-btn"
          @click="clearInput"
        >
          ✕
        </text>
      </view>
      <text class="search-action" @click="doSearch">搜索</text>
    </view>

    <!-- ========== 初始态：历史 + 热门 ========== -->
    <view v-if="!searched" class="init-panel">
      <!-- 搜索历史 -->
      <view v-if="hasHistory" class="history-block">
        <view class="block-header">
          <text class="block-title">搜索历史</text>
          <text class="clear-history" @click="clearHistory">清空</text>
        </view>
        <view class="tag-list">
          <view
            v-for="word in history"
            :key="word"
            class="history-tag"
            @click="searchWord(word)"
          >
            <text class="tag-text">{{ word }}</text>
            <text class="tag-del" @click.stop="removeHistory(word)">×</text>
          </view>
        </view>
      </view>

      <!-- 热门搜索 -->
      <view class="hot-block">
        <view class="block-header">
          <text class="block-title">🔥 热门搜索</text>
        </view>
        <view class="tag-list">
          <view
            v-for="(word, i) in HOT_WORDS"
            :key="word"
            class="hot-tag"
            @click="searchWord(word)"
          >
            <text class="hot-rank">{{ i + 1 }}</text>
            <text class="tag-text">{{ word }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 结果态 ========== -->
    <view v-else class="result-panel">
      <view class="result-bar">
        <text class="result-title">
          "{{ activeKeyword }}" 的搜索结果（{{ resultList.length }}）
        </text>
      </view>

      <!-- 搜索结果未到达时先显示骨架屏 -->
      <skeleton v-if="showSkeleton" type="goods-grid" :count="6" />

      <view v-else-if="resultList.length > 0" class="product-grid">
        <view
          v-for="product in resultList"
          :key="product._id"
          class="product-card"
          @click="goDetail(product._id)"
        >
          <image
            class="product-image"
            :src="product.image || '/static/logo.png'"
            mode="aspectFill"
            lazy-load
          />
          <view class="product-info">
            <text class="product-name">{{ product.name }}</text>
            <view class="price-row">
              <text class="price-current">¥{{ product.price }}</text>
              <text
                v-if="product.originalPrice && product.originalPrice > product.price"
                class="price-original"
              >
                ¥{{ product.originalPrice }}
              </text>
            </view>
            <text v-if="product.sales" class="product-sales">已售 {{ product.sales }}+</text>
          </view>
        </view>
      </view>

      <!-- 加载更多 -->
      <uni-load-more
        v-if="!showEmpty && !showSkeleton"
        :status="isLoading ? 'loading' : (hasMore ? 'more' : 'noMore')"
      />

      <!-- 空结果引导 -->
      <view v-if="showEmpty" class="empty-state">
        <text class="empty-icon">🔍</text>
        <text class="empty-text">未找到 "{{ activeKeyword }}" 相关商品</text>
        <text class="empty-hint">换个关键词试试吧~</text>
        <view class="empty-hot">
          <text
            v-for="word in HOT_WORDS"
            :key="word"
            class="empty-hot-tag"
            @click="searchWord(word)"
          >
            {{ word }}
          </text>
        </view>
      </view>
    </view>

    <view class="bottom-space" />
  </view>
</template>

<style scoped lang="scss">
.search-page {
  min-height: 100vh;
  background-color: $app-bg-page;
}

/* ========== 顶部搜索框 ========== */
.search-header {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  background: $app-gradient-primary;
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  height: 68rpx;
  padding: 0 24rpx;
  background-color: #fff;
  border-radius: 34rpx;
}

.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  height: 68rpx;
  font-size: 28rpx;
  color: $app-text-primary;
}

.search-placeholder {
  color: #bbb;
}

.clear-btn {
  padding: 8rpx;
  font-size: 24rpx;
  color: #bbb;
}

.search-action {
  margin-left: 20rpx;
  font-size: 28rpx;
  color: #fff;
}

/* ========== 初始面板 ========== */
.init-panel {
  padding: 24rpx;
}

.history-block,
.hot-block {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.block-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $app-text-primary;
}

.clear-history {
  font-size: 24rpx;
  color: $app-text-muted;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.history-tag,
.hot-tag {
  display: inline-flex;
  align-items: center;
  padding: 10rpx 24rpx;
  border-radius: 30rpx;
  font-size: 26rpx;
  color: $app-text-primary;
}

.history-tag {
  background-color: $app-bg-page;
}

.tag-del {
  margin-left: 10rpx;
  font-size: 26rpx;
  color: #bbb;
}

.hot-tag {
  background-color: #f0f3ff;
  color: $app-color-primary;
}

.hot-rank {
  margin-right: 8rpx;
  font-size: 24rpx;
  color: #b0b7e8;
}

/* ========== 结果面板 ========== */
.result-bar {
  padding: 20rpx 24rpx 10rpx;
}

.result-title {
  font-size: 26rpx;
  color: $app-text-secondary;
}

.product-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  padding: 0 20rpx;
}

.product-card {
  width: 48.5%;
  margin-bottom: 20rpx;
  background-color: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.product-card:active {
  transform: scale(0.98);
  transition: transform 0.15s;
}

.product-image {
  width: 100%;
  height: 300rpx;
  display: block;
  background-color: #f0f0f0;
}

.product-info {
  padding: 14rpx 16rpx 18rpx;
}

.product-name {
  font-size: 26rpx;
  color: $app-text-primary;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
  margin-bottom: 10rpx;
  min-height: 72rpx;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-bottom: 6rpx;
}

.price-current {
  font-size: 32rpx;
  font-weight: bold;
  color: $app-color-price-alt;
}

.price-original {
  font-size: 22rpx;
  color: $app-text-muted;
  text-decoration: line-through;
}

.product-sales {
  font-size: 22rpx;
  color: $app-text-muted;
}

/* ========== 空状态 ========== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 24rpx 40rpx;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 24rpx;
}

.empty-text {
  font-size: 30rpx;
  color: $app-text-secondary;
  margin-bottom: 12rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: #bbb;
  margin-bottom: 40rpx;
}

.empty-hot {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16rpx;
}

.empty-hot-tag {
  padding: 8rpx 24rpx;
  border-radius: 30rpx;
  background-color: #f0f3ff;
  font-size: 24rpx;
  color: $app-color-primary;
}

.bottom-space {
  height: 20rpx;
}
</style>
