<!--
  ============================================================
  📦 订单列表页 - 购物小程序第5步
  ============================================================
  这个页面展示了：
  - 按状态筛选订单（全部/待支付/已支付/已发货/已完成/已取消）
  - 分页加载 + 下拉刷新（和商品列表页 products.vue 同样的套路）
  - 订单卡片：订单号、状态、商品缩略图、金额、时间
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
        <text class="empty-text">暂无相关订单</text>
        <view class="empty-btn" @click="goShopping">去逛逛</view>
      </view>

      <!-- 订单卡片 -->
      <view
        v-for="order in orders"
        :key="order._id"
        class="order-card"
        @click="goDetail(order._id)"
      >
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
          />
          <text class="goods-count">共 {{ getTotalQty(order) }} 件</text>
        </view>

        <!-- 底部：时间 + 金额 + 操作 -->
        <view class="card-footer">
          <text class="order-time">{{ formatTime(order.createdAt) }}</text>
          <view class="footer-right">
            <text class="total-price">¥{{ formatCents(orderAmountCents(order)) }}</text>
            <!-- 待支付订单的快捷操作 -->
            <template v-if="order.status === 'pending'">
              <view class="mini-btn ghost" @click.stop="cancelOrder(order)">取消</view>
              <view class="mini-btn primary" @click.stop="payOrder(order)">去支付</view>
            </template>
          </view>
        </view>
      </view>

      <!-- 加载更多状态 -->
      <view v-if="orders.length > 0" class="load-more">
        <text>{{ hasMore ? (loading ? '加载中...' : '上拉加载更多') : '没有更多了' }}</text>
      </view>
      <view class="bottom-placeholder" />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { app, getUid } from '@/utils/cloudbase'
import { formatDate } from '@/utils/index'
import {
  ORDER_STATUS_MAP,
  orderAmountCents,
  updateOrderStatusViaCloud,
  type Order,
  type OrderStatus,
} from '@/utils/order'
import { formatCents } from '@/utils/money'

// Mock 数据层：由订单开关控制（USE_ORDER_MOCK，未配置时继承全局开关）
import { USE_ORDER_MOCK } from '@/utils/mock'
import { mockQueryOrders, mockUpdateOrder } from '@/utils/order-mock'

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

/**
 * 模拟支付（列表页快捷操作）
 * 与详情页 payOrder 逻辑一致，独立实现方便列表页单独使用
 */
function payOrder(order: Order) {
  uni.showModal({
    title: '模拟支付',
    content: `确认支付 ¥${formatCents(orderAmountCents(order))} 吗？`,
    confirmText: '确认支付',
    success: async (res) => {
      if (!res.confirm || !order._id) return
      try {
        if (USE_ORDER_MOCK) {
          mockUpdateOrder(order._id, {
            status: 'paid',
            paidAt: Date.now(),
            updatedAt: Date.now(),
          })
        }
        else {
          // 云端：走云函数，状态流转与归属由服务端校验
          await updateOrderStatusViaCloud(order._id, 'paid')
        }
        uni.showToast({ title: '支付成功', icon: 'success' })
        // 本地更新状态，无需重新请求
        order.status = 'paid'
      }
      catch (error) {
        console.error('支付失败:', error)
        uni.showToast({ title: error instanceof Error ? error.message : '支付失败', icon: 'none' })
      }
    },
  })
}

/** 取消订单（列表页快捷操作） */
function cancelOrder(order: Order) {
  uni.showModal({
    title: '取消订单',
    content: '确定要取消该订单吗？',
    success: async (res) => {
      if (!res.confirm || !order._id) return
      try {
        if (USE_ORDER_MOCK) {
          mockUpdateOrder(order._id, {
            status: 'cancelled',
            updatedAt: Date.now(),
          })
        }
        else {
          // 云端：走云函数，状态流转与归属由服务端校验
          await updateOrderStatusViaCloud(order._id, 'cancelled')
        }
        uni.showToast({ title: '已取消', icon: 'success' })
        order.status = 'cancelled'
      }
      catch (error) {
        console.error('取消订单失败:', error)
        uni.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' })
      }
    },
  })
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

<style scoped>
.order-list-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
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
  color: #666;
  position: relative;
}

.tab-item.active {
  color: #667eea;
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
  background-color: #667eea;
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
  color: #999;
  margin-bottom: 40rpx;
}

.empty-btn {
  padding: 14rpx 56rpx;
  background: linear-gradient(135deg, #667eea, #764ba2);
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
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.order-no {
  font-size: 26rpx;
  color: #999;
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
  color: #999;
  margin-left: 8rpx;
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
  color: #e7493b;
}

.mini-btn {
  padding: 8rpx 24rpx;
  border-radius: 30rpx;
  font-size: 24rpx;
  font-weight: 500;
}

.mini-btn.primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

.mini-btn.ghost {
  border: 2rpx solid #ddd;
  color: #666;
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
</style>
