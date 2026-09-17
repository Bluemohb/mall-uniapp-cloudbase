<!--
  ============================================================
  🧾 订单确认页 - 购物小程序第5步
  ============================================================
  这个页面是"创建订单"的核心：
  - 展示购物车选中商品（或"立即购买"的单件商品）
  - 选择收货地址（复用第4步的地址选择模式）
  - 填写备注、确认金额
  - 点击"提交订单" → 写入云数据库 orders 集合 → 跳转订单详情

  【本页面流程图】
  购物车结算 ─┐
              ├─▶ 本页（确认商品/地址/金额）─▶ 提交订单 ─▶ 订单详情页
  立即购买 ───┘

  【知识点】
  - onLoad 接收路由参数（from）区分两种下单来源
  - onShow 每次显示页面都刷新数据（从选地址页返回后要重新读地址）
  - 订单写入：db.collection('orders').add(data)
  - 下单成功后清空购物车中已购买的商品
  ============================================================
-->
<template>
  <view class="confirm-page">
    <!-- ========== 收货地址卡片 ========== -->
    <view class="address-card" @click="goSelectAddress">
      <!-- 已有地址：展示姓名/电话/完整地址 -->
      <view v-if="selectedAddress" class="address-content">
        <view class="address-header">
          <text class="address-name">{{ selectedAddress.name }}</text>
          <text class="address-phone">{{ selectedAddress.phone }}</text>
        </view>
        <view class="address-detail">{{ selectedAddress.fullAddress }}</view>
      </view>
      <!-- 没有地址：引导去添加 -->
      <view v-else class="address-empty">
        <text class="address-empty-icon">📍</text>
        <text class="address-empty-text">请选择收货地址</text>
      </view>
      <!-- 右侧箭头 -->
      <text class="address-arrow">›</text>
    </view>

    <!-- ========== 商品清单 ========== -->
    <view class="goods-card">
      <view class="card-title">商品清单</view>
      <view v-for="(item, index) in items" :key="index" class="goods-item">
        <image :src="item.image || '/static/logo.png'" class="goods-image" mode="aspectFill" lazy-load />
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

    <!-- ========== 订单备注 ========== -->
    <view class="remark-card">
      <text class="card-title">订单备注</text>
      <input
        v-model="remark"
        class="remark-input"
        placeholder="选填，给商家留言"
        :maxlength="50"
      />
    </view>

    <!-- ========== 金额汇总 ========== -->
    <view class="summary-card">
      <view class="summary-row">
        <text class="summary-label">商品总额</text>
        <text class="summary-value">¥{{ totalPriceText }}</text>
      </view>
      <view class="summary-row">
        <text class="summary-label">运费</text>
        <text class="summary-value">¥0.00</text>
      </view>
      <view class="summary-row total">
        <text class="summary-label">应付总额</text>
        <text class="summary-total">¥{{ totalPriceText }}</text>
      </view>
    </view>

    <!-- ========== 底部提交栏 ========== -->
    <view class="footer-bar">
      <view class="footer-total">
        <text class="footer-label">合计：</text>
        <text class="footer-price">¥{{ totalPriceText }}</text>
      </view>
      <view
        class="submit-btn"
        :class="{ disabled: submitting }"
        @click="submitOrder"
      >
        {{ submitting ? '提交中...' : '提交订单' }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { app, getUid } from '@/utils/cloudbase'
import { createOrderViaCloud, generateOrderNo } from './order'
import type { CreateOrderPayload, OrderAddress, OrderItem, OrderStatus } from './order'
import { calcTotalCents, formatCents, formatMoney, toYuan } from '@/utils/money'
import { CACHE_KEYS, getCache, removeCache, setCache } from '@/utils/cache'
import { ensureCartUid, readCart, writeCart } from '@/utils/cart'

// Mock 数据层：由订单开关控制（USE_ORDER_MOCK，未配置时继承全局开关）
import { USE_ORDER_MOCK } from '@/utils/mock'
import { MOCK_USER_ID, mockCreateOrder } from './order-mock'
import { getErrorMessage, reportError } from '@/utils/error'

/** 本页路由参数 */
interface ConfirmPageQuery {
  from?: 'cart' | 'buynow'
}

// ============================================================
// 响应式数据
// ============================================================

/** 待下单的商品列表 */
const items = ref<OrderItem[]>([])

/** 已选中的收货地址（从本地存储读取，地址页选中后写入） */
const selectedAddress = ref<OrderAddress | null>(null)

/** 订单备注 */
const remark = ref('')

/** 是否正在提交（防止重复点击） */
const submitting = ref(false)

/** 下单来源：'cart' = 购物车结算，'buynow' = 立即购买 */
const from = ref<'cart' | 'buynow'>('cart')

// ============================================================
// 计算属性
// ============================================================

/** 应付总金额（分）= Σ(单价 × 数量)，整数运算避免浮点误差 */
const totalCents = computed(() => calcTotalCents(items.value))

/** 应付总金额展示文本（元，两位小数） */
const totalPriceText = computed(() => formatCents(totalCents.value))

// ============================================================
// 页面生命周期
// ============================================================

/**
 * onLoad：读取路由参数 from，决定从哪个存储读商品
 *
 * 【知识点】路由参数获取
 * 跳转时：uni.navigateTo({ url: '/pages/order/order-confirm?from=cart' })
 * 这里：options.from 就能拿到 'cart'
 */
onLoad((options?: ConfirmPageQuery) => {
  from.value = options?.from === 'buynow' ? 'buynow' : 'cart'
})

/**
 * onShow：每次页面显示都刷新数据
 *
 * 为什么不用 onLoad 一次性读取？
 * 因为用户可能点击"选择地址"跳转，选完返回本页，
 * onLoad 不会再次触发，但 onShow 会！所以要在这里读地址。
 */
onShow(async () => {
  loadItems()
  await loadAddress()
})

// ============================================================
// 数据读取
// ============================================================

/**
 * 读取待下单商品
 * - 购物车结算：cart.vue 写入的 checkout_items
 * - 立即购买：product-detail.vue 写入的 buy_now_item
 * 统一转换成 OrderItem 结构
 */
function loadItems() {
  const key = from.value === 'cart' ? 'checkout_items' : 'buy_now_item'
  const raw = uni.getStorageSync(key)
  items.value = Array.isArray(raw) ? (raw as OrderItem[]) : []
}

/**
 * 读取收货地址，优先级：
 * 1. 订单页刚选中的地址
 * 2. 本地缓存里的默认地址（带过期时间，过期自动回源）
 * 3. 数据库默认地址
 * 4. 没有地址时展示空态
 *
 * ⚠️ 默认地址缓存必须带失效时间：用户可能在地址页改了默认地址，
 *    若本地缓存永不过期，这里会一直用旧地址下单。
 */
async function loadAddress() {
  const selected = uni.getStorageSync('selected_address')
  if (selected) {
    selectedAddress.value = selected as OrderAddress
    return
  }

  // getCache 内部会校验过期时间，过期/旧版裸数据会返回 null 并清理
  const cachedDefault = getCache<OrderAddress>(CACHE_KEYS.defaultAddress)
  if (cachedDefault) {
    selectedAddress.value = cachedDefault
    return
  }

  try {
    const uid = await getUid()

    const { data } = await app
      .database()
      .collection('addresses')
      .where({
        userId: uid,
        isDefault: true,
      })
      .limit(1)
      .get()

    const item = data?.[0]
    if (!item) {
      selectedAddress.value = null
      return
    }

    const defaultAddress: OrderAddress = {
      name: item.name,
      phone: item.phone,
      fullAddress: `${item.province}${item.city}${item.district} ${item.detail}`,
    }

    setCache(CACHE_KEYS.defaultAddress, defaultAddress)
    selectedAddress.value = defaultAddress
  } catch (error) {
    // 静默降级：读不到默认地址就让用户手动选，不弹 toast
    reportError('加载默认地址', error, { toast: false })
    selectedAddress.value = null
  }
}

// ============================================================
// 交互方法
// ============================================================

/** 点击地址卡片 → 跳转地址选择模式（第4步已实现） */
function goSelectAddress() {
  uni.navigateTo({ url: '/pages/address/address-list?mode=select' })
}

/**
 * 提交订单（本页核心逻辑）
 *
 * 【步骤拆解】
 * 1. 校验：有商品 + 已选地址
 * 2. 组装请求（mock 分支本地落单 / 云端分支调云函数）
 * 3. 云端：由 createOrder 云函数做「服务端定价 + 归属 + 初始状态」，
 *    客户端不再直接写 orders 集合，避免金额/状态被篡改
 * 4. 清理：购物车移除已购商品 + 删除临时存储
 * 5. 跳转订单详情页
 */
async function submitOrder() {
  // ---- 1. 校验 ----
  if (items.value.length === 0) {
    uni.showToast({ title: '没有可结算的商品', icon: 'none' })
    return
  }
  if (!selectedAddress.value) {
    uni.showToast({ title: '请先选择收货地址', icon: 'none' })
    return
  }
  if (submitting.value) return

  submitting.value = true
  uni.showLoading({ title: '正在提交...', mask: true })

  try {
    // ---- 2. 下单 ----
    let orderId = ''

    if (USE_ORDER_MOCK) {
      // ===== Mock 模式（USE_ORDER_MOCK）：订单落本地，不依赖云端登录态 =====
      const orderData = {
        orderNo: generateOrderNo(),
        userId: MOCK_USER_ID,
        items: items.value,
        address: selectedAddress.value,
        totalPrice: toYuan(totalCents.value),
        totalPriceCents: totalCents.value,
        status: 'pending' as OrderStatus,
        remark: remark.value.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const order = mockCreateOrder(orderData)
      orderId = order._id
    }
    else {
      // ===== 云端模式（生产构建）：调用云函数 =====
      // 客户端只提交「商品ID + 数量 + 规格」，价格/库存/归属/状态全部由服务端决定
      const payload: CreateOrderPayload = {
        items: items.value.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          specs: item.specs || '',
        })),
        address: selectedAddress.value,
        remark: remark.value.trim(),
      }
      orderId = await createOrderViaCloud(payload)
    }

    // ---- 3. 清理数据 ----
    if (from.value === 'cart') {
      // 购物车来源：把已购买的商品从购物车移除
      await ensureCartUid()
      removePurchasedFromCart()
    }
    // 删除"立即购买"的临时数据
    uni.removeStorageSync('buy_now_item')
    // 删除"购物车结算"的临时数据
    uni.removeStorageSync('checkout_items')
    // 删除"已选地址"的临时数据
    uni.removeStorageSync('selected_address')
    // 下单会改变库存/销量，主动失效首页推荐缓存，避免回到首页读到旧数据
    removeCache(CACHE_KEYS.homeRecommend)

    uni.hideLoading()
    uni.showToast({ title: '订单提交成功', icon: 'success' })

    // ---- 4. 跳转订单详情页 ----
    // redirectTo：关闭当前确认页，防止返回后重复提交
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/order/order-detail?id=${orderId}` })
    }, 600)
  } catch (error) {
    uni.hideLoading()
    // 云函数会带上业务原因（如库存不足），优先展示它的文案
    reportError('提交订单', error, { toast: getErrorMessage(error, '提交失败，请重试') })
  } finally {
    submitting.value = false
  }
}

/**
 * 从购物车中移除本次已下单的商品
 * 匹配条件：productId + specs 都相同（和加入购物车的去重逻辑一致）
 * 购物车读写统一走 cart.ts（本地镜像 + 云端 carts 集合），不再直接读写 storage
 */
function removePurchasedFromCart() {
  const cartList = readCart()

  const remain = cartList.filter(cartItem =>
    // 保留那些"不在本次订单商品中"的购物车项
    !items.value.some(orderItem =>
      orderItem.productId === cartItem.productId
      && (orderItem.specs || '') === (cartItem.specs || ''),
    ),
  )

  writeCart(remain)
}
</script>

<style scoped lang="scss">
.confirm-page {
  min-height: 100vh;
  background-color: $app-bg-page;
  padding-bottom: 160rpx;
}

/* ========== 地址卡片 ========== */
.address-card {
  display: flex;
  align-items: center;
  margin: 20rpx 24rpx;
  padding: 28rpx 24rpx;
  background-color: #fff;
  border-radius: 16rpx;
}

.address-content {
  flex: 1;
  min-width: 0;
}

.address-header {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.address-name {
  font-size: 30rpx;
  font-weight: 600;
  color: $app-text-primary;
  margin-right: 20rpx;
}

.address-phone {
  font-size: 28rpx;
  color: $app-text-secondary;
}

.address-detail {
  font-size: 26rpx;
  color: $app-text-secondary;
  line-height: 1.5;
}

.address-empty {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.address-empty-icon {
  font-size: 40rpx;
}

.address-empty-text {
  font-size: 30rpx;
  color: $app-text-muted;
}

.address-arrow {
  font-size: 40rpx;
  color: #ccc;
  margin-left: 16rpx;
}

/* ========== 卡片通用 ========== */
.goods-card,
.remark-card,
.summary-card {
  margin: 0 24rpx 20rpx;
  padding: 24rpx;
  background-color: #fff;
  border-radius: 16rpx;
}

.card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $app-text-primary;
  margin-bottom: 20rpx;
}

/* ========== 商品清单 ========== */
.goods-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
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
  color: $app-text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8rpx;
}

.goods-specs {
  font-size: 24rpx;
  color: $app-text-muted;
}

.goods-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 16rpx;
}

.goods-price {
  font-size: 28rpx;
  color: $app-color-price;
  font-weight: 500;
}

.goods-qty {
  font-size: 24rpx;
  color: $app-text-muted;
  margin-top: 4rpx;
}

/* ========== 备注 ========== */
.remark-input {
  background-color: #f7f7f7;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  color: $app-text-primary;
}

/* ========== 金额汇总 ========== */
.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 0;
}

.summary-label {
  font-size: 26rpx;
  color: $app-text-secondary;
}

.summary-value {
  font-size: 26rpx;
  color: $app-text-primary;
}

.summary-row.total {
  margin-top: 8rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}

.summary-total {
  font-size: 34rpx;
  font-weight: 700;
  color: $app-color-price;
}

/* ========== 底部提交栏 ========== */
.footer-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background-color: #fff;
  border-top: 1rpx solid #eee;
}

.footer-total {
  display: flex;
  align-items: baseline;
}

.footer-label {
  font-size: 26rpx;
  color: $app-text-secondary;
}

.footer-price {
  font-size: 36rpx;
  font-weight: 700;
  color: $app-color-price;
}

.submit-btn {
  padding: 18rpx 50rpx;
  background: $app-gradient-primary;
  color: #fff;
  font-size: 30rpx;
  font-weight: 500;
  border-radius: 44rpx;
}

.submit-btn.disabled {
  opacity: 0.5;
}
</style>
