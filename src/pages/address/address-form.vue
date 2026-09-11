<!--
  ============================================================
  ✏️ 收货地址表单页 - 购物小程序第4步
  ============================================================
  支持新增与编辑两种模式：
  - 有 id 参数 → 编辑已有地址（预填数据）
  - 无 id 参数 → 新增地址

  【知识点】
  - CloudBase 数据库 增/改（add / update）
  - picker mode="region" 省市区选择器
  - 表单校验 + 保存前确认
  ============================================================
-->
<template>
  <view class="address-form-page">
    <!-- 表单区域 -->
    <view class="form-card">
      <!-- 收货人 -->
      <view class="form-item">
        <text class="form-label">收货人</text>
        <input
          v-model="form.name"
          class="form-input"
          placeholder="请输入收货人姓名"
          :maxlength="20"
        />
      </view>

      <!-- 手机号码 -->
      <view class="form-item">
        <text class="form-label">手机号码</text>
        <input
          v-model="form.phone"
          class="form-input"
          type="number"
          placeholder="请输入手机号码"
          :maxlength="11"
        />
      </view>

      <!-- 所在地区 -->
      <view class="form-item">
        <text class="form-label">所在地区</text>
        <picker
          mode="region"
          :value="regionValue"
          class="region-picker"
          @change="onRegionChange"
        >
          <view class="picker-display" :class="{ placeholder: !regionLabel }">
            {{ regionLabel || '请选择省市区' }}
          </view>
          <view class="picker-arrow">›</view>
        </picker>
      </view>

      <!-- 详细地址 -->
      <view class="form-item">
        <text class="form-label">详细地址</text>
        <input
          v-model="form.detail"
          class="form-input"
          placeholder="街道、门牌号、楼层等"
          :maxlength="100"
        />
      </view>

      <!-- 设为默认地址 -->
      <view class="form-item form-item-switch">
        <text class="form-label">设为默认地址</text>
        <switch
          :checked="form.isDefault"
          color="#667eea"
          @change="onSwitchChange"
        />
      </view>
    </view>

    <!-- 保存按钮 -->
    <view class="save-bar">
      <view class="save-btn" @click="onSave">
        {{ isEdit ? '保存修改' : '新增地址' }}
      </view>
      <view v-if="isEdit" class="cancel-btn" @click="goBack">
        取消
      </view>
    </view>

    <!-- 加载提示 -->
    <uni-load-more v-if="saving" status="loading" contentText="保存中..." />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { app, getUid } from '@/utils/cloudbase'
import { CACHE_KEYS, removeCache } from '@/utils/cache'

// ============================================================
// 类型定义
// ============================================================

interface AddressForm {
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault: boolean
}

/** 地址文档（数据库读回的结构） */
interface AddressDoc {
  _id: string
  name?: string
  phone?: string
  province?: string
  city?: string
  district?: string
  detail?: string
  isDefault?: boolean
}

/** 本页路由参数 */
interface AddressFormQuery {
  id?: string
}

/** picker 变更事件（只声明用到的字段） */
interface ValueChangeEvent<T> {
  detail: { value: T }
}

/** switch 的 @change 回调被 uni 声明为 (payload: Event)，这里从事件对象安全取 detail */
interface DetailEvent extends Event {
  detail: { value: boolean }
}

// ============================================================
// 响应式数据
// ============================================================

const editId = ref('')
const isEdit = ref(false)
const saving = ref(false)

const form = reactive<AddressForm>({
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  isDefault: false,
})

const regionValue = ref<string[]>([])
const regionLabel = ref('')

// ============================================================
// 初始化（读取 id 参数决定新增/编辑模式）
// ============================================================

onLoad((query?: AddressFormQuery) => {
  if (query?.id) {
    isEdit.value = true
    editId.value = query.id
    loadAddress(query.id)
  }
})

// ============================================================
// 加载已有地址（编辑模式）
// ============================================================

async function loadAddress(id: string) {
  try {
    const { data } = await app.database().collection('addresses').doc(id).get()

    if (data && data.length > 0) {
      const addr = data[0] as AddressDoc
      form.name = addr.name || ''
      form.phone = addr.phone || ''
      form.province = addr.province || ''
      form.city = addr.city || ''
      form.district = addr.district || ''
      form.detail = addr.detail || ''
      form.isDefault = addr.isDefault || false

      regionValue.value = [form.province, form.city, form.district]
      regionLabel.value = `${form.province}${form.city}${form.district}`
    }
  } catch (error) {
    console.error('加载地址失败:', error)
    uni.showToast({ title: '加载地址失败', icon: 'none' })
  }
}

// ============================================================
// 事件处理
// ============================================================

function onRegionChange(e: ValueChangeEvent<string[]>) {
  const val = e.detail.value
  regionValue.value = val
  form.province = val[0] || ''
  form.city = val[1] || ''
  form.district = val[2] || ''
  regionLabel.value = val.join('')
}

function onSwitchChange(e: Event) {
  // switch 组件把开关值放在事件对象的 detail.value 上
  form.isDefault = (e as DetailEvent).detail.value
}

function goBack() {
  uni.navigateBack()
}

// ============================================================
// 表单校验
// ============================================================

function validate(): string | null {
  if (!form.name.trim()) {
    return '请输入收货人姓名'
  }
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    return '请输入正确的手机号码'
  }
  if (!form.province || !form.city || !form.district) {
    return '请选择所在地区'
  }
  if (!form.detail.trim()) {
    return '请输入详细地址'
  }
  return null
}

// ============================================================
// 保存
// ============================================================

async function onSave() {
  const error = validate()
  if (error) {
    uni.showToast({ title: error, icon: 'none' })
    return
  }

  saving.value = true
  try {
    // 统一登录入口（内部按需登录 + 并发去重）
    let uid = ''
    try {
      uid = await getUid()
    }
    catch {
      uni.showToast({ title: '登录状态异常，请稍后重试', icon: 'none' })
      return
    }

    const addressData = {
      userId: uid,
      name: form.name.trim(),
      phone: form.phone.trim(),
      province: form.province,
      city: form.city,
      district: form.district,
      detail: form.detail.trim(),
      isDefault: form.isDefault,
      updatedAt: Date.now(),
    }

    if (isEdit.value) {
      // 编辑模式：更新已有地址
      await app
        .database()
        .collection('addresses')
        .doc(editId.value)
        .update(addressData)

      // 如果设为默认，清除其他默认地址
      if (form.isDefault) {
        await clearOtherDefaults(uid, editId.value)
      }

      uni.showToast({ title: '地址已更新', icon: 'success' })
    } else {
      // 新增模式：创建新地址
      const addData = { ...addressData, createdAt: Date.now() }

      if (form.isDefault) {
        // 先清除当前用户所有默认地址
        await clearOtherDefaults(uid)
      }

      await app.database().collection('addresses').add(addData)
      uni.showToast({ title: '地址已添加', icon: 'success' })
    }

    // 地址已变更（尤其可能是默认地址），失效订单页的默认地址缓存
    removeCache(CACHE_KEYS.defaultAddress)

    // 延迟返回，让用户看到成功提示
    setTimeout(() => {
      uni.navigateBack()
    }, 800)
  } catch (err) {
    console.error('保存地址失败:', err)
    uni.showToast({ title: '保存失败，请重试', icon: 'none' })
  } finally {
    saving.value = false
  }
}

async function clearOtherDefaults(userId: string, excludeId?: string) {
  try {
    const query = app
      .database()
      .collection('addresses')
      .where({ userId, isDefault: true })

    const { data: defaults } = await query.get()  // 从数据库查询结果中解构取出 data 字段，并重命名为 defaults
    const items = (defaults || []) as AddressDoc[]

    const updates = items // 数组里的每个元素都是 Promise对象
      .filter(item => item._id !== excludeId)
      .map(item =>
        app.database().collection('addresses').doc(item._id).update({
          isDefault: false,
          updatedAt: Date.now(),
        })
      )

    if (updates.length > 0) {
      await Promise.all(updates)
    }
  } catch (err) {
    console.warn('清除其他默认地址失败:', err)
  }
}
</script>

<style scoped>
.address-form-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 20rpx 0;
}

/* ========== 表单卡片 ========== */
.form-card {
  margin: 16rpx 24rpx;
  background-color: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.form-item {
  display: flex;
  align-items: center;
  padding: 24rpx 28rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.form-item:last-child {
  border-bottom: none;
}

.form-label {
  width: 150rpx;
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  flex-shrink: 0;
}

.form-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  text-align: right;
}

.form-input::placeholder {
  color: #ccc;
}

/* ========== 地区选择器 ========== */
.region-picker {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
}

.picker-display {
  font-size: 28rpx;
  color: #333;
  text-align: right;
}

.picker-display.placeholder {
  color: #ccc;
}

.picker-arrow {
  font-size: 36rpx;
  color: #bbb;
  transform: rotate(90deg);
}

/* ========== Switch 行 ========== */
.form-item-switch {
  justify-content: space-between;
}

/* ========== 保存按钮 ========== */
.save-bar {
  padding: 40rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.save-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 30rpx;
  font-weight: 500;
  border-radius: 44rpx;
}

.cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0;
  background-color: #fff;
  color: #999;
  font-size: 28rpx;
  border-radius: 44rpx;
  border: 2rpx solid #eee;
}
</style>
