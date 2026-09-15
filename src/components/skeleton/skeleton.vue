<!--
  ============================================================
  🧩 骨架屏（数据到达前的占位轮廓）
  ============================================================
  列表数据返回前，用灰色块勾勒出页面结构，避免整页白屏。
  相比"底部转圈"，骨架屏能让用户提前看到页面布局，减少等待感
  （感知性能往往比实际性能更影响体验）。

  用法（本项目 easycom 未生效，需在页面显式 import，同 goods-card）：
    <skeleton v-if="showSkeleton" type="goods-grid" :count="6" />

  布局类型：
    goods-grid —— 两列商品网格（商品列表 / 搜索结果 / 收藏）
    list-row   —— 左图右文的列表行（订单列表等）

  【注意】骨架屏自带容器布局，不依赖父级 .product-grid：
  商品列表页是 grid 布局、搜索页是 flex 布局，若让骨架沿用父级
  容器，两侧的列宽与间距会对不齐。
  ============================================================
-->
<script setup lang="ts">
withDefaults(defineProps<{
  /** 布局类型：两列网格 / 左图右文列表行 */
  type?: 'goods-grid' | 'list-row'
  /** 占位个数 */
  count?: number
}>(), {
  type: 'list-row',
  count: 4,
})
</script>

<template>
  <view class="skeleton">
    <!-- 两列商品网格：上方方形图，下方两行文字 -->
    <view v-if="type === 'goods-grid'" class="skeleton-grid">
      <view v-for="i in count" :key="`g-${i}`" class="skeleton-card">
        <view class="skeleton-card__img sk-block" />
        <view class="skeleton-card__title sk-block" />
        <view class="skeleton-card__price sk-block" />
      </view>
    </view>

    <!-- 列表行：左侧方形图，右侧三行文字 -->
    <view v-else class="skeleton-rows">
      <view v-for="i in count" :key="`r-${i}`" class="skeleton-row">
        <view class="skeleton-row__img sk-block" />
        <view class="skeleton-row__body">
          <view class="skeleton-row__line sk-block" />
          <view class="skeleton-row__line skeleton-row__line--short sk-block" />
          <view class="skeleton-row__line skeleton-row__line--mini sk-block" />
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
/* 骨架块底色：比白底略深、比分割线略浅，避免和真实内容抢视觉 */
$skeleton-bg: #eceef2;

/* 呼吸式闪烁：只动 opacity，开销最小且在小程序端表现稳定
   （不改 background-position，小程序对背景位移动画支持不一致） */
@keyframes sk-breathe {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

.sk-block {
  background: $skeleton-bg;
  border-radius: 8rpx;
  animation: sk-breathe 1.4s ease-in-out infinite;
}

/* ---- 两列商品网格 ---- */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 4%;
  row-gap: 20rpx;
  padding: 20rpx;
}

.skeleton-card {
  background-color: $app-bg-card;
  border-radius: $app-radius-md;
  overflow: hidden;

  /* 与真实卡片图片同为正方形（750rpx 屏宽下两列各约 340rpx） */
  &__img {
    width: 100%;
    height: 340rpx;
    border-radius: 0;
  }

  &__title {
    height: 32rpx;
    margin: 20rpx 16rpx 12rpx;
  }

  &__price {
    width: 50%;
    height: 36rpx;
    margin: 0 16rpx 20rpx;
  }
}

/* ---- 左图右文列表行 ---- */
.skeleton-rows {
  padding: 0 24rpx;
}

.skeleton-row {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $app-border-color;

  &:last-child {
    border-bottom: none;
  }

  &__img {
    flex-shrink: 0;
    width: 160rpx;
    height: 160rpx;
    margin-right: 24rpx;
  }

  &__body {
    flex: 1;
  }

  &__line {
    height: 28rpx;
    margin-bottom: 16rpx;

    &--short {
      width: 60%;
    }

    &--mini {
      width: 40%;
      margin-bottom: 0;
    }
  }
}
</style>
