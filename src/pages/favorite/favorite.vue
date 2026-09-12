<!--
  ============================================================
  ⭐ 我的收藏
  ============================================================
  这个页面展示了：
  - 收藏列表的读取（本地镜像 + 云端 favorites 集合，见 utils/favorite.ts）
  - 单项取消收藏、批量取消收藏
  - 空收藏状态
  - 点击进入商品详情

  【与购物车页的关系】
  结构与 pages/cart/cart.vue 保持一致（编辑栏 / 列表 / 底部操作栏），
  数据层同样是「本地镜像同步读 + 云端后台同步」，因此：
  - onShow 里 await syncFavoritesOnStartup()：冷启动直接进本页也能读到云端最新收藏
  - 不需要 Mock 开关：收藏是用户数据，商品内容才需要 mock 开关
  ============================================================
-->
<template>
  <view class="favorite-page">
    <!-- ========== 空收藏状态 ========== -->
    <view v-if="favoriteList.length === 0" class="empty-state">
      <view class="empty-icon">❤️</view>
      <text class="empty-text">还没有收藏的商品</text>
      <text class="empty-hint">看到心仪的商品点个收藏，就能在这里找到</text>
      <view class="empty-btn" @click="goShopping">去逛逛</view>
    </view>

    <!-- ========== 收藏列表 ========== -->
    <template v-else>
      <scroll-view class="favorite-scroll" scroll-y enhanced :show-scrollbar="false">
        <!-- 编辑模式切换 -->
        <view class="edit-bar">
          <text class="edit-bar-hint">
            {{ isEditMode ? `已选 ${selectedCount} 件` : `共 ${favoriteList.length} 件收藏` }}
          </text>
          <view class="edit-toggle" @click="toggleEditMode">
            <text
              class="edit-toggle-text"
              :class="{ 'edit-toggle-text--danger': isEditMode }"
            >
              {{ isEditMode ? '完成' : '管理' }}
            </text>
          </view>
        </view>

        <view
          v-for="item in favoriteList"
          :key="item.productId"
          class="favorite-item"
        >
          <!-- 选中框（编辑模式显示） -->
          <view
            v-if="isEditMode"
            class="check-box"
            :class="{ 'check-box--checked': isSelected(item.productId) }"
            @click="toggleSelect(item.productId)"
          >
            <text v-if="isSelected(item.productId)" class="check-icon">✓</text>
          </view>

          <!-- 商品信息 -->
          <view class="item-main" @click="goToDetail(item.productId)">
            <image
              class="item-image"
              :src="item.image || '/static/logo.png'"
              mode="aspectFill"
            />
            <view class="item-info">
              <text class="item-name">{{ item.name }}</text>
              <text v-if="item.category" class="item-category">{{ item.category }}</text>
              <view class="item-bottom">
                <text class="item-price">¥{{ formatMoney(item.price) }}</text>
                <text class="item-time">{{ formatDate(item.addTime) }}</text>
              </view>
            </view>
          </view>

          <!-- 取消收藏（非编辑模式显示） -->
          <view
            v-if="!isEditMode"
            class="unfavorite-btn"
            @click.stop="confirmRemove(item)"
          >
            <text class="unfavorite-icon">❤️</text>
          </view>
        </view>

        <view class="bottom-placeholder" />
      </scroll-view>

      <!-- ========== 底部批量操作栏（编辑模式） ========== -->
      <view v-if="isEditMode" class="favorite-footer">
        <view class="footer-left" @click="toggleSelectAll">
          <view class="check-box" :class="{ 'check-box--checked': isAllSelected }">
            <text v-if="isAllSelected" class="check-icon">✓</text>
          </view>
          <text class="select-all-text">全选</text>
        </view>

        <view
          class="batch-remove-btn"
          :class="{ 'batch-remove-btn--disabled': selectedCount === 0 }"
          @click="batchRemove"
        >
          取消收藏({{ selectedCount }})
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { formatMoney } from '@/utils/money'
import {
  readFavorites,
  removeFavorite,
  syncFavoritesOnStartup,
  writeFavorites,
} from '@/utils/favorite'
import type { FavoriteItem } from '@/utils/favorite'

// ============================================================
// 响应式数据
// ============================================================

const favoriteList = ref<FavoriteItem[]>([])
const isEditMode = ref(false)

/** 编辑模式下选中的商品ID（用 id 而不是下标：排序变化后下标会错位） */
const selectedIds = ref<string[]>([])

// ============================================================
// 计算属性
// ============================================================

const selectedCount = computed(() => selectedIds.value.length)

const isAllSelected = computed(() =>
  favoriteList.value.length > 0 && selectedIds.value.length === favoriteList.value.length,
)

// ============================================================
// 数据加载
// ============================================================

async function loadFavorites() {
  try {
    // 启动时已发起合并（App.onLaunch），这里 await 同一个 Promise：
    // 保证「冷启动直接进收藏页」也能读到云端最新收藏，且不重复请求
    await syncFavoritesOnStartup()
  }
  catch (error) {
    console.warn('同步收藏失败，使用本地镜像:', error)
  }

  favoriteList.value = readFavorites()

  // 列表变化后丢弃已不存在的选中项，避免「取消收藏后仍计入已选」
  const alive = new Set(favoriteList.value.map(item => item.productId))
  selectedIds.value = selectedIds.value.filter(id => alive.has(id))
}

// ============================================================
// 交互方法
// ============================================================

function toggleEditMode() {
  isEditMode.value = !isEditMode.value
  // 退出编辑模式时清空选中，下次进入是干净状态
  if (!isEditMode.value)
    selectedIds.value = []
}

function isSelected(productId: string): boolean {
  return selectedIds.value.includes(productId)
}

function toggleSelect(productId: string) {
  selectedIds.value = isSelected(productId)
    ? selectedIds.value.filter(id => id !== productId)
    : [...selectedIds.value, productId]
}

function toggleSelectAll() {
  selectedIds.value = isAllSelected.value
    ? []
    : favoriteList.value.map(item => item.productId)
}

/** 取消单个收藏 */
function confirmRemove(item: FavoriteItem) {
  uni.showModal({
    title: '取消收藏',
    content: `确定不再收藏「${item.name}」吗？`,
    success: (res) => {
      if (!res.confirm) return

      removeFavorite(item.productId)
      favoriteList.value = readFavorites()
      selectedIds.value = selectedIds.value.filter(id => id !== item.productId)

      uni.showToast({ title: '已取消收藏', icon: 'none' })
    },
  })
}

/** 批量取消收藏（一次性写回，避免逐条写触发多次云端推送） */
function batchRemove() {
  if (selectedCount.value === 0) {
    uni.showToast({ title: '请先选择商品', icon: 'none' })
    return
  }

  uni.showModal({
    title: '取消收藏',
    content: `确定取消收藏选中的 ${selectedCount.value} 件商品吗？`,
    success: (res) => {
      if (!res.confirm) return

      const selected = new Set(selectedIds.value)
      writeFavorites(readFavorites().filter(item => !selected.has(item.productId)))

      favoriteList.value = readFavorites()
      selectedIds.value = []
      isEditMode.value = false

      uni.showToast({ title: '已取消收藏', icon: 'none' })
    },
  })
}

function goToDetail(productId: string) {
  // 编辑模式下点击卡片是"选中"，不跳转（避免误触离开当前编辑状态）
  if (isEditMode.value) {
    toggleSelect(productId)
    return
  }
  uni.navigateTo({ url: `/pages/product-detail/product-detail?id=${productId}` })
}

function goShopping() {
  uni.switchTab({ url: '/pages/products/products' })
}

/** 收藏时间展示（仅到日，收藏列表不需要精确到秒） */
function formatDate(timestamp: number): string {
  if (!timestamp) return ''

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// ============================================================
// 生命周期
// ============================================================

// 用 onShow 而不是 onMounted：从详情页取消收藏后返回，列表需要同步刷新
onShow(() => {
  void loadFavorites()
})
</script>

<style scoped lang="scss">
.favorite-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: $app-bg-page;
}

/* ========== 空状态 ========== */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 60rpx 200rpx;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 30rpx;
  opacity: 0.6;
}

.empty-text {
  font-size: 32rpx;
  color: $app-text-muted;
  margin-bottom: 12rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: #bbb;
  text-align: center;
  margin-bottom: 40rpx;
}

.empty-btn {
  padding: 16rpx 60rpx;
  background: $app-gradient-primary;
  color: #fff;
  font-size: 28rpx;
  border-radius: $app-radius-pill;
}

/* ========== 编辑栏 ========== */
.edit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 30rpx;
  background-color: $app-bg-card;
  margin-bottom: 8rpx;
}

.edit-bar-hint {
  font-size: 26rpx;
  color: $app-text-muted;
}

.edit-toggle-text {
  font-size: 28rpx;
  font-weight: 500;
  color: $app-color-primary;

  &--danger {
    color: $app-color-price;
  }
}

/* ========== 列表 ========== */
.favorite-scroll {
  flex: 1;
  padding-top: 8rpx;
}

.favorite-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  margin: 0 24rpx 16rpx;
  background-color: $app-bg-card;
  border-radius: $app-radius-md;
  box-shadow: $app-shadow-card;
}

/* ========== 选中框 ========== */
.check-box {
  width: 44rpx;
  height: 44rpx;
  border: 3rpx solid #ddd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;

  &--checked {
    background-color: $app-color-primary;
    border-color: $app-color-primary;
  }
}

.check-icon {
  font-size: 24rpx;
  color: #fff;
  font-weight: bold;
}

/* ========== 商品主体 ========== */
.item-main {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.item-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background-color: #f0f0f0;
  flex-shrink: 0;
  margin-right: 20rpx;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.item-name {
  font-size: 28rpx;
  color: $app-text-primary;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8rpx;
}

.item-category {
  font-size: 24rpx;
  color: $app-text-muted;
  margin-bottom: 16rpx;
}

.item-bottom {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12rpx;
}

.item-price {
  font-size: 32rpx;
  font-weight: 600;
  color: $app-color-price;
}

.item-time {
  font-size: 22rpx;
  color: #bbb;
  flex-shrink: 0;
}

/* ========== 取消收藏按钮 ========== */
.unfavorite-btn {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 12rpx;
  flex-shrink: 0;
}

.unfavorite-icon {
  font-size: 40rpx;
}

/* ========== 底部占位 ========== */
.bottom-placeholder {
  height: 40rpx;
}

/* ========== 底部批量操作栏 ========== */
.favorite-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background-color: $app-bg-card;
  border-top: 1rpx solid #eee;
}

.footer-left {
  display: flex;
  align-items: center;
}

.select-all-text {
  font-size: 28rpx;
  color: $app-text-primary;
}

.batch-remove-btn {
  padding: 16rpx 40rpx;
  background-color: $app-color-price;
  color: #fff;
  font-size: 28rpx;
  font-weight: 500;
  border-radius: $app-radius-pill;

  &--disabled {
    opacity: 0.5;
  }
}
</style>
