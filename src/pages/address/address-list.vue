<!--
  ============================================================
  📍 收货地址列表页 - 购物小程序第4步
  ============================================================
  这个页面展示了：
  - 从 CloudBase 数据库读取用户的所有收货地址
  - 支持“管理模式”（增删改设默认）和“选择模式”（结算时选地址）
  - 空状态提示
  - 返回选中地址给上一页

  【知识点】
  - CloudBase 数据库 CRUD（app.database().collection()）
  - uni.navigateBack / 页面传参（mode、selected address）
  - picker mode="region" 在地址表单中使用
  ============================================================
-->
<template>
  <view class="address-list-page">
    <!-- ========== 空状态 ========== -->
    <view v-if="!loading && addressList.length === 0" class="empty-state">
      <view class="empty-icon">📍</view>
      <text class="empty-text">暂无收货地址</text>
      <text class="empty-hint">点击下方按钮添加新地址</text>
    </view>

    <!-- ========== 地址列表 ========== -->
    <scroll-view v-else class="list-scroll" scroll-y enhanced :show-scrollbar="false">
      <view
        v-for="(item, index) in addressList"
        :key="item._id"
        class="address-card"
        :class="{ 'is-select-mode': mode === 'select' }"
        @click="onAddressClick(item)"
      >
        <!-- 选中模式下的勾选图标 -->
        <view v-if="mode === 'select'" class="select-indicator">
          <view class="radio-dot" :class="{ active: selectedId === item._id }">
            <view v-if="selectedId === item._id" class="radio-inner" />
          </view>
        </view>

        <view class="card-content">
          <!-- 姓名 + 手机号 -->
          <view class="card-header">
            <text class="contact-name">{{ item.name }}</text>
            <text class="contact-phone">{{ item.phone }}</text>
            <view v-if="item.isDefault" class="default-tag">
              <text>默认</text>
            </view>
          </view>

          <!-- 完整地址 -->
          <view class="address-text">
            {{ item.province }}{{ item.city }}{{ item.district }} {{ item.detail }}
          </view>
        </view>

        <!-- 管理模式下的操作按钮 -->
        <view v-if="mode === 'manage'" class="card-actions">
          <view v-if="!item.isDefault" class="action-link" @click.stop="setDefault(item._id)">
            <text>设为默认</text>
          </view>
          <view class="action-link action-edit" @click.stop="goEdit(item._id)">
            <text>编辑</text>
          </view>
          <view class="action-link action-delete" @click.stop="onDelete(item._id, index)">
            <text>删除</text>
          </view>
        </view>
      </view>

      <view class="bottom-placeholder" />
    </scroll-view>

    <!-- ========== 底部新增按钮 ========== -->
    <view class="bottom-bar">
      <view class="add-btn" @click="goAdd">
        <text class="add-icon">+</text>
        <text>新增收货地址</text>
      </view>
    </view>

    <!-- ========== 加载遮罩 ========== -->
    <view v-if="loading" class="loading-mask">
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { app, login } from '@/utils/cloudbase'

// ============================================================
// 类型定义
// ============================================================

interface Address {
  _id: string
  userId: string
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

// ============================================================
// 页面参数
// ============================================================

interface PageQuery {
  mode?: string  // 'select' | 'manage'（默认管理）
}

// ============================================================
// 响应式数据
// ============================================================

const addressList = ref<Address[]>([])
const loading = ref(true)
const selectedId = ref('')
const mode = ref<'manage' | 'select'>('manage')

// ============================================================
// 初始化
// ============================================================

onMounted(() => {
  // 读取页面参数，判断是否为选择模式
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const query = (currentPage?.$page?.options || {}) as PageQuery
  if (query.mode === 'select') {
    mode.value = 'select'
  }
})

onShow(() => {
  fetchAddresses()
})

// ============================================================
// 数据加载
// ============================================================

async function getUserId(): Promise<string> {
  await login()
  const { data } = await app.auth.getSession()
  // 安全提取 uid
  const uid = data?.session?.user?.id || ''
  return uid
}

async function fetchAddresses() {
  loading.value = true
  try {
    const uid = await getUserId()
    if (!uid) {
      console.warn('未获取到用户ID')
      addressList.value = []
      return
    }

    const { data } = await app
      .database()
      .collection('addresses')
      .where({ userId: uid })
      .orderBy('isDefault', 'desc')
      // .orderBy('updatedAt', 'desc')
      .get()

    addressList.value = (data as Address[]) || []
  } catch (error) {
    console.error('获取地址列表失败:', error)
    uni.showToast({ title: '加载地址失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// ============================================================
// 用户交互
// ============================================================

function onAddressClick(item: Address) {
  if (mode.value === 'select') {
    // 选择模式：选中并返回
    selectedId.value = item._id
    // 将选中地址存入本地存储，供订单页使用
    uni.setStorageSync('selected_address', {
      _id: item._id,
      name: item.name,
      phone: item.phone,
      fullAddress: `${item.province}${item.city}${item.district} ${item.detail}`,
    })
    uni.navigateBack()
  }
  // 管理模式下点击不响应
}

function goAdd() {
  uni.navigateTo({ url: '/pages/address/address-form' })
}

function goEdit(id: string) {
  uni.navigateTo({ url: `/pages/address/address-form?id=${id}` })
}

async function setDefault(id: string) {
  try {
    const uid = await getUserId()
    if (!uid) return

    // 先清除该用户所有默认地址
    const { data: defaults } = await app
      .database()
      .collection('addresses')
      .where({ userId: uid, isDefault: true })
      .get()

    const batch = (defaults as Address[]).map(item =>
      app.database().collection('addresses').doc(item._id).update({ isDefault: false, updatedAt: Date.now() })
    )
    await Promise.all(batch)

    // 设置当前为默认
    await app.database().collection('addresses').doc(id).update({
      isDefault: true,
      updatedAt: Date.now(),
    })

    uni.showToast({ title: '已设为默认地址', icon: 'success' })
    fetchAddresses()
  } catch (error) {
    console.error('设置默认地址失败:', error)
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

function onDelete(id: string, index: number) {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除该收货地址吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await app.database().collection('addresses').doc(id).remove()
          addressList.value.splice(index, 1)
          uni.showToast({ title: '已删除', icon: 'success' })
        } catch (error) {
          console.error('删除地址失败:', error)
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    },
  })
}
</script>

<style scoped>
.address-list-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
}

/* ========== 空状态 ========== */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-bottom: 200rpx;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 30rpx;
  opacity: 0.6;
}

.empty-text {
  font-size: 32rpx;
  color: #999;
  margin-bottom: 12rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: #bbb;
}

/* ========== 列表滚动 ========== */
.list-scroll {
  flex: 1;
  padding-top: 16rpx;
}

/* ========== 地址卡片 ========== */
.address-card {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  margin: 0 24rpx 16rpx;
  background-color: #fff;
  border-radius: 16rpx;
}

.address-card.is-select-mode {
  cursor: pointer;
}

.select-indicator {
  margin-right: 20rpx;
  flex-shrink: 0;
}

.radio-dot {
  width: 40rpx;
  height: 40rpx;
  border: 3rpx solid #ddd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.radio-dot.active {
  border-color: #667eea;
}

.radio-inner {
  width: 22rpx;
  height: 22rpx;
  border-radius: 50%;
  background-color: #667eea;
}

.card-content {
  flex: 1;
  min-width: 0;
}

/* ========== 卡片头部 ========== */
.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.contact-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-right: 20rpx;
}

.contact-phone {
  font-size: 28rpx;
  color: #666;
}

.default-tag {
  margin-left: auto;
  padding: 4rpx 16rpx;
  background-color: #e8f0fe;
  border-radius: 6rpx;
  flex-shrink: 0;
}

.default-tag text {
  font-size: 22rpx;
  color: #667eea;
  font-weight: 500;
}

/* ========== 地址文本 ========== */
.address-text {
  font-size: 26rpx;
  color: #666;
  line-height: 1.5;
  word-break: break-all;
}

/* ========== 卡片操作 ========== */
.card-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16rpx;
  margin-left: 20rpx;
  flex-shrink: 0;
}

.action-link text {
  font-size: 24rpx;
  color: #667eea;
}

.action-edit text {
  color: #52c41a;
}

.action-delete text {
  color: #e7493b;
}

/* ========== 底部占位 ========== */
.bottom-placeholder {
  height: 120rpx;
}

/* ========== 底部新增栏 ========== */
.bottom-bar {
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background-color: #fff;
  border-top: 1rpx solid #eee;
}

.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 24rpx 0;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 30rpx;
  font-weight: 500;
  border-radius: 44rpx;
}

.add-icon {
  font-size: 40rpx;
  font-weight: 300;
}

/* ========== 加载遮罩 ========== */
.loading-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #999;
  z-index: 100;
}
</style>
