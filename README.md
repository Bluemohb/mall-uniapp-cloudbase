# CloudBase UniApp 模板

基于 UniApp 和腾讯云开发（CloudBase）的跨平台应用模板，目前已适配 **H5** 、 **微信小程序** 、 **支付宝小程序** 、 **抖音小程序** 以及 **App (iOS/Android)**，其他端的适配正在开发中。为开发者提供了快速构建全栈跨平台应用的能力。

[![Powered by CloudBase](https://7463-tcb-advanced-a656fc-1257967285.tcb.qcloud.la/mcp/powered-by-cloudbase-badge.svg)](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit)

> 本项目基于 [**CloudBase AI ToolKit**](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit) 开发，通过AI提示词和 MCP 协议+云开发，让开发更智能、更高效，支持AI生成全栈代码、一键部署至腾讯云开发（免服务器）、智能日志修复。

## 项目特点

- 🚀 基于 UniApp 构建，一套代码多端运行
- ⚡ 使用 Vue 3 Composition API 构建现代化 UI
- 🌐 目前支持 **H5** 、 **微信小程序** 、 **支付宝小程序** 、 **抖音小程序** 以及 **App (iOS/Android)** ，其他平台适配开发中
- 🎁 深度集成腾讯云开发 CloudBase，提供一站式后端云服务
- 🔧 自定义 UniApp 适配器，完美适配云开发能力
- 📱 完整的 TypeScript 支持，提供更好的开发体验

## 各平台展示效果

各平台展示如下：

 
 H5 端 | 微信小程序 |
|:---:|:---:|
| ![H5 端](https://qcloudimg.tencent-cloud.cn/raw/cec528e3e0d4dddadff11c66a11013cc.png) | ![微信小程序](https://qcloudimg.tencent-cloud.cn/raw/826666e480af55c2c886ffa1a451dea8.png) |

 支付宝小程序 | 抖音小程序 |
|:---:|:---:|
| ![支付宝小程序](https://qcloudimg.tencent-cloud.cn/raw/5fa5a46ae73b325bb1199b7e4059e480.png) | ![抖音小程序](https://qcloudimg.tencent-cloud.cn/raw/c4750c695aa81dab6cd3ef2de0aee8f0.png) |

 Android 和 iOS |
|:---:|
| <img src="https://qcloudimg.tencent-cloud.cn/raw/34cb2e31c0a667caf8396a2b12c87c94.jpg" width="50%"/> |



## 项目架构

### 前端架构

- **框架**：UniApp (基于 Vue 3)
- **构建工具**：Vite
- **多端支持**：H5、微信小程序、支付宝小程序、抖音小程序、App (iOS/Android)（其他平台适配开发中）
- **状态管理**：Vue 3 Reactivity API
- **类型支持**：TypeScript

### 云开发资源

本项目使用了以下腾讯云开发（CloudBase）资源：

- **身份认证**：用于用户登录和身份验证（匿名登录、手机验证码登录、邮箱验证码登录、手机号/用户名/邮箱密码登录、微信小程序 openId 静默登录）
- **云数据库**：用于存储应用数据
- **云函数**：用于实现业务逻辑
- **云托管**：用于实现业务逻辑
- **云存储**：用于存储文件
- **静态网站托管**：用于部署 H5 版本

## 目录结构

```
├── src/
│   ├── components/
│   │   ├── show-captcha.vue       # 登录验证弹窗组件
│   ├── pages/                     # 页面文件
│   │   ├── index/                 # 首页
│   │   │   ├── index.vue
│   │   │   └── index.json
│   │   ├── demo/                  # 云开发演示页面
│   │   │   ├── demo.vue
│   │   │   └── demo.json
│   │   ├── login/
│   │   │   ├── index.vue          # 登录主页面
│   │   │   ├── phone-login.vue    # 手机验证码登录页面
│   │   │   ├── email-login.vue    # 邮箱验证码登录页面
│   │   │   └── password-login.vue # 密码登录页面
│   │   └── profile/               # 用户信息页面
│   │       └── profile.vue        # 用户信息查看页面              
│   ├── utils/                     # 工具函数和云开发初始化
│   │   ├── cloudbase.ts           # 云开发配置
│   │   └── index.ts               # 通用工具函数
│   ├── static/                    # 静态资源
│   ├── App.vue                    # 应用入口组件
│   ├── main.ts                    # 应用入口文件
│   ├── pages.json                 # 页面路由配置
│   └── manifest.json              # 应用配置文件
├── cloudfunctions/                # 云函数目录
│   └── hello/                     # 示例云函数
│       ├── index.js
│       └── package.json
├── index.html                     # H5 模板
├── vite.config.ts                 # Vite 配置
├── tsconfig.json                  # TypeScript 配置
├── package.json                   # 项目依赖
├── cloudbaserc.json               # CloudBase CLI 配置
└── README.md                      # 项目说明
```

## 开始使用

### VS Code 预览功能

本项目已配置 VS Code 预览功能，支持自动打开浏览器预览：

1. 在 VS Code 中打开项目
2. 项目会自动加载 `.vscode/preview.yml` 配置
3. 启动开发服务器后会自动打开浏览器预览页面
4. 默认端口：5173

配置文件位置：`.vscode/preview.yml`

<details>
<summary>前提条件</summary>

- 安装 Node.js (版本 16 或更高)
- 安装 HBuilderX 或其他支持 UniApp 的开发工具
- 腾讯云开发账号 (可在[腾讯云开发官网](https://tcb.cloud.tencent.com/)注册)

</details>

<details>
<summary>安装依赖</summary>

```bash
npm install
```

</details>

<details>
<summary>配置云开发环境</summary>

1. 打开 `src/utils/cloudbase.ts` 文件
2. 将 `ENV_ID` 变量的值修改为您的云开发环境 ID

```typescript
const ENV_ID = 'your-env-id'; // 替换为您的云开发环境ID
```

</details>

<details>
<summary>云开发环境配置</summary>

#### 1. 开启登录认证方式

在云开发控制台的【扩展能力】->【身份认证】->【登录方式】中开启
- 匿名登录
- 用户名密码登录
- 短信验证码登录
- 邮箱登录
- 微信小程序 openId 登录（需要先在【环境配置】->【小程序认证】中完成小程序认证）

#### 2. 配置安全域名（H5 端）

在云开发控制台的【环境配置】->【安全来源】->【安全域名】中添加：
- 开发域名：`http://localhost:5173`（本地开发）
- 生产域名：您的实际部署域名

#### 3. 配置安全域名（抖音小程序、支付宝小程序）
在云开发控制台的【环境配置】->【安全来源】->【安全域名】中添加域名：

- 抖音小程序开发域名：`tmaservice.developer.toutiao.com`
- 支付宝开发域名：`devappid.hybrid.alipay-eco.com`

#### 4. 配置微信小程序域名

配置入口（二选一，效果相同）：
- 微信小程序管理后台【开发】->【开发管理】->【开发设置】->【服务器域名】
- CloudBase 控制台【小程序认证】-> 详情 -> 服务器域名区域（会同步到微信平台，推荐）

**request 合法域名：**
```
https://tcb-api.tencentcloudapi.com
https://your-env-id.service.tcloudbase.com
https://your-env-id.api.tcloudbasegateway.com
```

> `https://{env}.api.tcloudbasegateway.com` 是 CloudBase 标准 HTTPS 网关域名。
> `@cloudbase/js-sdk` 在 `useWxCloud: false` 时（微信 OpenID 登录、匿名登录、数据库等）直连该网关，
> 必须加入 request 合法域名，否则真机预览 / 线上会报"不在以下 request 合法域名列表中"。

**uploadFile 合法域名：**
```
https://cos.ap-shanghai.myqcloud.com
```

**downloadFile 合法域名：**
```
https://your-env-id.tcb.qcloud.la
https://cos.ap-shanghai.myqcloud.com
```


> 注意：请将 `your-env-id` 替换为您的实际环境 ID，地域根据您的云开发环境所在地域调整。

#### 5. **（仅 App 端需要）**配置安全应用来源
在云开发控制台的【环境配置】->【安全来源】->【移动应用安全来源】中添加应用：
- 应用标识：`your-appSign`
- 应用凭证：`your-appAccessKey`
在 `src/utils/cloudbase.ts` 文件中，找到 `appConfig` 对象，填入您获取到的凭证信息。

```typescript
const appConfig = {
    env: config.env || ENV_ID,
    timeout: config.timeout || 15000,
    appSign: 'your-appSign', // 应用标识
    appSecret: {
        appAccessKeyId: 1, // 凭证版本
        appAccessKey: 'your-appAccessKey' // 凭证
    }
```

</details>

<details>
<summary>本地开发</summary>

```bash
# H5 开发
npm run dev:h5

# 微信小程序开发
npm run dev:mp-weixin

# 抖音小程序开发
npm run dev:mp-toutiao

# 支付宝小程序开发
npm run dev:mp-alipay

# App (iOS/Android) 开发
# 1. 使用 HBuilderX 打开项目
# 2. 在顶部菜单栏选择【运行】->【运行到手机或模拟器】-> 选择您的设备

# 注意：目前仅支持 APP、H5、微信小程序、抖音小程序和支付宝小程序开发，其他平台适配开发中
```

</details>

<details>
<summary>构建生产版本</summary>

```bash
# 构建 H5 版本
npm run build:h5

# 构建微信小程序
npm run build:mp-weixin

# 构建抖音小程序
npm run build:mp-toutiao

# 构建支付宝小程序
npm run build:mp-alipay

# 注意：目前仅支持 H5 、微信小程序、抖音小程序和支付宝小程序构建，其他平台适配开发中
```

</details>

## 云开发使用示例

通过 `src/utils/cloudbase.ts` 访问云开发服务：

```typescript
import { app, checkLogin } from './utils/cloudbase'

// 数据库操作
await checkLogin();
const db = app.database();
const result = await db.collection('users').get(); // 查询数据
await db.collection('users').add({ name: 'test' }); // 添加数据

// 调用云函数
const funcResult = await app.callFunction({ name: 'hello' });

// 调用云托管
app.callContainer({
    name: 'helloworld',
    method: 'POST',
    path: '/abc',
    header:{
      'Content-Type': 'application/json; charset=utf-8'
    },
    data: {
      key1: 'test value 1',
      key2: 'test value 2'
    },
  }).then((res) => {
    console.log(res)
  });

// 文件上传
const uploadResult = await app.uploadFile({ cloudPath: 'test.jpg', filePath: file });

// 文件下载
cloudbase.downloadFile({
    fileID: "cloud://aa-99j9f/my-photo.png"
  }).then((res) => {});

```

## Mock 数据开关（开发调试）

项目有两套数据源：本地 Mock（`mock/products_02.json` + 本地 storage）与 CloudBase 云数据库。
由 `.env` 里的两个开关决定，**默认语义**是「开发环境读 Mock、生产构建走云端」：

| 变量 | 作用域 | 取值 | 不配置时 |
| --- | --- | --- | --- |
| `VITE_USE_MOCK` | 全局：商品列表 / 首页推荐 / 搜索 / 商品详情 | `'true'` / `'false'` | 非生产构建启用（dev 开 / build 关） |
| `VITE_ORDER_MOCK` | 订单：下单 / 订单列表 / 订单详情 | `'true'` / `'false'` | 继承 `VITE_USE_MOCK` |

订单开关独立于全局开关，因此可以组合出「商品走 Mock、订单走云端」，
直接用控制台 `orders` 集合里的真实数据调试「下单 → 列表 → 详情」链路。

### 为什么订单需要独立开关

原先两者都由 `process.env.NODE_ENV` 决定，开发环境只能**整体**走 Mock：
订单页永远读本地 storage 的 `mock_orders`，**根本不会查云端 `orders` 集合**
（`if (USE_MOCK) { ... return }` 提前返回了）。
于是会出现「控制台里明明有订单、页面却是空的」——那是两份完全独立的数据，
既不是权限问题，也不是安全规则问题。

### 常用配置

```bash
# 让订单在开发环境直连云端（商品仍走本地 Mock）—— 最常用
VITE_ORDER_MOCK=false

# 让开发环境整体走云端（调试真实商品数据）
VITE_USE_MOCK=false
```

> ⚠️ `.env` 对 dev 与 build **同时生效**，所以不要在里面写 `VITE_USE_MOCK=true`
> ——那会让生产构建也读 Mock。若确实需要「dev 读 Mock、build 走云端」的固定组合，
> 请用 `.env.development` 与 `.env.production` 分开配置。
>
> 改完 `.env` 必须**重新编译**：dev 构建不会热更新环境变量。

### 怎么确认当前走的是哪条路

启动时控制台会打印数据源，一眼可辨：

```
🧪 [Mock] 商品数据源：本地 mock/products_02.json（10 条）
☁️ [CloudBase] 订单数据源：云数据库 orders 集合
💳 [支付] 模式：模拟支付（VITE_PAY_MODE=mock）—— 不会调起微信收银台
```

两个开关在构建期都会被静态替换成字面量并常量折叠，`if (USE_MOCK)` 在编译期就有确定结果。
这也意味着**两个变量必须在 `.env.development` / `.env.production` 里显式声明**：
未声明的 `VITE_` 变量拿不到值，开关会退化成运行时读取，连常量折叠都会失效。

> Mock 数据本身能否从产物里移除，取决于 rollup 的 chunk 划分：被多个页面共享时
> 会拆出独立的 `mock-*.js` 公共 chunk，其中的 JSON 仍在包里（**不影响运行**——
> 开关为 false 时永远不会被读取）。这是拆分开关之前就已有的行为。

顺带一提：这也是排查「本地有数据但页面为空」类问题的第一手线索——
先看数据源日志，再怀疑权限。

### 开关跟着产物走，不跟着源码走

开关值来自构建时加载的 `.env` 文件，所以**最终走哪套数据源，取决于微信开发者工具打开的是哪个产物目录**：

| 产物目录 | 构建命令 | 加载的配置 | `VITE_USE_MOCK` | 实际数据源 |
| --- | --- | --- | --- | --- |
| `dist/dev/mp-weixin` | `pnpm dev:mp-weixin` | `.env.development` | `true` | 本地 Mock |
| `dist/build/mp-weixin` | `pnpm build:mp-weixin` | `.env.production` | `false` | 云数据库 |

`.env.development` 里的 `VITE_USE_MOCK=true` 只对 **dev 产物**生效。只要开发者工具打开的是
`dist/build/mp-weixin`，商品列表 / 详情 / 首页推荐 / 搜索就全部走云端，与 Mock 开关的取值无关。
改完 `.env` 必须**重新构建**，产物里的开关值才会跟着变。

## 支付模式开关（个人主体小程序必读）

个人主体小程序**开不了微信支付**（需要企业主体 + 300 元认证），商户凭证永远配不上。
但客户端能探测到的只有「API 在不在」—— `wx.requestPayment` 与 `wx.cloud` 在任何
小程序里都存在（跟有没有商户号无关），所以这些条件在个人号里全是 `true`：

```ts
// src/utils/payment.ts 里 canUseWechatPay() 的四个条件
isMpWeixin() && isValidEnvId && wx.cloud && wx.requestPayment
```

于是 `VITE_ORDER_MOCK=false`（订单走云端）时按钮会显示「**立即支付**」，点下去必然
失败在「商户凭证未配置」（错误文案由 `wxpayOrder` 云函数翻译）。所以「我没有商户号」
这件事必须在代码里显式声明 —— 这就是 `VITE_PAY_MODE`：

| 取值 | `canUseWechatPay()` | 页面行为 | 适用 |
| --- | --- | --- | --- |
| `'mock'` | 恒为 false | 一律走模拟支付 | 个人主体小程序、无商户凭证 |
| 缺省 / `'auto'` | 按环境判断 | 环境具备就调起真实微信支付 | 已有商户号并配好凭证 |

```bash
# .env.development 与 .env.production 都要写（改完必须重新构建）
VITE_ORDER_MOCK=false   # 订单走云端（推荐：订单链路是真实的，只有支付是模拟的）
VITE_PAY_MODE=mock      # 支付走模拟（个人号没有商户号）
```

> 将来办好企业号、配好商户凭证，把这两处改成 `auto` 即可，**业务代码一行都不用动**。

### 三个开关的组合

| `VITE_ORDER_MOCK` | `VITE_PAY_MODE` | 订单存储 | 支付方式 | 说明 |
| --- | --- | --- | --- | --- |
| `true` | `mock` | 本地 storage | 模拟 | 纯离线演示，不依赖云端 |
| `false` | `mock` | 云端 `orders` 集合 | 模拟 | **本项目默认**：订单链路真实，只有支付是模拟的 |
| `false` | 缺省 | 云端 `orders` 集合 | 真实微信支付 | 需企业主体 + 商户凭证 |

> ⚠️ 「订单走云端 + 真实微信支付」这一格在个人号里是**无解**的（点了必然失败），
> 所以 `.env.development` / `.env.production` 都预设了 `VITE_PAY_MODE=mock`。

### 模拟支付也会写一条支付流水

模拟支付不是「只把状态改成已支付」：它会像真实支付一样写入 `order.payment`
（`channel: 'mock'`，含 `outTradeNo` / `transactionId` / `paidCents` / `confirmedAt`），
结构与云函数 `wxpayOrder` 的 `markOrderPaid` **刻意保持同构**（只有 `channel` 与
`confirmedBy` 不同）。好处是订单详情页用同一段模板就能展示「微信支付」与「模拟支付」
两种订单，将来换成真实支付，页面不用改。

| 订单存储 | 谁写入 `payment` |
| --- | --- |
| 云端 `orders` | 云函数 `updateOrderStatus`（⚠️ 改过它需要**重新部署该云函数**才生效） |
| 本地 storage | `src/utils/order-actions.ts` 构造后经 `order-mock` 落本地 |

### 支付与订单操作统一入口

`src/utils/order-actions.ts` 是「支付 / 取消 / 发货 / 收货 / 批量取消」的唯一入口，订单详情页与
订单列表页都调它，页面只负责「触发 + 回读订单」。原先这 4 个操作在两个页面里各写了
一遍（每个还要再分 Mock / 云端两条路），同一分支最多存在 4 份拷贝，行为已经出现漂移
（例如列表页支付成功后不写 `paidAt`），现在收敛在一处。

### 订单列表的搜索与批量取消

状态筛选之外，订单列表页还有两个「批量处理」维度的能力。

#### 搜索：为什么是客户端过滤

> **没有「订单名称」这个东西**：订单文档里没有名称字段
> （`Order` 只有 `orderNo` / `items` / `address`）。平时说的"按订单名称搜"，
> 实际搜的是**订单里的商品名**。所以卡片上会把商品名显示出来 ——
> 不显示的话，用户无从知道能拿什么搜，只会去搜订单号。

命中三个维度，一律归一化（去首尾空格 + 压缩连续空格）后做小写**包含**匹配：

| 维度 | 取自 |
| --- | --- |
| 商品名 | `order.items[].name`（下单那一刻的商品**快照**） |
| 订单号 | `order.orderNo`（数字串，只记得后几位也能搜到） |
| 收货人 | `order.address.name` |

> ⚠️ 搜索**不是**云端查询，而是「先取最近 100 笔 → 再本地过滤」，
> 列表底部会如实标注「仅在最近 100 笔订单中匹配」。
>
> 原因是商品名躺在 `items` 嵌套数组里：云数据库既没有可用的模糊匹配条件，
> 也查不了数组内元素的字段，硬写 `where` 只会查不到或查错。
>
> 取这 100 笔要**分 5 趟拉**（每趟 `limit(20)`）：小程序端单次 `get()` 的
> limit 上限是 20，直接 `limit(100)` 并不合法，不是想取多少就能取多少。
>
> 所以**搜索态不走分页**：分页会让「排在后面才匹配」的订单永远漏掉，语义上就不成立。
> 订单量真的大到需要全量搜索时，正解是加一个服务端专用云函数，而不是把上限调大。

顺带一提：商品名是**快照**，下单之后改了商品标题，历史订单仍按当时下单的名字参与匹配。

#### 批量取消：只有待支付订单能选

右上角「批量」进入多选模式，此时点卡片是**勾选**而不是进详情：

| 约束 | 为什么 |
| --- | --- |
| 只有 `pending` 可选，其余状态置灰 | 其余状态都不在「可取消」的流转里，云端会直接返回 `INVALID_TRANSITION` |
| 整批只弹一次确认框 | 选 20 单弹 20 次是最劝退的交互 |
| 串行执行，不并发 | 每单都要过云函数状态机、取消时还要回补库存；并发既容易撞限流，也会让回补失败的日志互相穿插、事后无法按订单定位 |
| 单笔失败不中断 | 失败多半是「这笔已被超时关单 / 在别处取消过」，与其余订单无关；中断只会让人白选一遍 |

结果按成功 / 失败笔数汇总提示（例如「成功 8 笔，失败 2 笔」）。

> **有失败笔数就说明本地这批数据已经过期**，页面会全量刷新一次。
> 不要逐笔重试 —— 重试多半还是同一个结果。

批量入口同样是 `src/utils/order-actions.ts` 的 `cancelOrdersByIds()`，
与单笔取消共用同一套状态机、同一把防重复提交锁、同一条 Mock / 云端分流。

## ⚠️ 改完什么必须「重新编译 + 清缓存」

小程序端（微信开发者工具打开 `dist/dev/mp-weixin`）**不是所有改动都能热更新**。
同一个坑会表现成「源码已经是 A、跑起来的还是 B」——先查这张表，再怀疑逻辑。

### 必须重新编译（停掉 dev 进程，重跑 `pnpm dev:mp-weixin`）

| 改动的东西 | 为什么热更新救不了 | 备注 |
| --- | --- | --- |
| `.env` / `.env.development` / `.env.production` | 环境变量在**构建期**就被静态替换成字面量（见上一节） | dev 改 `.env.development`，build 改 `.env.production` |
| `mock/products_02.json` | 被 `src/utils/mock.ts` 静态 `import`，整个 JSON 打进产物 | 顺手同步 `cloudfunctions/seedProducts/products.json` |
| `src/manifest.json` | appId、`mp-weixin` 配置由编译器读取并生成 `app.json` / `project.config.json` | appId 变了要重新打开项目 |
| `src/pages.json` | 路由 / tabBar / 分包是**编译期**生成的 `app.json`，不是运行时数据 | tabBar 变了建议一并清编译缓存 |
| `vite.config.ts` / `tsconfig.json` | 构建配置只在 dev 进程启动时读一次 | — |
| `package.json`（增删依赖） | 依赖图变了 | 先 `pnpm install`，再重启 dev 进程 |
| `src/static/**`（图片、tabBar 图标等） | 小程序端静态资源不走 HMR，靠编译拷贝 | — |
| 新增 `src/utils/**` 等被页面 `import` 的新模块 | 产物里文件已存在，但开发者工具的模块表还按旧快照构建 | 报 `module 'utils/xxx.js' is not defined`，整页白屏，见下方「新增文件要重开 IDE」 |
| 新增页面 / 组件文件（首次引入） | HMR 对"新文件 + 新路由"组合经常失手 | 表现是"点进去白屏 / 找不到页面" |

只改现有 `*.vue` / `*.ts` 的内容（样式、逻辑）走 HMR 就行，**不需要**重编译。

### 什么时候才需要清缓存

顺序永远是：**先重新编译 → 还不对 → 再清缓存**。清缓存不是第一手段。

微信开发者工具 → 工具栏「清缓存」：

| 选项 | 清掉什么 | 什么时候用 |
| --- | --- | --- |
| 清除编译缓存 | 编译中间产物 | 改完 `.env` / `pages.json` / `manifest.json` 后行为没变 |
| 清除文件缓存 | 本地文件缓存 | 图片、静态资源不刷新 |
| **清除数据缓存** | **本地 storage**：登录态、本地购物车/收藏、`mock_orders` | **慎用**，见下方警告 |
| 清除全部缓存 | 以上全部 + 授权数据 | 只在确认要"从零开始"时用 |

> ⚠️ **「清除数据缓存」会清掉本地 storage**：
> H5 / App 端的匿名登录 uid 存在本地，清了就等于**换了个人**（详见「跨端身份与数据归属」）；
> 小程序的本地购物车 / 收藏 / `mock_orders` 也会一起消失。
> 排查「改完不生效」时优先只清**编译缓存 + 文件缓存**，别随手清数据缓存。

#### 新增文件要重开 IDE，只点「编译」不够

微信开发者工具会缓存一份**文件快照**。dev 进程明明已经把新文件写进了 `dist/dev/mp-weixin`，
IDE 却仍按旧快照建立模块表，于是页面 `require` 它时直接炸在加载阶段：

```
Error: module 'utils/order-actions.js' is not defined, require args is '../../utils/order-actions.js'
Page "pages/order/order-list" has not been registered yet.
```

别被报错骗了——这里**既不是路径写错，也不是没编译出来**。先直接看产物就能区分：

```powershell
Get-ChildItem dist\dev\mp-weixin\utils -Filter 'order-actions*'
```

文件在 → 就是 IDE 的快照没更新，按这个顺序来：

1. 终端 `Ctrl+C` 停掉 dev 进程；
2. 删掉 `dist\dev` 整个目录（`Remove-Item -Recurse -Force dist\dev`），让产物全量重出；
3. 微信开发者工具「清缓存」→ **清除编译缓存 + 清除文件缓存**；
4. **完全退出 IDE 再重开** —— 只点「编译」不会重建快照，这一步是关键；
5. 重跑 `pnpm dev:mp-weixin`，等产物写完，再用 `Ctrl+B`「重新编译」，别用热重载。

> 「清除数据缓存」和模拟器里的清缓存都**不是**这一档：前者清的是本地 storage
> （换 uid、清掉购物车），后者清不掉 IDE 的编译快照。这一步别勾。

一个连带现象值得记住：加载失败的模块所引用的**下游模块也不会执行**，
它们的启动日志会整条消失（本例就是 `💳 [支付] 模式：…` 那行不见了）。
所以**启动日志少了一行，往往是某个新模块没加载成功的第一个信号**，
顺着这条链往上找，比盯着报错里的路径名有用。

### 一分钟自查

出现「源码已改、页面还是老行为」时，按顺序确认：

1. **看启动日志的数据源横幅**（`🧪 [Mock] 商品数据源…` / `☁️ [CloudBase] 商品数据源…`）——先确认走的是哪条路；
2. **看开发者工具打开的是哪个目录**：`dist/dev/mp-weixin`（dev）还是 `dist/build/mp-weixin`（build）——开关跟着产物走，不跟着源码走；
3. 停掉 dev 进程重新 `pnpm dev:mp-weixin`，再点一次开发者工具的「编译」；
4. 仍然不对，清**编译缓存 + 文件缓存**；
5. **涉及新增文件**时（报错 `module '…' is not defined`、页面白屏、某个模块不执行），
   以上都不够：删 `dist\dev` → **完全退出 IDE 再重开** → 重启 dev → `Ctrl+B` 重新编译。

云函数（`cloudfunctions/**`）不属于这条链路：它不进小程序包，改完要**部署**而不是重新编译，见下一节。

## 商品数据初始化（`seedProducts` 云函数）

⚠️ `.env` 的开关只决定「页面读哪边」，**不会把数据搬过去**。本地 Mock 的商品来自
`mock/products_02.json`，走云端时页面读的是云数据库 `products` 集合——后者需要先灌入数据，
否则商品列表会为空、商品详情会提示「商品不存在」。

### 单一数据源：`mock/products_02.json`

为了让两种模式看到的商品完全一致，两边共用同一份 JSON：

```
mock/products_02.json  ──同步──▶  cloudfunctions/seedProducts/products.json
   （本地 Mock 直接读）                （随云函数代码包上传，服务端读取）
```

云函数运行在服务端，**只能读取自己目录内的文件**，所以第二份副本是必需的。

### 同步商品数据走 CloudBase MCP 查询

改完 `mock/products_02.json` 后，把它复制一份到云函数目录：

```bash
# Windows PowerShell
Copy-Item mock/products_02.json cloudfunctions/seedProducts/products.json

# macOS / Linux
cp mock/products_02.json cloudfunctions/seedProducts/products.json
```

### 部署并触发写入

```bash
tcb functions:deploy seedProducts
```

也可以在控制台「云函数 → seedProducts → 云端测试」中直接触发，**测试参数留空即可**：

```json
{}
```

不传参时云函数会自动读取同目录的 `products.json`；数据量很大或想从前端触发时，也可以
调用时直接传数组（`products.json` 仍作为兜底）：

```typescript
await app.callFunction({
  name: 'seedProducts',
  data: { products: [...] },
})
```

写入语义是「按 `_id` 覆盖」（`doc(id).set()`），**重复执行不会产生重复数据**，可安全地反复运行。

### 为什么必须沿用 mock 里的 `_id`

商品详情页用 `doc(id).get()` 精确查询，`id` 取自列表页卡片的 `product._id`。
写入时沿用 `mock/products_02.json` 中已有的 `_id`（而不是让数据库自动生成 ObjectId），
能让同一份数据在 Mock 模式与云端模式下 **`_id` 完全相同**，
这样开关怎么切都不会出现「列表有数据、点进去查不到」的情况。

## 部署指南

### 配置云函数安全规则（H5 / 匿名端必需）

微信小程序端用户以 OpenID 身份调用云函数，一般不受影响；
但 H5、App 等端是**匿名登录**身份。如果环境级「云函数安全规则」不允许匿名调用，
客户端只会收到 `EXCEED_AUTHORITY`（函数根本不会执行），界面表现为「下单失败 / 操作失败」。

在 控制台 → 云函数 → 安全规则 中按需放行（`*` 保持原有收紧策略，只放行订单相关函数）：

```json
{
  "*": { "invoke": "auth != null && auth.loginType != 'ANONYMOUS'" },
  "createOrder": { "invoke": "auth != null" },
  "updateOrderStatus": { "invoke": "auth != null" },
  "wxpayOrder": { "invoke": "auth != null" }
}
```

> 这里放行的只是「能否调用云函数」，函数的登录态校验仍在服务端执行（拿不到 uid 会返回 `UNAUTHENTICATED`）。
>
> 定时任务 `closeExpiredOrders` **不需要**加进这份白名单：它由定时触发器在平台侧直接调用，
> 不走客户端调用鉴权。反过来也建议保持不加 —— 加进去等于允许客户端手动触发一次全量扫描。
>
> 支付回调 `wxpayOrderCallback` 同理**不要**加：它由微信支付在服务端调用，加进去等于
> 允许客户端伪造「支付成功」通知（不过函数里还有一层金额/订单校验兜着）。
> `wxpayOrder` 是按需加 —— 它走 `wx.cloud` 通道调用，若环境级规则拦住了微信身份，
> 表现为支付时提示「调用支付服务失败」。

### 配置数据库安全规则（`carts` / `favorites` / `orders` 等「按用户」集合）

购物车与收藏都是「一个用户一条文档」，分别存在云端 `carts` 与 `favorites` 集合：

| 集合 | 文档结构 | 存储层 |
| --- | --- | --- |
| `carts` | `{ userId, items, createdAt, updatedAt }` | `src/utils/cart.ts` |
| `favorites` | `{ userId, items, createdAt, updatedAt }` | `src/utils/favorite.ts` |

两个存储层共用同一个骨架工厂 `src/utils/user-scoped-store.ts`
（uid 缓存 / 本地镜像 / 临时区 / 单飞推送 / 启动合并），
各自只提供三样差异：条目结构、变化签名、合并规则。

> **`addresses` 不套这个工厂**：它是「一个用户多条文档 + 逐条 `doc(id)` 增删改」，
> 而工厂假设的是「一个用户一条文档 + 整份 `items` 覆盖写」。
> 地址还带 `isDefault` 唯一性约束，整份覆盖遇上离线合并可能造出两个默认地址；
> 且下单时要读的是**最新**地址，不是「最终一致」的地址。

App 启动时会把「本地临时车 / 本地临时收藏」**并行**合并进各自云端集合，
旧版本的本地数据会自动迁移，无需手工处理。

两者的安全规则完全一致，必须按 `userId` 判定归属（集合不存在时先新建）：

```json
{
  "read": "auth.uid != null && doc.userId == auth.uid",
  "create": "auth.uid != null && request.data.userId == auth.uid",
  "update": "auth.uid != null && doc.userId == auth.uid",
  "delete": "auth.uid != null && doc.userId == auth.uid"
}
```

规则也可以精简为三行：`update` / `delete` 未配置时会继承 `write`，
所以用一条 `write` 收敛即可；但 `create` 校验的是 `request.data.*`，必须单独写。

```json
{
  "read": "auth.uid != null && doc.userId == auth.uid",
  "create": "auth.uid != null && request.data.userId == auth.uid",
  "write": "auth.uid != null && doc.userId == auth.uid"
}
```

两个容易踩的坑：

1. **不要写成 `doc._openid == auth.openid`**：匿名登录会话里 `auth.openid` 为空，
   规则这样写会导致 H5 / 匿名端「只能新增，读取和更新全部 403」
   （`DATABASE_PERMISSION_DENIED: Permission denied by security rules`）。
2. **`create` 规则不要引用 `doc.*`**：创建时文档还不存在，应校验 `request.data.userId`。

> 按 `userId` 判定归属的规则还有「查询条件子集校验」：客户端查询必须自带能覆盖规则的条件，
> 所以代码里统一用 `where({ userId }).get() / .update()`，
> 不能用 `doc(id).get() / .update()`（会 403）。

#### `orders` 集合（客户端只读，写入仅限云函数）

订单写入完全走 `createOrder` 云函数：金额由服务端按 `products` 的权威价格重算，
归属用户取自登录态（拿不到 uid 直接返回 `UNAUTHENTICATED`），
所以客户端**一个字都写不进去**，只保留读权限：

```json
{
  "read": "auth.uid != null && doc.userId == auth.uid",
  "write": false
}
```

> **`auth.uid != null` 不能省。**
> 只写 `doc.userId == auth.uid` 时，若集合里存在一条**缺 `userId` 的文档**
> （控制台手工补数据、导入历史订单、将来某个新云函数漏传），
> 未登录状态下 `auth.uid` 为 `null`，此时 `doc.userId == auth.uid`
> 就退化成 `null == null` → **判真**，该订单被静默读出：
> 规则引擎不报错，日志里也没有痕迹。
> 而 Publishable Key 本身就打包在前端、公开可见，构造这个请求的成本极低。
>
> 订单虽然有云函数兜底写入 `userId`，但安全规则是最后一道防线，
> 应当自身闭环，而不是依赖「上游数据永不脏」。
> `carts` / `favorites` 同样带该守卫，三个集合保持一致。
>
> 加上它不引入任何额外的查询条件要求（子集校验只看 `doc.*` 字段，
> `auth.uid` 不是文档字段），客户端现有的 `where({ userId })` 查询无需改动。

### 库存扣减与销量累加（`createOrder` / `updateOrderStatus`）

`products` 集合的两个字段由订单流程维护（客户端对 `products` 只读，写操作只在云函数里发生）：

| 字段 | 含义 | 何时变化 |
| --- | --- | --- |
| `stock` | 剩余库存 | 下单 `-qty`；取消订单 `+qty` |
| `sales` | 累计销量 | 下单 `+qty`；取消订单 `-qty` |

#### 为什么不会超卖

扣减用的是**条件更新**，把「判断」和「扣减」合并成服务端的一次原子操作：

```js
// 只有「库存仍然 >= 购买数量」时才会命中并扣减；否则命中 0 条
await db.collection('products')
  .where({ _id: productId, stock: _.gte(quantity) })
  .update({ stock: _.inc(-quantity), sales: _.inc(quantity) })
```

两个容易踩的坑：

1. **不要写成「先读库存 → 判断 → 再写回」**：两次网络往返之间若插入并发订单，
   两个请求会读到同一个旧值（如 `stock = 1`）、双双通过判断，同一件商品就卖出了两次。
2. **不要用「回读文档再比对」来判断是否扣减成功**：并发下同样会误判
   （A / B 同时读到 `stock = 5`、各买 3 件，A 扣减后库存变成 2，
   B 回读到的 2 恰好等于「B 自己算出来的 5 - 3 = 2」，于是 B 以为自己也扣成了）。
   要依据服务端返回的**命中行数** `res.updated`（`@cloudbase/node-sdk` 的 `IUpdateResult`）。

#### 订单快照里的 `stockReservedQty`

下单时每个商品条目都会记下「本次从 `stock` 扣掉了几件」，取消订单时按它精确回补：

| 值 | 含义 | 取消时怎么回补 |
| --- | --- | --- |
| `> 0` | 已扣减 | `stock + stockReservedQty`，`sales - quantity` |
| `0` | 商品没有 `stock` 字段（视为不限库存） | 只回退销量 |
| 缺省 | 本功能上线前创建的订单，未参与核算 | 不回补（当时也没扣过） |

一个订单会有多个商品，逐条扣减时若第 N 条没库存，前 N-1 条已扣的会**立即回滚**
（库存不足、扣减异常、订单写库失败三条失败路径都会回滚），
保证「要么整单扣成功，要么一件都不扣」。

#### 回补只会执行一次

`updateOrderStatus` 把「刚校验过的旧状态」也写进 `where`：

```js
await db.collection('orders')
  .where({ _id: orderId, userId: uid, status: 'pending' })   // ← 旧状态充当乐观锁
  .update({ status: 'cancelled', updatedAt: Date.now() })
```

校验与修改合成一次原子操作，连点两次「取消订单」时只有第一个请求能命中
（`updated === 1`），后到的命中 0 条、直接返回 `CONFLICT`，
因此库存不会被回补两遍。回补放在状态更新**之后**，
正是因为它依赖这一条「只会成功一次」的更新来做幂等。

同一条更新也是定时任务 `closeExpiredOrders`（见下一节）超时关单的幂等依据：
定时器重复触发、两次运行在时间上重叠，都只会命中一次；
用户在超时边缘刚好付款成功时，这条更新命中 0 条，就不会把已支付的订单关掉。

若回补本身失败（例如商品文档已被删除），函数返回 `warning: 'STOCK_RESTORE_FAILED'`
并打错误日志：此时订单已经是「已取消」，不能返回失败让用户重试
（重试会撞上「`cancelled` 是终态」而报错），只能留日志人工核对。

**重复「取消」一个已取消的订单会被当作成功**：`updateOrderStatus` 直接返回
`{ success: true, idempotent: true }` 并且**不再回补**。这是为了兜住
「用户页面还停留在待支付、订单已经被超时关单」的场景 —— 再点一次取消不该看到报错，
更不该让库存被补第二次。注意只对 `cancelled` 放行：其他状态照旧走状态机校验，
否则「给已取消的订单付款」会被误判成成功。

> ⚠️ **重新灌种子数据会重置库存与销量**：`seedProducts` 用 `doc(_id).set()` 覆盖整个文档，
> 会把 `stock` / `sales` 恢复成 `products.json` 里的初始值。演示前想恢复初始库存可以这么用，
> 但**别在有真实订单的环境里随手重跑**。

> ⚠️ **待支付订单会占住库存**：本模板是「下单即扣减」，而 `pending` 订单不会自动过期，
> 长期挂着的未支付订单会一直占用库存。所以需要下一节那个定时任务来兜底
> —— 不部署它，库存就会只减不增。

### 待支付订单超时自动关单（`closeExpiredOrders` 云函数）

「下单即扣减」必须配一个兜底任务，否则用户下单后不付款，那批库存就永远回不来。
`closeExpiredOrders` 就是这件事的定时执行者：

```
每 5 分钟触发一次
  └─ 查 status = 'pending' 且 createdAt < 现在 - 30 分钟 的订单
      └─ 逐条 where({ _id, status: 'pending' }).update({ status: 'cancelled' })
          └─ 只有命中 1 条的那一次，才回补该订单的库存与销量
```

它和「用户手动取消」走的是**同一条状态流转、同一套回补规则**，
区别只是一个由用户触发、一个由定时触发。

#### 触发器配置

触发器写在 `cloudbaserc.json` 里，随函数一起下发，不需要在控制台手工配：

```json
{
  "name": "closeExpiredOrders",
  "runtime": "Nodejs18.15",
  "handler": "index.main",
  "timeout": 60,
  "envVariables": {
    "PAYMENT_TIMEOUT_MINUTES": "30"
  },
  "triggers": [
    { "name": "close-expired-orders", "type": "timer", "config": "0 */5 * * * * *" }
  ]
}
```

```bash
tcb functions:deploy closeExpiredOrders
```

> ⚠️ **cron 是 7 段**（秒 分 时 日 月 周 年），不是 Linux 那套 5 段 crontab。
> `0 */5 * * * * *` = 每 5 分钟的第 0 秒；写成 5 段会配置失败。

#### 两个可调项

| 想改什么 | 改哪里 | 默认值 |
| --- | --- | --- |
| 超时时长 | `cloudbaserc.json` 的 `PAYMENT_TIMEOUT_MINUTES`（改完要重新部署） | 30 分钟 |
| 扫描频率 | `cloudbaserc.json` 的 `triggers[0].config` | 每 5 分钟 |

两者是解耦的：订单会在「创建满 30 分钟之后的第一次扫描」被关掉，
即最迟第 35 分钟，而不是精确的第 30 分钟。

#### 先 dryRun 再真跑

在 控制台 → 云函数 → `closeExpiredOrders` → 云端测试 里传参即可：

```json
{ "dryRun": true }
```

`dryRun` 只回报「会关掉哪些订单」（`wouldClose` 里最多列 20 条），**不写任何数据**。
确认无误后再执行真实关单：`{}` 按默认 30 分钟；`{ "timeoutMinutes": 0 }`
把所有待支付订单都视为已超时（会真关单，慎用）。

返回值里的几个计数：

| 字段 | 含义 |
| --- | --- |
| `scanned` | 本次检查过的超时订单数（dryRun 下它就等于「会被关掉」的数量） |
| `closed` / `restoredItems` | 成功关闭的订单数 / 回补的商品条目数（dryRun 下都是 0） |
| `skipped` | 已被用户先一步付款或取消而跳过（**正常现象，不是错误**） |
| `wouldClose` / `wouldCloseCount` | 仅 dryRun：会关掉哪些订单（最多列 20 条）/ 一共多少条 |
| `updateFailures` / `restoreFailures` | 关单写库失败数 / 回补失败数（`success: false` 时看 `errors`） |
| `truncated` | `true` 表示单次没跑完（超过 200 条或 40 秒预算），剩下的下一轮继续 |

#### 为什么不会重复回补

幂等靠的是与手动取消**完全相同**的那条条件更新（见上一节「回补只会执行一次」）：
`where({ _id, status: 'pending' })` 保证同一个订单只会被成功关闭一次。
因此定时器重复触发、两次运行重叠、用户与定时器同时操作，都不会把库存回补两遍。

> 💡 数据量大时，建议在控制台给 `orders` 加一个 `status + createdAt` 的复合索引；
> 否则每轮的 `where({ status, createdAt: _.lt(deadline) })` 会退化成全表扫描。

### 真实微信支付（`wxpayOrder` + `wxpayOrderCallback` 云函数）

待支付订单的「立即支付」走的是**真实微信支付**（仅微信小程序端；H5 / App 端自动退回模拟支付）。

```
小程序页 payOrder()
  ├─ wx.cloud.callFunction('wxpayOrder', { action: 'create', orderId })
  │     └─ 校验归属/状态 → 用服务端金额统一下单（out_trade_no = orderNo）→ 返回收银台参数
  ├─ wx.requestPayment({ timeStamp, nonceStr, package, signType, paySign })   ← 用户付款
  └─ wx.cloud.callFunction('wxpayOrder', { action: 'query', orderId })
        └─ 主动查单，trade_state = SUCCESS 则把订单置为已支付（幂等）

微信支付 ──支付结果通知──▶ wxpayOrderCallback ──▶ 同样把订单置为已支付（幂等）
```

| 云函数 | 触发方 | 职责 |
| --- | --- | --- |
| `wxpayOrder` | 小程序（`wx.cloud` 通道） | 统一下单 + 主动查单，并把支付结果同步回订单状态 |
| `wxpayOrderCallback` | 微信支付（服务端） | 支付结果通知 → 幂等置为已支付 |

几个刻意的设计：

1. **金额只在服务端算**：`amount.total` 取自订单快照 `totalPriceCents`，客户端传不了金额，
   否则「定价权」就跑到了用户手里。
2. **`out_trade_no` 复用 `orderNo`**：支付回调只回传 `out_trade_no`，
   直接复用它就能一步反查到本地订单，不需要额外维护映射表
   （下单成功后仍会把 `outTradeNo` 记进 `orders.payment` 供人工核对）。
3. **状态由服务端写入**：`wx.requestPayment` 的 success 只代表「用户付了」，
   页面的做法是回过头调用 `query` 确认，再刷新订单 —— 客户端不自己改状态。
4. **幂等靠条件更新**：`where({ _id, userId, status: 'pending' }).update({ status: 'paid' })`，
   校验与修改是一次原子操作；回调与主动查单可能同时到达，只有第一个能命中。

> 💡 **付了钱但订单已被超时关单**（用户在 30 分钟边缘付款）时，
> 服务端会返回 `warning: 'ORDER_CANCELLED_BUT_PAID'` 并打错误日志：
> 钱已经收到、订单却是 `cancelled`，属于**需要人工核对/退款**的情况，这里不静默吞掉。

#### 为什么支付必须单独走 `wx.cloud.callFunction`

项目其余业务都走 `@cloudbase/js-sdk` 的 HTTPS 网关（`app.callFunction`），**只有支付这一个环节例外**：

| 通道 | 服务端能拿到的身份 | 能否下单 |
| --- | --- | --- |
| `app.callFunction`（HTTPS 网关） | CloudBase 用户标识 `uid`（如 `daVOWZdt…`） | ❌ 微信支付 JSAPI 要的是 `payer.openid` |
| `wx.cloud.callFunction` | `getWXContext().OPENID`（微信 openid） | ✅ |

两者**不是一回事**：`uid` 是 CloudBase 的用户标识（登录态里的那个），
`openid` 是微信侧的身份。走网关调用时函数里压根拿不到 openid，
而微信支付 JSAPI 下单 `payer.openid` 是必填项，所以支付单独走小程序原生通道。

> ⚠️ 因此 `wxpayOrder` **不能**用 `app.callFunction` 调用，会直接返回 `NEED_WX_OPENID`。
> `src/utils/payment.ts` 已经把这件事封装好了，页面不用关心。

#### 控制台配置（必做）

以下三步都在 CloudBase 控制台完成，缺任何一步「下单」都会失败：

1. **配置商户凭证**：控制台 →「微信支付」（微信支付云模板 / 扩展能力）→
   填入**商户号（mchId）**、**APIv3 密钥**、**API 证书**。凭证由平台加密保管，
   不需要（也**不应该**）写进代码或环境变量。
2. **绑定小程序**：确认商户号已与当前小程序 appid 完成绑定（否则下单会报 openid 不合法）。
3. **配置支付通知云函数**：在微信支付模板参数里，把「接收支付通知的云函数」设为
   `scf:wxpayOrderCallback`。
   **不配这一步不会导致收不到钱，但订单状态只能靠前端主动查单兜底**
   —— 用户付完钱直接关掉小程序时，订单就会一直停在待支付。

#### 部署

```bash
tcb functions:deploy wxpayOrder
tcb functions:deploy wxpayOrderCallback
```

> `wxpayOrder` 依赖 `wx-server-sdk`（取微信上下文）与 `@cloudbase/node-sdk`（读写订单）。
> 用 MCP / CLI 部署时会自动安装依赖，无需手工 `npm install`。

#### 排错对照表

| 现象 / 返回值 | 原因 | 处理 |
| --- | --- | --- |
| `Illegal base64 character …`、`MISSING_CREDENTIALS` | 商户凭证未配置或配置有误 | 回到控制台重配商户号 / APIv3 密钥 / 证书 |
| `NEED_WX_OPENID` | 用 `app.callFunction`（网关通道）调了支付函数 | 改为 `wx.cloud.callFunction`；页面用 `utils/payment.ts` |
| `openid 不合法` / `openid 不匹配` | 商户号没和当前小程序 appid 绑定 | 在微信支付侧完成绑定 |
| `FORBIDDEN` | 调用者身份对不上订单归属 | 看日志里脱敏后的 `uid` / `openid` / `orderUserId` 定位是哪一侧不一致 |
| 付款成功、订单还是「待支付」 | 支付通知云函数没配 / 回调延迟 | 配 `scf:wxpayOrderCallback`；前端主动查单已能兜住大部分场景 |
| 页面提示「订单已取消但收到支付成功」 | 超时关单与付款撞车 | 人工核对并退款（服务端已打错误日志） |

#### 与模板自带的 `wxpayFunctions` 是什么关系

环境里由「微信支付云模板」生成的 `wxpayFunctions` 是一段**示例代码**：
商品描述写死成 `'<商品描述>'`、金额写死成 1 分、订单号随机生成，不接收任何业务参数，
**无法用来支付某一笔真实订单**。所以本项目没有改它，而是直接调用它底层的支付模块
（`cloudbase_module` 的 `wxpay_order`），自己传 `description` / `amount` / `out_trade_no` / `payer.openid`。

### 跨端身份与数据归属（为什么购物车在另一端看不到）

上面按 `userId` 判定归属，解决的是「两端判定标准是否一致」，
**不等于**「同一个人在两端一定是同一个账号」。这两件事要分开看：

- **判定标准**（由规则决定）：`doc.userId == auth.uid` 两端一致，
  因此不会出现「两端 uid 其实相同、却仍被判成两个创建者」的情况。
- **身份**（由登录方式决定）：规则管不着。**uid 不同就是两个账号，数据互不可见**——这不是 bug。

各端登录方式与 uid 特点：

| 端 | 登录方式 | uid 特点 |
| --- | --- | --- |
| 微信小程序 | `signInWithOpenId` | 与微信账号绑定，永久稳定，清缓存 / 换设备后不变 |
| H5 / App | `signInAnonymously` 匿名登录 | 存在本地，**清缓存即换新 uid** |

于是：

| 场景 | uid | 数据是否互通 |
| --- | --- | --- |
| 同一端、同一账号 | 相同 | 互通 |
| 两端登录收敛到同一 CloudBase 用户（例如两端都用同一手机号登录） | 相同 | 互通 |
| 小程序微信登录 ↔ H5 未登录（匿名） | 不同 | 不互通（正常现象） |
| H5 匿名后清缓存重进 | 不同（新匿名 uid） | 不互通（相当于换了个人） |

**要让跨端数据互通，只能在产品层做身份收敛，调权限档位没有用**。可用手段：

1. **H5 端「匿名转正」**：引导用户绑定手机号或做微信公众号授权登录。绑定成功后 **uid 不变**，
   匿名期间的数据自动归属到正式账号，零迁移（见 `src/utils/cloudbase.ts` 的 `linkIdentityWithProvider`）。
2. **两端登录到同一身份源**：例如两端都用同一手机号登录，通常会被归并为同一个 CloudBase 用户。
3. **微信身份跨端不等于同一账号**：小程序与公众号的 **openid 是两个不同的值**（appid 不同），
   要靠 **unionid** 才能识别为同一个微信用户。所以「H5 走公众号授权登录」并不自动等于
   「和小程序端是同一个 uid」，需确认环境已绑定同一微信开放平台账号并实测。

> 这也是**不使用控制台内置「仅创建者可读写（PRIVATE）」档位**的原因之一：该档位由服务端按
> `_openid` 自动过滤（不要求业务代码写 `where({ _openid })`），而两端使用的身份标识不同
> （官方说明：小程序端为 openid、Web 端为 uid）。因此即使两端 uid 已经相同，归属字段里躺的
> 仍是两个不同的值，会被判成两个创建者，且该字段由服务端写入、客户端无法修正。

> 一句话：**「加的车在另一端看不到」是登录身份问题，不是权限配置问题。**
> 想解决请引导 H5 用户登录，而不是改集合权限。

### 部署云函数

可以使用 CloudBase CLI 或 MCP 工具部署云函数：

```bash
# 使用 CloudBase CLI
tcb functions:deploy hello
```

### 部署到云开发静态网站托管（H5版本）

1. 构建 H5 版本：`npm run build:h5`
2. 登录腾讯云开发控制台
3. 进入您的环境 -> 静态网站托管
4. 上传 `dist/build/h5` 目录中的文件

### 微信小程序发布

1. 构建微信小程序版本：`npm run build:mp-weixin`
2. 使用微信开发者工具打开 `dist/build/mp-weixin` 目录
3. 上传代码包并发布

### 抖音小程序发布

1. 构建抖音小程序版本：`npm run build:mp-toutiao`
2. 使用抖音开发者工具打开 `dist/build/mp-toutiao` 目录
3. 上传代码包并发布

### 支付宝小程序发布

1. 构建支付宝小程序版本：`npm run build:mp-alipay`
2. 使用支付宝开发者工具打开 `dist/build/mp-alipay` 目录
3. 上传代码包并发布


## 平台适配状态

### ✅ 已适配平台

#### H5 端
- ✅ 完全支持所有云开发功能
- ✅ 支持本地开发和生产部署
- ✅ 已配置相关安全域名

#### 微信小程序
- ✅ 完全支持所有云开发功能
- ✅ 支持本地开发和发布
- ✅ 已配置相关域名白名单

#### 抖音小程序
- ✅ 完全支持所有云开发功能
- ✅ 支持本地开发和发布
- ✅ 已配置相关域名白名单

#### 支付宝小程序
- ✅ 完全支持所有云开发功能
- ✅ 支持本地开发和发布
- ✅ 已配置相关域名白名单

#### App 端 (iOS/Android)
- ✅ 完全支持所有云开发功能
- ✅ 支持通过 HBuilderX 进行本地开发
- ✅ 需要配置移动应用安全来源


### 🚧 开发中平台

#### 其他小程序平台
- 🚧 适配开发中

<!--
## 移动应用安全凭证配置

如果需要在 App 端使用，需要配置移动应用安全凭证：

1. 在云开发控制台【环境】->【安全配置】->【移动应用安全来源】中添加应用
2. 输入应用标识（如：`uni-app`）
3. 获取凭证信息
4. 在 `src/utils/cloudbase.ts` 中取消注释并配置：

```typescript
const config = {
  env: 'your-env-id',
  appSign: 'your-app-sign',
  appSecret: {
    appAccessKeyId: 1,
    appAccessKey: 'your-app-secret'
  }
};
```

-->

## 功能演示

项目包含完整的云开发功能演示：

- **认证功能**: 匿名登录/退出、手机验证码登录、邮箱验证码登录、密码登录、微信小程序 openId 静默登录
- **微信支付**: 服务端统一下单 + 支付回调改状态（仅微信小程序端；其他端为模拟支付）
- **云函数调用**: 调用示例云函数
- **云托管**: 调用云托管服务
- **数据库操作**: 增加和查询数据
- **数据库监听**: 实时监听数据变化
- **文件存储**: 上传和下载文件



## 使用 CloudBase CLI 部署

```bash
# 安装 CloudBase CLI
npm install -g @cloudbase/cli

# 登录
tcb login

# 部署到云开发
tcb framework deploy
```

## 技术栈

- **UniApp** - 跨平台应用开发框架
- **Vue 3** - 渐进式 JavaScript 框架
- **TypeScript** - JavaScript 的超集，提供类型支持
- **Vite** - 下一代前端构建工具
- **CloudBase JS SDK** - 腾讯云开发 JavaScript SDK

## 开发注意事项

1. **环境变量**: 确保正确配置云开发环境 ID
2. **安全域名**: 根据部署平台配置相应的安全域名
3. **权限配置**: 注意数据库集合的读写权限设置
4. **跨端兼容**: 部分 API 在不同平台表现可能不同，注意测试
5. **改完要重新编译**: 改 `.env` / `mock/products_02.json` / `src/manifest.json` / `src/pages.json` / `vite.config.ts` / `package.json` 依赖等**构建期输入**后，必须重新编译（仍不生效再清编译缓存）；
   只改现有 `*.vue` / `*.ts` 的内容则交给 HMR 即可。详见上文「⚠️ 改完什么必须『重新编译 + 清缓存』」

## 临时文件与删除命令注意事项

### 云函数代码包自带 `node_modules`

以「安装依赖」方式部署的函数（包括环境里由云模板生成的 `wxpayFunctions`），其代码包内**包含 `node_modules`**。
对照函数详情里的 `CodeSize` 就能看出来：本项目 `wxpayOrderCallback` 约 **2.98 MB**，
而它本身的源码只有 `index.js` + `package.json`。

因此**下载这类函数的代码会一次带下几百上千个文件**，解压到项目里既污染工作区，也会让 `git status` 变成一片噪音。

> 只读源码时直接读工具返回的内容即可，**不要为了看几个文件先把整包解压到仓库里**。

### 临时目录一律放系统临时目录

| 做法 | 评价 |
| --- | --- |
| 解压到仓库内（如 `.tmp-wxpay`） | ❌ 污染工作区；删除时还会触发 IDE 的大批量文件确认 |
| 解压到 `$env:TEMP\<name>` | ✅ 推荐：与仓库隔离，删除时不会扫描项目目录 |
| 不落盘，直接读工具返回内容 | ✅ 首选：连删都不用删 |

`.gitignore` 已加入 `.tmp-*` 作为兜底，但**更好的做法是一开始就别在仓库里建**。

### 删除命令的写法

`Remove-Item -Recurse -Force` 有几个容易误解的点：

| 写法 | 实际作用 |
| --- | --- |
| `-Force` | 只处理隐藏 / 只读文件，**不等于跳过确认** |
| `-ErrorAction SilentlyContinue` | 只压制**错误输出**，与确认提示无关 |
| `-Confirm:$false` | 这才是显式关闭确认提示 |

另外三点：

- `Remove-Item -Force` 是**永久删除、不进回收站**，删错无法撤销；
- 「递归 + 强制删除」这类不可逆命令，AI 助手的终端工具会先扫描目标范围、列出将被删除的文件数交给你确认
  （本次弹出的「将删除 500+ 个文件」即由此而来）。**这是安全护栏，不是故障**——
  文件数异常偏大时，先想想是不是把 `node_modules` 一起圈进去了；
- 删除时**用绝对路径**并先判断存在性，避免相对路径在 CWD 意外变化时删错东西：

```powershell
# 推荐：绝对路径 + 存在性判断 + 显式表态
$tmp = Join-Path $env:TEMP 'wxpay-inspect'
if (Test-Path $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force -Confirm:$false }
```

一句话：**不在仓库里制造临时文件，就不用面对删除确认。**

## 相关链接

- [UniApp 官方文档](https://uniapp.dcloud.io/)
- [云开发官方文档](https://cloud.tencent.com/document/product/876)
- [云开发 JS SDK](https://docs.cloudbase.net/api-reference/webv3/initialization)
- [CloudBase AI ToolKit](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit)

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个模板！

## 许可证

MIT License
