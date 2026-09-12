<!--
  ============================================================
  📋 订单详情页 - 购物小程序第5步
  ============================================================
  这个页面展示了：
  - 单条订单的完整信息（状态/地址/商品/金额/时间）
  - 按订单状态显示不同的操作按钮，实现状态流转：
      待支付 → 模拟支付 / 取消订单
      已支付 → 模拟发货 / 确认收货
      已发货 → 确认收货

  【状态流转图】
  pending(待支付) ──支付──▶ paid(已支付) ──发货──▶ shipped(已发货) ──收货──▶ completed(已完成)
        │
        └──────── 取消 ─────────▶ cancelled(已取消)

  【知识点】
  - doc(id).get() 查询单条数据（和商品详情页一样）
  - doc(id).update(data) 更新指定字段
  - 模拟支付：真实微信支付需要商户号，用"弹窗确认"代替，
    并在注释中说明真实接入方式（uni.requestPayment）
  ============================================================
-->
<template>
  <view class="detail-page">
    <!-- ========== 加载中 ========== -->
    <view v-if="loading" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>

    <template v-else-if="order">
      <!-- ========== 状态横幅 ========== -->
      <view class="status-banner" :style="{ background: statusInfo.color }">
        <text class="status-label">{{ statusInfo.label }}</text>
        <text class="status-tip">{{ statusTip }}</text>
      </view>

      <!-- ========== 收货地址 ========== -->
      <view class="address-card">
        <view class="address-header">
          <text class="address-name">{{ order.address.name }}</text>
          <text class="address-phone">{{ order.address.phone }}</text>
        </view>
        <view class="address-detail">{{ order.address.fullAddress }}</view>
      </view>

      <!-- ========== 商品列表 ========== -->
      <view class="goods-card">
        <view v-for="(item, index) in order.items" :key="index" class="goods-item">
          <image :src="item.image || '/static/logo.png'" class="goods-image" mode="aspectFill" />
          <view class="goods-info">
            <text class="goods-name">{{ item.name }}</text>
            <text v-if="item.specs" class="goods-specs">{{ item.specs }}</text>
          </view>
          <view class="goods-right">
            <text class="goods-price">¥{{ formatMoney(item.price) }}</text>
            <text class="goods-qty">x{{ item.quantity }}</text>
          </view>
        </view>
      </view>

      <!-- ========== 金额明细 ========== -->
      <view class="summary-card">
        <view class="summary-row">
          <text class="summary-label">商品总额</text>
          <text class="summary-value">¥{{ formatCents(orderAmountCents(order)) }}</text>
        </view>
        <view class="summary-row">
          <text class="summary-label">运费</text>
          <text class="summary-value">¥0.00</text>
        </view>
        <view class="summary-row total">
          <text class="summary-label">实付款</text>
          <text class="summary-total">¥{{ formatCents(orderAmountCents(order)) }}</text>
        </view>
      </view>

      <!-- ========== 订单信息 ========== -->
      <view class="info-card">
        <view class="info-row">
          <text class="info-label">订单编号</text>
          <text class="info-value">{{ order.orderNo }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">下单时间</text>
          <text class="info-value">{{ formatTime(order.createdAt) }}</text>
        </view>
        <view v-if="order.paidAt" class="info-row">
          <text class="info-label">支付时间</text>
          <text class="info-value">{{ formatTime(order.paidAt) }}</text>
        </view>
        <view v-if="order.remark" class="info-row">
          <text class="info-label">订单备注</text>
          <text class="info-value">{{ order.remark }}</text>
        </view>
      </view>

      <!-- ========== 底部操作栏（按状态显示） ========== -->
      <view class="action-bar">
        <template v-if="order.status === 'pending'">
          <view class="action-btn ghost" @click="cancelOrder">取消订单</view>
          <view class="action-btn primary" @click="payOrder">模拟支付</view>
        </template>
        <template v-else-if="order.status === 'paid'">
          <view class="action-btn ghost" @click="shipOrder">模拟发货</view>
          <view class="action-btn primary" @click="completeOrder">确认收货</view>
        </template>
        <template v-else-if="order.status === 'shipped'">
          <view class="action-btn primary" @click="completeOrder">确认收货</view>
        </template>
      </view>
      <!-- 底部占位，防止操作栏遮挡内容 -->
      <view class="action-bar-placeholder" />
    </template>

    <!-- ========== 订单不存在 ========== -->
    <view v-else class="not-found">
      <text class="not-found-text">订单不存在或已被删除</text>
      <view class="not-found-btn" @click="goOrderList">查看全部订单</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { app, getUid } from '@/utils/cloudbase'
import { formatDate } from '@/utils/index'
import {
  ORDER_STATUS_MAP,
  orderAmountCents,
  updateOrderStatusViaCloud,
  type Order,
  type OrderStatus,
} from '@/utils/order'
import { formatCents, formatMoney } from '@/utils/money'

// Mock 数据层：由订单开关控制（USE_ORDER_MOCK，未配置时继承全局开关）
import { USE_ORDER_MOCK } from '@/utils/mock'
import { mockGetOrderById, mockUpdateOrder } from '@/utils/order-mock'

/** 订单详情页路由参数 */
interface OrderDetailQuery {
  id?: string
}

// ============================================================
// 响应式数据
// ============================================================

/** 订单ID（从路由参数获取） */
const orderId = ref('')

/** 订单详情数据 */
const order = ref<Order | null>(null)

/** 是否正在加载 */
const loading = ref(true)

/** 是否正在执行操作（防止重复点击） */
const acting = ref(false)

// ============================================================
// 计算属性
// ============================================================

/** 当前状态的展示信息（中文名 + 颜色），取自 utils/order 映射表 */
const statusInfo = computed(() =>
  ORDER_STATUS_MAP[order.value?.status || 'pending'],
)

/** 状态对应的提示文案 */
const statusTip = computed(() => {
  switch (order.value?.status) {
    case 'pending': return '请尽快完成支付'
    case 'paid': return '商家正在处理中'
    case 'shipped': return '商品正在路上'
    case 'completed': return '交易已完成'
    case 'cancelled': return '订单已取消'
    default: return ''
  }
})

// ============================================================
// 页面生命周期
// ============================================================

onLoad((options?: OrderDetailQuery) => {
  if (options?.id) {
    orderId.value = options.id
    fetchOrderDetail(options.id)
  }
  else {
    uni.showToast({ title: '参数错误', icon: 'none' })
    loading.value = false
  }
})

// ============================================================
// 数据加载
// ============================================================

/**
 * 查询订单详情
 *
 * 【为什么不用 doc(id).get()？】
 * orders 集合安全规则是 { "read": "auth.uid != null && doc.userId == auth.uid" }，
 * CloudBase 会做「查询条件子集校验」：查询必须自带能覆盖安全规则的条件，
 * 只按 _id 查询（doc(id).get() / where({_id})）会被直接拒绝，
 * 客户端只会看到一条难以理解的报错（formatResDocumentData 崩溃）。
 * 所以这里把归属条件一并写进查询：既能读到订单，也天然只能读自己的订单。
 */
async function fetchOrderDetail(id: string) {
  loading.value = true
  try {
    // ===== Mock 模式（USE_ORDER_MOCK）：读本地订单 =====
    if (USE_ORDER_MOCK) {
      order.value = mockGetOrderById(id)
      return
    }
    const uid = await getUid()
    const { data } = await app
      .database()
      .collection('orders')
      .where({ userId: uid, _id: id })
      .limit(1)
      .get()
    order.value = (data && data[0]) as Order || null
  } catch (error) {
    console.error('查询订单详情失败:', error)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// ============================================================
// 状态流转操作
// ============================================================

/**
 * 通用的"更新订单状态"方法
 * 支付/取消/发货/收货都复用它，减少重复代码
 */
async function updateOrderStatus(status: OrderStatus, extra?: Partial<Order>) {
  if (acting.value) return
  acting.value = true

  try {
    const updatedAt = Date.now()

    if (USE_ORDER_MOCK) {
      // ===== Mock 模式（USE_ORDER_MOCK）：更新本地订单 =====
      const updated = mockUpdateOrder(orderId.value, {
        status,
        updatedAt,
        ...extra,
      })
      if (!updated) {
        throw new Error('订单不存在')
      }
      // 本地同步更新，避免重新请求
      order.value = { ...order.value!, status, updatedAt, ...extra }
    }
    else {
      // ===== 云端模式：走云函数 =====
      // 服务端会校验「订单归属」与「状态流转合法性」，客户端不能越权改单
      await updateOrderStatusViaCloud(orderId.value, status)
      order.value = {
        ...order.value!,
        status,
        updatedAt,
        ...(status === 'paid' ? { paidAt: updatedAt } : {}),
      }
    }

    uni.showToast({ title: '操作成功', icon: 'success' })
  }
  catch (error) {
    console.error('更新订单状态失败:', error)
    uni.showToast({ title: error instanceof Error ? error.message : '操作失败，请重试', icon: 'none' })
    // 失败最常见的原因是「订单状态已经被别处改掉了」：例如待支付订单刚被定时任务
    // closeExpiredOrders 超时关单，或用户在别的入口已经操作过。
    // 此时本地这份 order 是过期数据，重新拉一次让页面回到真实状态，
    // 否则用户会对着一个假的「待支付」反复点按钮、每次都失败。
    if (!USE_ORDER_MOCK && orderId.value) {
      fetchOrderDetail(orderId.value)
    }
  }
  finally {
    acting.value = false
  }
}

/**
 * 模拟支付（待支付 → 已支付）
 *
 * 【真实支付怎么接？】
 * 1. 前端调云函数创建支付单（预下单）
 * 2. 云函数用微信支付接口返回支付参数
 * 3. 前端 uni.requestPayment({ timeStamp, nonceStr, package, signType, paySign })
 * 4. 支付成功后（success 回调）再调用云函数确认订单已支付
 * 需要企业资质开通微信支付商户号，本教程用"模拟支付"演示状态流转。
 */
function payOrder() {
  uni.showModal({
    title: '模拟支付',
    content: `确认支付 ¥${order.value ? formatCents(orderAmountCents(order.value)) : '0.00'} 吗？\n（真实项目此处调用微信支付）`,
    confirmText: '确认支付',
    success: (res) => {
      if (res.confirm) {
        updateOrderStatus('paid', { paidAt: Date.now() })
      }
    },
  })
}

/** 取消订单（待支付 → 已取消） */
function cancelOrder() {
  uni.showModal({
    title: '取消订单',
    content: '确定要取消该订单吗？',
    success: (res) => {
      if (res.confirm) {
        updateOrderStatus('cancelled')
      }
    },
  })
}

/**
 * 模拟发货（已支付 → 已发货）
 * 真实项目中"发货"是商家后台的操作，这里提供按钮便于演示完整状态流转
 */
function shipOrder() {
  uni.showModal({
    title: '模拟发货',
    content: '确认已发货？（真实场景由商家后台操作）',
    success: (res) => {
      if (res.confirm) {
        updateOrderStatus('shipped')
      }
    },
  })
}

/** 确认收货（已支付/已发货 → 已完成） */
function completeOrder() {
  uni.showModal({
    title: '确认收货',
    content: '确认已收到商品吗？',
    success: (res) => {
      if (res.confirm) {
        updateOrderStatus('completed')
      }
    },
  })
}

// ============================================================
// 其他方法
// ============================================================

/** 格式化时间戳为可读文本 */
function formatTime(timestamp?: number): string {
  if (!timestamp) return '-'
  return formatDate(timestamp, 'YYYY-MM-DD HH:mm:ss')
}

/** 跳转订单列表页 */
function goOrderList() {
  uni.navigateTo({ url: '/pages/order/order-list' })
}
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

/* ========== 加载状态 ========== */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50vh;
}

.loading-text {
  font-size: 28rpx;
  color: #999;
}

/* ========== 状态横幅 ========== */
.status-banner {
  display: flex;
  flex-direction: column;
  padding: 50rpx 40rpx;
  color: #fff;
}

.status-label {
  font-size: 44rpx;
  font-weight: 700;
  margin-bottom: 10rpx;
}

.status-tip {
  font-size: 26rpx;
  opacity: 0.9;
}

/* ========== 地址卡片 ========== */
.address-card {
  margin: -30rpx 24rpx 20rpx;
  padding: 28rpx 24rpx;
  background-color: #fff;
  border-radius: 16rpx;
}

.address-header {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.address-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-right: 20rpx;
}

.address-phone {
  font-size: 28rpx;
  color: #666;
}

.address-detail {
  font-size: 26rpx;
  color: #666;
  line-height: 1.5;
}

/* ========== 卡片通用 ========== */
.goods-card,
.summary-card,
.info-card {
  margin: 0 24rpx 20rpx;
  padding: 24rpx;
  background-color: #fff;
  border-radius: 16rpx;
}

/* ========== 商品列表 ========== */
.goods-item {
  display: flex;
  align-items: center;
  padding: 12rpx 0;
}

.goods-image {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  background-color: #f0f0f0;
  flex-shrink: 0;
  margin-right: 20rpx;
}

.goods-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.goods-name {
  font-size: 28rpx;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8rpx;
}

.goods-specs {
  font-size: 24rpx;
  color: #999;
}

.goods-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 16rpx;
}

.goods-price {
  font-size: 28rpx;
  color: #e7493b;
  font-weight: 500;
}

.goods-qty {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
}

/* ========== 金额明细 ========== */
.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 0;
}

.summary-label {
  font-size: 26rpx;
  color: #666;
}

.summary-value {
  font-size: 26rpx;
  color: #333;
}

.summary-row.total {
  margin-top: 8rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}

.summary-total {
  font-size: 34rpx;
  font-weight: 700;
  color: #e7493b;
}

/* ========== 订单信息 ========== */
.info-row {
  display: flex;
  justify-content: space-between;
  padding: 10rpx 0;
}

.info-label {
  font-size: 26rpx;
  color: #999;
  flex-shrink: 0;
  margin-right: 20rpx;
}

.info-value {
  font-size: 26rpx;
  color: #333;
  text-align: right;
  word-break: break-all;
}

/* ========== 底部操作栏 ========== */
.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: 20rpx;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background-color: #fff;
  border-top: 1rpx solid #eee;
}

.action-bar-placeholder {
  height: 120rpx;
}

.action-btn {
  padding: 16rpx 40rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 500;
}

.action-btn.primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

.action-btn.ghost {
  border: 2rpx solid #ddd;
  color: #666;
  background-color: #fff;
}

/* ========== 订单不存在 ========== */
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  gap: 30rpx;
}

.not-found-text {
  font-size: 30rpx;
  color: #999;
}

.not-found-btn {
  padding: 16rpx 50rpx;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 28rpx;
  border-radius: 40rpx;
}
</style>
