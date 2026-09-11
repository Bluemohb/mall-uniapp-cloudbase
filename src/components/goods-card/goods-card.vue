<!--
  ============================================================
  🧩 商品卡片（列表网格通用组件）
  ============================================================
  首页「热卖推荐」与商品列表页原本各自复制了一份卡片模板与样式，
  这里抽成公共组件，统一视觉与交互，避免改动时要同步两处。

  用法（easycom 自动按需引入，无需 import）：
    <goods-card
      v-for="p in list"
      :key="p._id"
      :product="p"
      @click="goDetail"
    />
  ============================================================
-->
<script setup lang="ts">
import { computed } from 'vue'
import { formatMoney } from '@/utils/money'

/** 卡片所需的最小商品字段集 */
interface GoodsCardData {
  _id: string
  name: string
  price: number
  originalPrice?: number
  image?: string
  sales?: number
}

const props = defineProps<{ product: GoodsCardData }>()

const emit = defineEmits<{ click: [id: string] }>()

/** 现价展示文本（元，保留两位） */
const priceText = computed(() => `¥${formatMoney(props.product.price)}`)

/** 原价展示文本；无折扣时为空串，模板据此隐藏 */
const originalPriceText = computed(() => {
  const { originalPrice, price } = props.product
  if (typeof originalPrice !== 'number' || originalPrice <= price)
    return ''
  return `¥${formatMoney(originalPrice)}`
})
</script>

<template>
  <view class="goods-card" @click="emit('click', product._id)">
    <image
      class="goods-card__image"
      :src="product.image || '/static/logo.png'"
      mode="aspectFill"
    />
    <view class="goods-card__info">
      <text class="goods-card__name">{{ product.name }}</text>
      <view class="goods-card__price-row">
        <text class="goods-card__price">{{ priceText }}</text>
        <text v-if="originalPriceText" class="goods-card__original">{{ originalPriceText }}</text>
      </view>
      <text v-if="product.sales" class="goods-card__sales">已售 {{ product.sales }}+</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.goods-card {
  width: 48%;
  background: $app-bg-card;
  border-radius: $app-radius-md;
  margin-bottom: 20rpx;
  overflow: hidden;
  box-shadow: $app-shadow-card;

  &:active {
    transform: scale(0.98);
    transition: transform 0.15s;
  }

  &__image {
    width: 100%;
    height: 340rpx;
    display: block;
    background-color: #f0f0f0;
  }

  &__info {
    padding: 16rpx 20rpx 20rpx;
  }

  &__name {
    font-size: 28rpx;
    font-weight: 500;
    color: $app-text-primary;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.4;
    margin-bottom: 12rpx;
    min-height: 78rpx;
  }

  &__price-row {
    display: flex;
    align-items: baseline;
    gap: 8rpx;
    margin-bottom: 8rpx;
  }

  &__price {
    font-size: 32rpx;
    font-weight: bold;
    color: $app-color-price;
  }

  &__original {
    font-size: 22rpx;
    color: $app-text-muted;
    text-decoration: line-through;
  }

  &__sales {
    font-size: 22rpx;
    color: $app-text-muted;
  }
}
</style>
