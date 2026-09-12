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
```

两个开关在构建期都会被静态替换成字面量并常量折叠，`if (USE_MOCK)` 在编译期就有确定结果。
这也意味着**两个变量必须在 `.env.development` / `.env.production` 里显式声明**：
未声明的 `VITE_` 变量拿不到值，开关会退化成运行时读取，连常量折叠都会失效。

> Mock 数据本身能否从产物里移除，取决于 rollup 的 chunk 划分：被多个页面共享时
> 会拆出独立的 `mock-*.js` 公共 chunk，其中的 JSON 仍在包里（**不影响运行**——
> 开关为 false 时永远不会被读取）。这是拆分开关之前就已有的行为。

顺带一提：这也是排查「本地有数据但页面为空」类问题的第一手线索——
先看数据源日志，再怀疑权限。

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
  "updateOrderStatus": { "invoke": "auth != null" }
}
```

> 这里放行的只是「能否调用云函数」，函数的登录态校验仍在服务端执行（拿不到 uid 会返回 `UNAUTHENTICATED`）。

### 配置数据库安全规则（`carts` / `favorites` / `orders` 等「按用户」集合）

购物车与收藏都是「一个用户一条文档」，分别存在云端 `carts` 与 `favorites` 集合：

| 集合 | 文档结构 | 存储层 |
| --- | --- | --- |
| `carts` | `{ userId, items, createdAt, updatedAt }` | `src/utils/cart.ts` |
| `favorites` | `{ userId, items, createdAt, updatedAt }` | `src/utils/favorite.ts` |

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

## 相关链接

- [UniApp 官方文档](https://uniapp.dcloud.io/)
- [云开发官方文档](https://cloud.tencent.com/document/product/876)
- [云开发 JS SDK](https://docs.cloudbase.net/api-reference/webv3/initialization)
- [CloudBase AI ToolKit](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit)

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个模板！

## 许可证

MIT License
