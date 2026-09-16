# 购物小程序（Uni-app + 腾讯云开发 CloudBase）

一个基于 **Uni-app（Vue 3 + TypeScript + Vite）** 与 **腾讯云开发 CloudBase** 的跨端电商小程序示例：商品浏览 → 搜索 → 收藏 → 加购 → 下单 → 支付 → 订单流转，全链路跑通，后端完全 Serverless（云数据库 + 云函数），无需自建服务器。

- 主战场：**微信小程序**（OpenID 静默登录 + 真实微信支付）与 **H5**（匿名登录 + 模拟支付）
- 同套代码可编译到支付宝 / 抖音小程序与 App（iOS/Android），见「多端运行与构建」
- 本项目基于 [CloudBase AI ToolKit](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit) 模板起步，模板原始说明与踩坑记录保留在 [`README-TEMPLATE.md`](./README-TEMPLATE.md)

## 功能一览

| 模块 | 能力 |
| --- | --- |
| 首页 | 轮播、分类宫格、推荐商品（带缓存）、骨架屏、图片懒加载 |
| 商品 | 列表分页 / 下拉刷新、详情（轮播 + 规格选择 + 数量加减）、商品卡片复用组件 |
| 搜索 | 独立搜索页：历史记录、热门词、结果分页 |
| 收藏 | 收藏 / 取消收藏、收藏列表页、云端 `favorites` 集合 + 本地镜像、启动合并 |
| 购物车 | 按用户隔离、选中/全选、改数量、批量删除、实时合计、云端 `carts` 集合 + 本地镜像 |
| 地址 | 收货地址 CRUD、省市区选择、默认地址（带 TTL 缓存） |
| 订单 | 云函数下单（服务端定价）、订单列表（状态筛选 + 搜索 + 批量取消）、订单详情、状态流转 |
| 支付 | 微信小程序真实微信支付（统一下单 + 支付回调）；其他端 / 个人主体走模拟支付并写支付流水 |
| 库存 | 下单扣库存累销量、取消回补、原子条件更新防超卖、定时关单回补 |
| 账号 | 微信 OpenID 静默登录、匿名登录、手机号 / 邮箱验证码、用户名密码登录、账号信息页与身份绑定 |

订单状态流转：

```
pending(待支付) ──支付──▶ paid(已支付) ──发货──▶ shipped(已发货) ──收货──▶ completed(已完成)
     │
     └────── 取消 / 超时自动关单 ──────▶ cancelled(已取消)
```

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Uni-app 3（Vue 3 Composition API）+ TypeScript + Vite 5 |
| UI | 原生 `rpx` 样式 + SCSS 变量，主题色收敛为 `src/theme.ts`（JS）与 `src/uni.scss`（样式）双 token 源 |
| 后端 | 腾讯云开发 CloudBase：云数据库、云函数、云存储、静态网站托管 |
| SDK | `@cloudbase/js-sdk`（HTTPS 网关）、`wx-server-sdk` / `@cloudbase/node-sdk`（云函数）、`@cloudbase/wx-cloud-client-sdk`（支付通道） |
| 质量 | ESLint（`pnpm run lint`）、`vue-tsc` 类型检查、Vitest 单测、GitHub Actions CI |
| 包管理 | **pnpm**（统一使用 pnpm，勿混用 npm） |

## 快速开始

### 1. 环境要求

- Node.js 20+（CI 使用 20）、pnpm 10+
- 微信开发者工具（小程序端）、CloudBase CLI（部署云函数，可选）

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置云开发环境

复制 `.env.example` 为 `.env`，填入环境 ID 与 Publishable Key（控制台 → 环境 → API 密钥 可获取）：

```bash
cp .env.example .env
```

```bash
# .env
VITE_ENV_ID=your-env-id
VITE_PUBLISHABLE_KEY=your-publishable-key
```

> `.env` 已在 `.gitignore` 中，不会被提交；`.env.development` / `.env.production` 只放数据源开关、不含密钥，随仓库提交。

同时把 `cloudbaserc.json` 的 `envId` 改成同一个环境（云函数部署用）。

### 4. 初始化商品数据

云端 `products` 集合需要先灌数据，否则商品列表为空：

```bash
tcb fn deploy seedProducts   # 或在控制台「云函数 → seedProducts → 云端测试」传 {} 触发
```

商品数据单一来源是 `mock/products_02.json`，云函数副本由同步脚本生成（云函数只能读自己目录内的文件）：

```bash
node scripts/sync-products.mjs            # 同步（内容一致则不写盘）
node scripts/sync-products.mjs -- --check # 仅校验一致性
```

### 5. 启动

```bash
pnpm run dev:mp-weixin   # 微信小程序：用开发者工具打开 dist/dev/mp-weixin
pnpm run dev:h5          # H5：默认 http://localhost:5173
```

## 多端运行与构建

| 目标 | 开发 | 构建 |
| --- | --- | --- |
| H5 | `pnpm run dev:h5` | `pnpm run build:h5` |
| 微信小程序 | `pnpm run dev:mp-weixin` | `pnpm run build:mp-weixin` |
| 支付宝小程序 | `pnpm run dev:mp-alipay` | `pnpm run build:mp-alipay` |
| 抖音小程序 | `pnpm run dev:mp-toutiao` | `pnpm run build:mp-toutiao` |
| App（iOS/Android） | HBuilderX 打开项目运行 | HBuilderX 云打包 |

小程序端产物目录：`dist/dev/mp-weixin`（dev）、`dist/build/mp-weixin`（build）。

> ⚠️ 改 `.env` / `mock/products_02.json` / `src/pages.json` / `src/manifest.json` / `vite.config.ts` 等**构建期输入**后必须**重新编译**（停止 dev 进程再跑），热更新救不了；仅改 `.vue` / `.ts` 内容可交给 HMR。详见 [`README-TEMPLATE.md`](./README-TEMPLATE.md)。

## 数据源开关与支付模式

项目有本地 Mock 与云数据库两套数据源，由构建期环境变量控制：

| 变量 | 作用域 | 说明 |
| --- | --- | --- |
| `VITE_USE_MOCK` | 商品列表 / 首页推荐 / 搜索 / 详情 | `true` 读本地 `mock/products_02.json` |
| `VITE_ORDER_MOCK` | 下单 / 订单列表 / 订单详情 | 独立于全局开关，可「商品走 Mock、订单走云端」 |
| `VITE_PAY_MODE` | 支付方式 | `mock` = 强制模拟支付；`auto` = 有凭证时调起真实微信支付 |

三个变量必须**显式声明**在 `.env.development` / `.env.production`（未声明会导致开关无法常量折叠、Mock 数据被打进线上包）。当前预设：

```bash
# .env.development
VITE_USE_MOCK=true
VITE_ORDER_MOCK=false   # 订单直连云端，便于用真实订单调试
VITE_PAY_MODE=mock

# .env.production
VITE_USE_MOCK=false
VITE_ORDER_MOCK=false
VITE_PAY_MODE=mock      # 个人主体小程序无法开通微信支付，默认模拟支付
```

启动时控制台会打印数据源横幅，一眼可辨当前走哪条路：

```
🧪 [Mock] 商品数据源：本地 mock/products_02.json（10 条）
☁️ [CloudBase] 订单数据源：云数据库 orders 集合
💳 [支付] 模式：模拟支付（VITE_PAY_MODE=mock）
```

## 项目结构

```
├── src/
│   ├── pages/                  # 页面（index / products / product-detail / search /
│   │                           #   cart / favorite / address / order / login / profile / account）
│   ├── components/             # goods-card、skeleton、show-captcha
│   ├── utils/                  # 业务层
│   │   ├── cloudbase.ts        # CloudBase 初始化、登录态、身份绑定
│   │   ├── cart.ts / favorite.ts / user-scoped-store.ts   # 用户隔离存储（共用工厂）
│   │   ├── order.ts / order-actions.ts / order-mock.ts    # 订单模型与统一操作入口
│   │   ├── payment.ts          # 支付通道封装（wx.cloud 与网关的分流）
│   │   └── money.ts / cache.ts / mock.ts / error.ts       # 金额(分)、TTL 缓存、Mock、统一错误
│   ├── types/                  # 类型定义
│   ├── static/                 # 图片资源（含 mock 商品图 *.webp）
│   ├── theme.ts / uni.scss     # 主题 token 双源
│   ├── pages.json              # 路由与 tabBar
│   └── manifest.json           # 多端配置（appId 等）
├── cloudfunctions/             # 云函数（需在 cloudbaserc.json 注册后部署）
├── mock/products_02.json       # 商品数据单一来源
├── scripts/                    # mock 图片抓取、商品数据同步等脚本
├── tests/                      # Vitest 单测（cart / favorite / money）
└── cloudbaserc.json            # CloudBase 环境、云函数与触发器配置
```

## 云函数

| 函数 | 触发方 | 职责 |
| --- | --- | --- |
| `seedProducts` | 手动 / 控制台 | 按 `_id` 覆盖写入商品种子数据（幂等，可重复执行） |
| `createOrder` | 客户端 | 服务端按权威价格重算金额、原子扣库存累销量、写入订单 |
| `updateOrderStatus` | 客户端 | 订单状态流转（取消 / 支付 / 发货 / 收货），条件更新做幂等，取消时回补库存 |
| `closeExpiredOrders` | 定时触发器（每 5 分钟） | 扫描超时未支付订单并关单回补，`PAYMENT_TIMEOUT_MINUTES` 默认 30 分钟 |
| `wxpayOrder` | 小程序 `wx.cloud` | 微信支付统一下单 + 主动查单，结果同步回订单 |
| `wxpayOrderCallback` | 微信支付服务端 | 支付结果通知 → 幂等置为已支付（需在控制台配置为接收通知的函数） |

部署：

```bash
tcb fn deploy createOrder      # 单个
tcb fn deploy                  # 全部已注册函数
```

> 支付必须走 `wx.cloud.callFunction`：微信支付 JSAPI 需要 `payer.openid`，而 HTTPS 网关通道只能拿到 CloudBase 的 `uid`，拿不到 openid。

## 数据库集合

| 集合 | 数据 | 客户端权限 |
| --- | --- | --- |
| `products` | 商品（库存、销量由云函数维护） | 只读 |
| `carts` | 一个用户一条文档 `{ userId, items }` | 按 `userId` 读写 |
| `favorites` | 一个用户一条文档 `{ userId, items }` | 按 `userId` 读写 |
| `addresses` | 一个用户多条地址文档 | 按 `userId` 读写 |
| `orders` | 订单（写入完全走云函数） | 只读 |

`carts` / `favorites` / `orders` 的安全规则（**`auth.uid != null` 守卫不能省**，否则缺 `userId` 的脏数据会在未登录态下被读出）：

```json
{
  "read": "auth.uid != null && doc.userId == auth.uid",
  "create": "auth.uid != null && request.data.userId == auth.uid",
  "write": "auth.uid != null && doc.userId == auth.uid"
}
```

`orders` 的 `write` 直接设为 `false`，写入只由 `createOrder` / `updateOrderStatus` 完成。

> 跨端看不到同一份购物车是**登录身份**问题：小程序是 OpenID 登录（uid 稳定），H5/App 是匿名登录（清缓存即换 uid）。要让数据互通需做身份收敛（引导 H5 用户绑定手机号 / 公众号授权），改权限档位无效。

## 工程化

```bash
pnpm run lint          # ESLint 自动修复
pnpm run lint:check    # 仅检查
pnpm run type-check    # vue-tsc --noEmit
pnpm run test          # Vitest 单测
pnpm run check         # lint + type-check + test，提交前跑一遍
pnpm run mock:images   # 抓取/更新本地商品图
pnpm run mock:purge    # 清空本地 Mock 数据
```

CI（`.github/workflows/ci.yml`）在 push / PR 到 `main` 时执行 lint + type-check + test（Node 20 + pnpm 10）。

## 部署

| 目标 | 步骤 |
| --- | --- |
| 云函数 | `tcb functions:deploy` 或 `tcb framework deploy` |
| H5 | `pnpm run build:h5` → 上传 `dist/build/h5` 到静态网站托管 |
| 微信小程序 | `pnpm run build:mp-weixin` → 开发者工具打开 `dist/build/mp-weixin` → 上传发布 |

H5 / 匿名端调用云函数前，需在控制台「云函数 → 安全规则」放行 `createOrder` / `updateOrderStatus` / `wxpayOrder`（否则匿名身份会被 `EXCEED_AUTHORITY` 拦下）。定时任务与支付回调函数**不要**加入白名单。

## 注意事项

- **改完要重新编译**：`.env`、`mock/products_02.json`、`pages.json`、`manifest.json`、静态资源、新增模块等都属于构建期输入，改完必须重启 dev；新增 `src/utils/**` 模块遇到 `module '...' is not defined` 时，需要删 `dist/dev` 并**完全退出开发者工具再重开**（IDE 缓存了文件快照）。
- **`.env` 含真实环境 ID 与 Publishable Key**：已被 `.gitignore` 忽略，首次克隆请复制 `.env.example` 为 `.env` 后填写。
- **定时任务必须部署**：`closeExpiredOrders` 不部署的话，未支付订单会一直占用库存。
- 微信支付需要企业主体 + 商户凭证；个人主体请保持 `VITE_PAY_MODE=mock`。

## 开发历程

| 阶段 | 内容 |
| --- | --- |
| Step 1-2 | 项目初始化、商品列表页与商品详情页 |
| Step 3-4 | 购物车（本地存储）、收货地址管理（云数据库 CRUD） |
| Step 5 | 订单创建与列表、云函数下单 |
| Step 6 | 个人中心与首页整合、商品数据源切换与 Mock 数据 |
| Step 7 | 搜索页、账号信息独立成页与身份绑定入口 |
| 增强 | 微信 OpenID 登录与兜底、云端购物车 / 收藏、库存扣减与超时关单、真实微信支付 + 支付模式开关、主题与组件重构、图片本地化与骨架屏、Vitest 与 CI |

## 许可证

MIT License
