<!--
  ============================================================
  📦 订单列表页 - 购物小程序第5步
  ============================================================
  这个页面展示了：
  - 按状态筛选订单（全部/待支付/已支付/已发货/已完成/已取消）
  - 分页加载 + 下拉刷新（和商品列表页 products.vue 同样的套路）
  - 订单卡片：订单号、状态、商品缩略图、商品名、金额、时间
  - 快捷操作：待支付订单可直接"去支付"或"取消"
  - 点击卡片进入订单详情页

  【知识点】
  - where({userId}).orderBy('createdAt','desc').skip(n).limit(m).get()
  - onPullDownRefresh / onReachBottom 页面滚动生命周期
  - 状态 tab 切换重新查询
  ============================================================
-->
<template>
  <view class="order-list-page">
    <!-- ========== 搜索 + 批量管理入口 ========== -->
    <view class="toolbar">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜索商品名 / 订单号 / 收货人"
          placeholder-class="search-placeholder"
          confirm-type="search"
          @input="onSearchInput"
          @confirm="submitSearch"
        />
        <text v-if="keyword" class="search-clear" @click="clearSearch">✕</text>
      </view>
      <text class="manage-btn" :class="{ active: selectMode }" @click="toggleManage">
        {{ selectMode ? '完成' : '批量' }}
      </text>
    </view>

    <!-- ========== 状态筛选栏 ========== -->
    <scroll-view class="tab-bar" scroll-x :show-scrollbar="false">
      <view class="tab-list">
        <view
          v-for="tab in tabs"
          :key="tab.value"
          class="tab-item"
          :class="{ active: activeStatus === tab.value }"
          @click="switchTab(tab.value)"
        >
          <text>{{ tab.label }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- ========== 订单列表 ========== -->
    <scroll-view class="list-scroll" scroll-y enhanced :show-scrollbar="false" @scrolltolower="loadMore">
      <!-- 空状态 -->
      <view v-if="!loading && orders.length === 0" class="empty-state">
        <view class="empty-icon">🧾</view>
        <text class="empty-text">{{ isSearching ? '没有找到匹配的订单' : '暂无相关订单' }}</text>
        <view v-if="isSearching" class="empty-btn" @click="clearSearch">清空搜索</view>
        <view v-else class="empty-btn" @click="goShopping">去逛逛</view>
      </view>

      <!-- 首屏数据未到达时显示骨架屏 -->
      <skeleton v-if="loading && orders.length === 0" type="list-row" :count="4" />

      <!-- 订单卡片 -->
      <view
        v-for="order in orders"
        :key="order._id"
        class="order-card"
        @click="onCardTap(order)"
      >
        <!-- 多选模式的复选框：只有待支付订单可取消，其余状态置灰不可选 -->
        <view v-if="selectMode" class="card-check" @click.stop="toggleSelect(order)">
          <view
            class="checkbox"
            :class="{ checked: isSelected(order._id), disabled: !canSelect(order) }"
          >
            <text v-if="isSelected(order._id)" class="check-mark">✓</text>
          </view>
        </view>

        <view class="card-body">
          <!-- 头部：订单号 + 状态 -->
          <view class="card-header">
            <text class="order-no">订单号：{{ order.orderNo }}</text>
            <text class="order-status" :style="{ color: getStatusInfo(order.status).color }">
              {{ getStatusInfo(order.status).label }}
            </text>
          </view>

          <!-- 商品缩略图 -->
          <view class="goods-row">
            <image
              v-for="(item, idx) in order.items.slice(0, 4)"
              :key="idx"
              :src="item.image || '/static/logo.png'"
              class="thumb"
              mode="aspectFill"
              lazy-load
            />
            <text class="goods-count">共 {{ getTotalQty(order) }} 件</text>
          </view>

          <!--
            商品名：订单没有「名称」字段，搜索命中的就是这里显示的东西。
            不显示出来，用户无从知道可以拿商品名搜，只能去搜订单号。
          -->
          <view class="goods-name">{{ goodsNameSummary(order) }}</view>

          <!-- 底部：时间 + 金额 + 操作 -->
          <view class="card-footer">
            <text class="order-time">{{ formatTime(order.createdAt) }}</text>
            <view class="footer-right">
              <text class="total-price">¥{{ formatCents(orderAmountCents(order)) }}</text>
              <!-- 待支付订单的快捷操作：多选模式下隐藏，统一由底部操作条处理 -->
              <template v-if="order.status === 'pending' && !selectMode">
                <view class="mini-btn ghost" @click.stop="cancelOrder(order)">取消</view>
                <view class="mini-btn primary" @click.stop="payOrder(order)">去支付</view>
              </template>
            </view>
          </view>
        </view>
      </view>

      <!-- 加载更多状态 -->
      <view v-if="orders.length > 0" class="load-more">
        <!-- 搜索是「先取最近 N 笔再本地过滤」，如实标注范围，免得以为漏了订单 -->
        <text v-if="isSearching">仅在最近 {{ searchFetchSize }} 笔订单中匹配</text>
        <text v-else>{{ hasMore ? (loading ? '加载中...' : '上拉加载更多') : '没有更多了' }}</text>
      </view>
      <view class="bottom-placeholder" :class="{ 'with-batch-bar': selectMode }" />
    </scroll-view>

    <!-- ========== 批量操作条（仅多选模式） ========== -->
    <view v-if="selectMode" class="batch-bar">
      <view class="batch-left" @click="toggleSelectAll">
        <view class="checkbox" :class="{ checked: allSelected, disabled: selectableCount === 0 }">
          <text v-if="allSelected" class="check-mark">✓</text>
        </view>
        <text class="batch-all">全选</text>
      </view>
      <view class="batch-right">
        <text class="batch-count">
          已选 {{ selectedIds.length }} 笔 · ¥{{ formatCents(selectedAmountCents) }}
        </text>
        <view class="batch-btn" :class="{ disabled: selectedIds.length === 0 }" @click="batchCancel">
          批量取消
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { app, getUid } from '@/utils/cloudbase'
import { formatDate } from '@/utils/index'
import {
  ORDER_STATUS_MAP,
  orderAmountCents,
  type Order,
  type OrderStatus,
} from '@/utils/order'
import { formatCents } from '@/utils/money'

// 订单操作统一入口：支付 / 取消。
// 内部区分「真实微信支付」与「模拟支付」，页面只负责触发与刷新（见 utils/order-actions.ts）
import { cancelOrderById, cancelOrdersByIds, payOrderById } from '@/utils/order-actions'

// Mock 数据层：由订单开关控制（USE_ORDER_MOCK，未配置时继承全局开关）
import { USE_ORDER_MOCK } from '@/utils/mock'
import { mockQueryOrders } from '@/utils/order-mock'
import Skeleton from '@/components/skeleton/skeleton.vue'

// ============================================================
// 状态筛选 tab 定义
// ============================================================

interface TabItem {
  label: string
  value: '' | OrderStatus   // '' 表示"全部"
}

/** 订单列表页路由参数 */
interface OrderListQuery {
  status?: OrderStatus
}

const tabs: TabItem[] = [
  { label: '全部', value: '' },
  { label: '待支付', value: 'pending' },
  { label: '已支付', value: 'paid' },
  { label: '已发货', value: 'shipped' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
]

// ============================================================
// 响应式数据
// ============================================================

const orders = ref<Order[]>([])
const activeStatus = ref<TabItem['value']>('')
const loading = ref(true)
const page = ref(0)
const pageSize = 10
const hasMore = ref(true)

// ============================================================
// 搜索
// ============================================================

/** 输入框里的原始值（v-model 绑定，每敲一个字都变） */
const keyword = ref('')
/** 防抖后真正参与过滤的关键词；为空 = 不在搜索态 */
const appliedKeyword = ref('')

/**
 * 搜索时的取数上限：最多在最近 100 笔订单里找
 *
 * 商品名躺在 items 嵌套数组里，云端既没有可用的模糊匹配条件，也查不了数组元素，
 * 所以搜索只能「先取最近 N 笔 → 再本地过滤」。
 * 代价：更早的订单搜不到，列表底部如实标注了这个范围。
 */
const searchFetchSize = 100

/**
 * 搜索时单次 get 的条数
 *
 * 小程序端单次 limit 有上限（20），一次要 100 条并不合法，
 * 所以按 20 条一趟翻页，累计到 searchFetchSize 为止。
 */
const SEARCH_PAGE_SIZE = 20

const isSearching = computed(() => appliedKeyword.value.trim() !== '')

// ============================================================
// 多选（批量取消）
// ============================================================

const selectMode = ref(false)
const selectedIds = ref<string[]>([])

// ============================================================
// 页面生命周期
// ============================================================

/**
 * 个人中心可带 status 参数跳转（如 order-list?status=pending），
 * onLoad 先于 onShow 执行，先设好筛选，onShow 的 refresh() 会按新状态查询
 */
onLoad((options?: OrderListQuery) => {
  const status = options?.status
  if (status && tabs.some(t => t.value === status)) {
    activeStatus.value = status
  }
})

onShow(() => {
  // 每次回到列表页都刷新（比如从详情页返回、操作了状态）
  refresh()
})

/** 下拉刷新：重置到第一页重新加载 */
onPullDownRefresh(async () => {
  await refresh()
  uni.stopPullDownRefresh()
})

/** 触底加载：加载下一页 */
onReachBottom(() => {
  loadMore()
})

// ============================================================
// 数据加载（分页）
// ============================================================

/**
 * 查询一页订单
 *
 * 【知识点】CloudBase 分页查询套路：
 * .skip(跳过条数).limit(每页条数)
 * 第一页：skip(0).limit(10)
 * 第二页：skip(10).limit(10)
 */
async function fetchOrders() {
  // 搜索态：一次取一批到本地过滤，不走分页
  // （分页会让"排在后面才匹配"的订单永远漏掉，语义上就不成立）
  if (isSearching.value) {
    await fetchSearchResult()
    return
  }

  // ===== Mock 模式（USE_ORDER_MOCK）：读本地订单，无需登录态 =====
  if (USE_ORDER_MOCK) {
    const result = mockQueryOrders({
      status: activeStatus.value,
      page: page.value + 1,
      pageSize,
    })
    const list = (result.data as Order[]) || []
    hasMore.value = result.hasMore
    if (page.value === 0) {
      orders.value = list
    }
    else {
      const existIds = new Set(orders.value.map(o => o._id))
      const newItems = list.filter(o => !existIds.has(o._id))
      orders.value = [...orders.value, ...newItems]
    }
    return
  }

  let uid = ''
  try {
    uid = await getUid()
  }
  catch (error) {
    console.error('获取用户标识失败:', error)
    uni.showToast({ title: '登录失败，请稍后重试', icon: 'none' })
    return
  }

  try {
    // 一次性构造完整查询条件（避免 any，也避免二次 where 相互覆盖）
    const condition: { userId: string, status?: OrderStatus } = { userId: uid }
    if (activeStatus.value) {
      condition.status = activeStatus.value
    }

    const { data } = await app
      .database()
      .collection('orders')
      .where(condition)
      .orderBy('createdAt', 'desc')       // 最新订单在前
      .skip(page.value * pageSize)        // 跳过前面已加载的
      .limit(pageSize)
      .get()

    const list = (data as Order[]) || []

    // 判断是否还有更多
    hasMore.value = list.length === pageSize

    if (page.value === 0) {
      // 第一页：直接替换
      orders.value = list
    } else {
      // 后续页：追加（注意去重，防止刷新时重复）
      const existIds = new Set(orders.value.map(o => o._id))
      const newItems = list.filter(o => !existIds.has(o._id))
      orders.value = [...orders.value, ...newItems]
    }
  } catch (error) {
    console.error('获取订单列表失败:', error)
    uni.showToast({ title: '加载订单失败', icon: 'none' })
  }
}

/** 归一化搜索词：去首尾空格、压缩连续空格（粘贴来的名字常带多余空格） */
function normalizeKeyword(word: string): string {
  return (word || '').trim().replace(/\s+/g, ' ')
}

/** 大小写不敏感、两侧都归一化的包含匹配 */
function contains(haystack: string | undefined, kw: string): boolean {
  return normalizeKeyword(haystack || '').toLowerCase().includes(kw)
}

/**
 * 订单是否命中关键词（kw 必须是已归一化并转小写的）
 *
 * 三个维度。商品名排第一：用户认一笔订单靠的是「买了什么」，
 * 而不是那串记不住的订单号。
 *   1. 商品名（items 快照里的 name）
 *   2. 订单号（数字串，只记得后几位也能搜到）
 *   3. 收货人姓名
 */
function matchKeyword(order: Order, kw: string): boolean {
  if (!kw) return true
  if (contains(order.orderNo, kw)) return true
  if (contains(order.address?.name, kw)) return true
  return (order.items || []).some(item => contains(item.name, kw))
}

/**
 * 卡片上展示的商品名摘要
 *
 * 订单本身没有「名称」字段，用户在列表里认出订单靠的就是商品名。
 * 显示出来还有一个作用：让用户知道「原来可以拿商品名搜」。
 */
function goodsNameSummary(order: Order): string {
  const items = order.items || []
  if (items.length === 0) return '无商品信息'
  const first = items[0]?.name || '未命名商品'
  // 多商品订单只补一个种类数，不把一长串名字全铺开
  return items.length > 1 ? `${first} 等 ${items.length} 种商品` : first
}

/**
 * 取「供搜索的候选订单」：最近 searchFetchSize 笔
 *
 * 【为什么分多趟拉，而不是 limit(100) 一次搞定】
 * 小程序端单次 get 的 limit 有上限（20），一次要 100 条并不合法，
 * 所以按 20 条一趟翻页，累计到上限为止。
 */
async function fetchCandidatesForSearch(): Promise<Order[]> {
  // ===== Mock 模式：订单全在本地 storage，一次取够即可 =====
  if (USE_ORDER_MOCK) {
    const result = mockQueryOrders({
      status: activeStatus.value,
      page: 1,
      pageSize: searchFetchSize,
    })
    return (result.data as Order[]) || []
  }

  let uid = ''
  try {
    uid = await getUid()
  }
  catch (error) {
    console.error('获取用户标识失败:', error)
    throw new Error('登录失败，请稍后重试')
  }

  const condition: { userId: string, status?: OrderStatus } = { userId: uid }
  if (activeStatus.value) {
    condition.status = activeStatus.value
  }

  const all: Order[] = []
  let skip = 0
  while (skip < searchFetchSize) {
    const { data } = await app
      .database()
      .collection('orders')
      .where(condition)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(SEARCH_PAGE_SIZE)
      .get()

    const list = (data as Order[]) || []
    all.push(...list)
    // 没拉满一页 = 后面没有了，提前收工
    if (list.length < SEARCH_PAGE_SIZE) break
    skip += SEARCH_PAGE_SIZE
  }
  return all
}

/** 搜索态取数：拉最近 N 笔 → 本地过滤（分页在此不成立，故 hasMore 置否） */
async function fetchSearchResult() {
  const kw = normalizeKeyword(appliedKeyword.value).toLowerCase()
  hasMore.value = false

  try {
    const candidates = await fetchCandidatesForSearch()
    orders.value = candidates.filter(o => matchKeyword(o, kw))
  }
  catch (error) {
    console.error('搜索订单失败:', error)
    uni.showToast({
      title: error instanceof Error ? error.message : '搜索失败',
      icon: 'none',
    })
  }
}

/** 刷新（重置到第一页） */
async function refresh() {
  page.value = 0
  loading.value = true
  await fetchOrders()
  loading.value = false
}

/** 加载下一页 */
async function loadMore() {
  if (loading.value || !hasMore.value) return
  page.value += 1
  loading.value = true
  await fetchOrders()
  loading.value = false
}

// ============================================================
// 交互方法
// ============================================================

/** 切换状态 tab：重置分页并重新查询 */
function switchTab(value: TabItem['value']) {
  if (activeStatus.value === value) return
  activeStatus.value = value
  refresh()
}

/** 跳转订单详情 */
function goDetail(id?: string) {
  if (!id) return
  uni.navigateTo({ url: `/pages/order/order-detail?id=${id}` })
}

/** 去逛逛（tabBar 页用 switchTab） */
function goShopping() {
  uni.switchTab({ url: '/pages/products/products' })
}

// ============================================================
// 搜索
// ============================================================

/** 输入防抖：避免每敲一个字就查一次库 */
let searchTimer: ReturnType<typeof setTimeout> | null = null

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    appliedKeyword.value = keyword.value
    refresh()
  }, 300)
}

/** 回车 / 点软键盘的搜索键：跳过防抖立即查 */
function submitSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  appliedKeyword.value = keyword.value
  refresh()
}

/** 清空搜索；已经在非搜索态时不必重复查库 */
function clearSearch() {
  keyword.value = ''
  if (searchTimer) clearTimeout(searchTimer)
  if (appliedKeyword.value === '') return
  appliedKeyword.value = ''
  refresh()
}

// ============================================================
// 多选批量取消
// ============================================================

/** 只有待支付订单能取消：其余状态一律不可选（置灰，也不计入全选） */
function canSelect(order: Order): boolean {
  return order.status === 'pending'
}

function isSelected(id?: string): boolean {
  return !!id && selectedIds.value.includes(id)
}

/** 当前列表里可被选中的订单，供「全选」使用 */
const selectableOrders = computed(() => orders.value.filter(canSelect))
const selectableCount = computed(() => selectableOrders.value.length)
const allSelected = computed(
  () => selectableCount.value > 0 && selectableOrders.value.every(o => isSelected(o._id)),
)

/** 已选订单的合计金额（分） */
const selectedAmountCents = computed(() =>
  orders.value
    .filter(o => isSelected(o._id))
    .reduce((sum, o) => sum + orderAmountCents(o), 0),
)

/** 进入 / 退出多选模式；退出时清空选择，免得残留 id 影响下一次 */
function toggleManage() {
  selectMode.value = !selectMode.value
  selectedIds.value = []
}

function toggleSelect(order: Order) {
  if (!order._id) return
  if (!canSelect(order)) {
    uni.showToast({ title: '只有待支付订单可以取消', icon: 'none' })
    return
  }
  const index = selectedIds.value.indexOf(order._id)
  if (index >= 0) {
    selectedIds.value.splice(index, 1)
  }
  else {
    selectedIds.value.push(order._id)
  }
}

function toggleSelectAll() {
  if (selectableCount.value === 0) return
  if (allSelected.value) {
    const ids = new Set(selectableOrders.value.map(o => o._id))
    selectedIds.value = selectedIds.value.filter(id => !ids.has(id))
  }
  else {
    const ids = new Set(selectedIds.value)
    selectableOrders.value.forEach((o) => {
      if (o._id) ids.add(o._id)
    })
    selectedIds.value = [...ids]
  }
}

/** 卡片点击：多选模式下代表"勾选"，普通模式才进详情 */
function onCardTap(order: Order) {
  if (selectMode.value) {
    toggleSelect(order)
    return
  }
  goDetail(order._id)
}

/**
 * 批量取消
 *
 * 执行与计数都在 utils/order-actions 的 cancelOrdersByIds 里（那里统一走
 * 状态机、防重复提交、Mock/云端分流），这里只负责提示与收尾。
 * 有失败笔数说明本地这批数据已经过期（多半被超时关单抢先了），全量刷新即可。
 */
async function batchCancel() {
  if (selectedIds.value.length === 0) {
    uni.showToast({ title: '请先选择订单', icon: 'none' })
    return
  }

  const outcome = await cancelOrdersByIds(selectedIds.value)
  if (!outcome.confirmed) return

  if (outcome.failed === 0) {
    uni.showToast({ title: `已取消 ${outcome.succeeded} 笔`, icon: 'success' })
  }
  else {
    uni.showToast({
      title: `成功 ${outcome.succeeded} 笔，失败 ${outcome.failed} 笔`,
      icon: 'none',
      duration: 2500,
    })
  }

  toggleManage()   // 退出多选模式并清空选择
  await refresh()
}

/**
 * 支付（列表页快捷操作）
 *
 * 与详情页共用 utils/order-actions 里的同一个 payOrderById()：
 *  - 微信小程序端：真实微信支付（云函数下单 → 唤起收银台 → 主动查单确认）
 *  - 个人主体小程序 / H5 / App：模拟支付（详见 README「支付模式开关」）
 *
 * 成功后就地更新这条数据（整表 refresh 会丢掉翻页进度与滚动位置）；
 * 失败则重新拉一次 —— 本地这条很可能已经过期（例如刚被定时任务超时关单）。
 */
async function payOrder(order: Order) {
  if (!order._id) return

  const outcome = await payOrderById(order._id, order)
  if (!outcome.confirmed) return

  if (outcome.ok) {
    order.status = 'paid'
    order.paidAt = Date.now()
  }
  else {
    await refresh()
  }
}

/** 取消订单（列表页快捷操作） */
async function cancelOrder(order: Order) {
  if (!order._id) return

  const outcome = await cancelOrderById(order._id)
  if (!outcome.confirmed) return

  if (outcome.ok) {
    order.status = 'cancelled'
  }
  else {
    await refresh()
  }
}

// ============================================================
// 辅助方法
// ============================================================

/** 获取订单状态的展示信息 */
function getStatusInfo(status: OrderStatus) {
  return ORDER_STATUS_MAP[status] || ORDER_STATUS_MAP.pending
}

/** 统计订单商品总件数 */
function getTotalQty(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0)
}

/** 格式化时间 */
function formatTime(timestamp: number): string {
  return formatDate(timestamp, 'YYYY-MM-DD HH:mm')
}
</script>

<style scoped lang="scss">
.order-list-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: $app-bg-page;
}

/* ========== 状态筛选栏 ========== */
.tab-bar {
  background-color: #fff;
  white-space: nowrap;
}

.tab-list {
  display: inline-flex;
  padding: 0 10rpx;
}

.tab-item {
  padding: 20rpx 26rpx;
  font-size: 28rpx;
  color: $app-text-secondary;
  position: relative;
}

.tab-item.active {
  color: $app-color-primary;
  font-weight: 600;
}

/* 选中 tab 的下划线 */
.tab-item.active::after {
  content: '';
  position: absolute;
  left: 30%;
  right: 30%;
  bottom: 8rpx;
  height: 6rpx;
  background-color: $app-color-primary;
  border-radius: 3rpx;
}

/* ========== 列表滚动 ========== */
.list-scroll {
  flex: 1;
  padding-top: 16rpx;
}

/* ========== 空状态 ========== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}

.empty-icon {
  font-size: 110rpx;
  margin-bottom: 24rpx;
  opacity: 0.6;
}

.empty-text {
  font-size: 30rpx;
  color: $app-text-muted;
  margin-bottom: 40rpx;
}

.empty-btn {
  padding: 14rpx 56rpx;
  background: $app-gradient-primary;
  color: #fff;
  font-size: 28rpx;
  border-radius: 40rpx;
}

/* ========== 订单卡片 ========== */
.order-card {
  margin: 0 24rpx 16rpx;
  padding: 24rpx;
  background-color: #fff;
  border-radius: 16rpx;
  /* 多选模式下：左侧复选框 + 右侧卡片内容并排 */
  display: flex;
  align-items: center;
}

.card-check {
  margin-right: 20rpx;
  padding: 12rpx 0;
}

.card-body {
  flex: 1;
  /* 不加这行，超长订单号会把卡片撑破（flex 子项默认不收缩到内容宽度以下） */
  min-width: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.order-no {
  font-size: 26rpx;
  color: $app-text-muted;
}

.order-status {
  font-size: 26rpx;
  font-weight: 600;
}

/* ========== 商品缩略图 ========== */
.goods-row {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.thumb {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  background-color: #f0f0f0;
  margin-right: 16rpx;
}

.goods-count {
  font-size: 24rpx;
  color: $app-text-muted;
  margin-left: 8rpx;
}

/* 商品名：既是给用户认订单的，也是搜索命中的目标 */
.goods-name {
  margin-bottom: 20rpx;
  font-size: 28rpx;
  color: $app-text-primary;
  line-height: 1.4;
  /* 长商品名单行截断，别把卡片撑破 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ========== 卡片底部 ========== */
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-time {
  font-size: 24rpx;
  color: #bbb;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.total-price {
  font-size: 30rpx;
  font-weight: 700;
  color: $app-color-price;
}

.mini-btn {
  padding: 8rpx 24rpx;
  border-radius: 30rpx;
  font-size: 24rpx;
  font-weight: 500;
}

.mini-btn.primary {
  background: $app-gradient-primary;
  color: #fff;
}

.mini-btn.ghost {
  border: 2rpx solid #ddd;
  color: $app-text-secondary;
  background-color: #fff;
}

/* ========== 加载更多 ========== */
.load-more {
  text-align: center;
  padding: 20rpx 0;
  font-size: 24rpx;
  color: #bbb;
}

.bottom-placeholder {
  height: 40rpx;
}

/* 多选模式下底部浮着操作条，留出高度，否则最后一张卡片会被压住 */
.bottom-placeholder.with-batch-bar {
  height: 160rpx;
}

/* ========== 搜索栏 + 批量入口 ========== */
.toolbar {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  background-color: #fff;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  height: 64rpx;
  padding: 0 20rpx;
  background-color: $app-bg-page;
  border-radius: 32rpx;
}

.search-icon {
  font-size: 24rpx;
  margin-right: 10rpx;
}

.search-input {
  flex: 1;
  height: 64rpx;
  font-size: 26rpx;
}

.search-placeholder {
  color: #bbb;
}

.search-clear {
  font-size: 26rpx;
  color: #bbb;
  padding: 0 6rpx 0 12rpx;
}

.manage-btn {
  padding: 8rpx 4rpx 8rpx 20rpx;
  font-size: 28rpx;
  color: $app-text-secondary;
}

.manage-btn.active {
  color: $app-color-primary;
  font-weight: 600;
}

/* ========== 复选框 ========== */
.checkbox {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid #ddd;
  border-radius: 50%;
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.checkbox.checked {
  background-color: $app-color-primary;
  border-color: $app-color-primary;
}

/* 置灰：非待支付订单不可取消，也不参与全选 */
.checkbox.disabled {
  background-color: #f2f2f2;
  border-color: #e5e5e5;
}

.check-mark {
  font-size: 24rpx;
  line-height: 1;
  color: #fff;
}

/* ========== 批量操作条 ========== */
.batch-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 24rpx;
  /* 避开 iPhone 底部安全区 */
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background-color: #fff;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
  z-index: 10;
}

.batch-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.batch-all {
  font-size: 28rpx;
  color: $app-text-primary;
}

.batch-right {
  display: flex;
  align-items: center;
}

.batch-count {
  margin-right: 20rpx;
  font-size: 26rpx;
  color: $app-text-secondary;
}

.batch-btn {
  padding: 14rpx 36rpx;
  border-radius: 40rpx;
  font-size: 26rpx;
  color: #fff;
  background: $app-gradient-primary;
}

/* 放在渐变之后，才能覆盖掉上面的 background */
.batch-btn.disabled {
  background: #cccccc;
}
</style>
