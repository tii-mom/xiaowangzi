# Cloudflare Workers 部署方案 (POC)

> **状态**: POC（概念验证）/ 验证通过  
> **最后更新**: 2026-06-05

## 当前状态说明

1. 本方案是 Cloudflare Workers 部署的 **POC（概念验证）**。
2. 经过微信与支付宝的真实 E2E 扫码支付测试，证明整体技术闭环已**完全跑通**。

---

## 架构分工

### 架构口径说明

- **主线定位**：当前 Web/API 主线为 **Cloudflare Workers**。
- **腾讯云定位**：腾讯云仅负责 **Hermes / 微信机器人 / iLink / 长连接**。
- **微服务解耦**：Hermes 的状态与部署情况**不阻塞** Web MVP 的运行与测试。
- **后端设置**：当前默认使用 `LocalAgentManager`。除非对接联调，请**不要设置 `AGENT_BACKEND=hermes`**。

### Cloudflare 负责

- Next.js 前端（`wan.lat`）
- Next.js API Routes
- Cloudflare D1 数据库
- DeepSeek API 调用
- BufPay 支付回调（`/api/pay/notify`）
- Web session（`/api/auth/web-session`）
- Dashboard / Pay / Bind / Admin 页面
- Hermes webhook 接收（`/api/webhook/hermes`）

### 腾讯云负责

- Hermes Agent（`hermes.wan.lat`）
- 微信机器人
- iLink / 扫码 / 个人号消息收发
- 长连接
- 向 Cloudflare `/api/webhook/hermes` 发送 webhook

### 域名规划

| 域名 | 用途 | 平台 |
|------|------|------|
| `wan.lat` | Web/API 入口 | Cloudflare Workers |
| `hermes.wan.lat` | Hermes Agent | 腾讯云 CVM |

---

## 依赖安装

项目已安装：

- `@opennextjs/cloudflare` — Next.js → Cloudflare Workers 适配器
- `wrangler` — Cloudflare Workers CLI

---

## 配置文件

### wrangler.jsonc

Cloudflare Workers 配置文件，定义 Worker 名称、入口文件、资源目录和 D1 数据库绑定。

### open-next.config.ts

`@opennextjs/cloudflare` 的配置入口，当前使用默认配置。

---

## 环境变量 / Secrets 配置

### P0 必需

| 变量 | 说明 |
|------|------|
| `NODE_ENV` | 运行环境，生产设 `production` |
| `APP_URL` | 应用访问地址，如 `https://wan.lat` |
| `NEXT_PUBLIC_APP_URL` | 前端公开访问地址，同 `APP_URL` |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 |
| `DEEPSEEK_BASE_URL` | DeepSeek API 基础地址（默认 `https://api.deepseek.com`） |
| `DEEPSEEK_MODEL` | DeepSeek 模型名称（默认 `deepseek-v4-flash`） |
| `ADMIN_TOKEN` | 管理后台 Token |
| `SESSION_SECRET` | 会话加密密钥 |
| `CHAT_MIN_TOKEN_BALANCE` | 对话最低 Token 余额（默认 `10000`） |

### 支付

| 变量 | 说明 |
|------|------|
| `BUFPAY_AID` | BufPay 商户 ID |
| `BUFPAY_APP_SECRET` | BufPay 应用密钥 |
| `BUFPAY_NOTIFY_URL` | BufPay 支付回调地址（`https://pay-staging.wan.lat/api/pay/notify`） |
| `BUFPAY_RETURN_URL` | BufPay 支付完成跳转地址（`https://pay-staging.wan.lat/dashboard`） |
| `BUFPAY_AMOUNT_TOLERANCE_CENTS` | 金额容差（分，默认 `10`）。详见下方“金额容差与微调说明” |

### Hermes Webhook

| 变量 | 说明 |
|------|------|
| `HERMES_WEBHOOK_SECRET` | Hermes Webhook 签名密钥 |

### D1 访问方式

项目支持两种 D1 访问方式，按优先级自动选择：

| 优先级 | 方式 | 条件 | 文件 |
|--------|------|------|------|
| 1 | **D1BindingAdapter** | Workers runtime 有 D1 binding (`env.DB`) | `lib/d1-binding-adapter.ts` |
| 2 | **D1RestAdapter** | 有 `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_DATABASE_ID` / `CLOUDFLARE_API_TOKEN` | `lib/db.ts` |
| 3 | MockAdapter | 非生产环境兜底 | `lib/db.ts` |

#### D1BindingAdapter (原生 D1 绑定)

`wrangler.jsonc` 中添加 `d1_databases` binding：
```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "xiaowangzi-staging",
      "database_id": "83f12b1f-885e-4616-a7ff-4016dbdacef2"
    }
  ]
}
```

#### D1RestAdapter (REST API 远程访问)

通过本地环境变量访问 D1：

| 变量 | 说明 |
|------|------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `CLOUDFLARE_DATABASE_ID` | Cloudflare D1 数据库 ID |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |

### 配置方式

Cloudflare Workers 环境变量配置：

```bash
# Secret（加密存储）
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_TOKEN

# 普通变量
npx wrangler deploy --var APP_URL:https://wan.lat
```

或使用 `wrangler.jsonc` 中的 `vars` 字段（仅适用于非敏感变量）。

> **禁止**: 不要将真实密钥、token、secret 写入 `.env`、`wrangler.jsonc`、或提交到 git。

---

## 常用部署命令 (Runbook)

### 本地预览

```bash
npm run cf:preview
```

构建 Cloudflare Workers 并在本地预览。

### 远端冒烟测试

```bash
BASE_URL=https://pay-staging.wan.lat npx tsx scripts/test-e2e-smoke.ts
```

### 部署

```bash
npm run cf:deploy
```

### TypeScript 类型生成

```bash
npm run cf:typegen
```

生成 `cloudflare-env.d.ts` 以提供环境变量类型声明。

### 回滚方式

1. **Cloudflare Workers 部署版本回滚**：在 Cloudflare Dashboard → Workers & Pages → xiaowangzi → Deployments → 选择历史部署版本进行一键回滚。
2. **本地重新部署历史 Commit**：`git checkout <commit_sha> && npm run cf:deploy`。

---

## Staging 验证结果 (PR-CF4c — 真实扫码支付联调)

> **验证日期**: 2026-06-05  
> **Staging URL**: `https://pay-staging.wan.lat`  
> **D1 binding**: `DB` (`xiaowangzi-staging`, D1BindingAdapter)

### 1. 真实扫码与技术闭环验证状态

- **微信支付真实扫码**: ✅ **已验证**。手机微信扫码真实支付 0.10 元，BufPay 安卓监听 App 在后台自动捕获并推送 Webhook，本地订单状态成功流转为 `paid` 并完成记账（额度 +100，订阅激活）。
- **支付宝真实扫码**: ✅ **已验证**。手机支付宝扫码真实支付 0.10 元，BufPay 成功自动回调，本地订单状态转为 `paid` 且记账闭环和订阅（`staging_test_10c`）激活验证完全通过。
- **自动 Webhook 回调**: ✅ **已验证**。回调均由 BufPay 平台真实推送（`auto_notify`），在 Cloudflare WAF 中对 `/api/pay/notify` 进行了放行配置以绕过 Bot 拦截，整体测试中无需任何手动补单或 curl 模拟。

### 2. 金额容差与微调说明 (`BUFPAY_AMOUNT_TOLERANCE_CENTS=10`)

- **定位与作用**：此 10 分钱容差设定是 **Staging 环境下的真实扫码联调配置**。
- **使用场景**：个人免签收款方案（如 BufPay）在多用户并发支付相同套餐时，会通过微调几分钱金额（如 0.10 -> 0.11 或 0.09）来防止多用户支付占位冲突。该容差用于兼容此微调行为，防止由于几分钱的偏差导致订单拒付。
- **生产配置指引**：此配置**不代表**生产环境（`production`）的最终配置。在下一阶段 **PR-CF5** 中，必须根据生产环境收款码的并发需求重新评估并确认容差。为了保障业务与财务安全，生产环境建议**优先从严配置**（如设置为 0 或极小范围）。

### 3. Debug 接口说明 (`/api/debug/bufpay-ping`)

- **定位与作用**：`/api/debug/bufpay-ping` 是一个**仅限 Staging 环境的调试端点 (staging-only debug endpoint)**，免验签，直接将请求头和客户端 IP 记录到 `system_events` 中。
- **生产安全防范**：为避免安全隐患，在生产环境（`production`）下，此路由会**严格拦截并返回 403 Forbidden**，确保不会被外部利用，不可用于生产健康检查。
- **后续处理**：该端点目前仅作为可达性测试的临时排查工具。在后续的 **PR-CF5** 阶段，可以根据需要决定保留该端点（作为受限的 debug 工具）或直接将其代码从项目中移除。

### 4. 测试套餐生产隔离设计 (staging_test_10c)

为保障生产环境安全，测试套餐 `staging_test_10c`（0.10 元）配置了严格的环境隔离机制：
- **接口拦截**: `/api/pay/create-order` 会检测当前环境。当判定处于生产环境（`APP_URL` 为 `https://wan.lat` 或 `https://www.wan.lat`）且用户尝试创建测试订单时，接口会抛出 `400` 拦截创单。
- **前端隐藏**: 在检测到生产环境域名时，收银台页面（`/pay`）将自动过滤并隐藏测试套餐，防止真实用户可见。

### 5. 联调验证测试指令

#### 执行回归与对账测试

- **测试完整 Staging 记账与回调逻辑 (回归测试)**:
  ```bash
  BASE_URL=https://pay-staging.wan.lat \
  BUFPAY_APP_SECRET=$BUFPAY_APP_SECRET \
  node --experimental-strip-types scripts/test-bufpay-staging.ts
  ```
- **执行远端 API 冒烟测试**:
  ```bash
  BASE_URL=https://pay-staging.wan.lat \
  node --experimental-strip-types scripts/test-e2e-smoke.ts
  ```

---

## 限制与注意事项

- **Workers 局限性**: Workers 不支持本地文件系统写入，运行中所有数据必须存储至 D1 数据库。
- **构建限制**: Next.js 在 `next build` 时默认为 `production` 状态。非生产环境下，可配置 `APP_ENV=preview` 和 `DATABASE_ADAPTER=mock` 来强制启用 Mock 数据库进行本地开发。
- **数据一致性**: Cloudflare D1 作为分布式数据库，在高并发写入及后续读取之间可能存在微小的读取延迟（极短时间内的最终一致性）。在编写轮询与同步逻辑时，应进行必要的容错或短暂重试。
- 不要在此阶段删除 `docs/DEPLOYMENT.md`（腾讯云部署文档）。
- 不要将 Cloudflare API Token 写入文档或提交到仓库。
- 不要记录真实 secret 值。
- 这是 POC，不要假装 Cloudflare 已上线。
