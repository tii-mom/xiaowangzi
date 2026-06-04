# Cloudflare Workers 部署方案 (POC)

> **状态**: POC（概念验证）/ 非生产上线  
> **最后更新**: 2026-06-04

## 当前状态说明

1. 本方案是 Cloudflare Workers 部署的 **POC（概念验证）**，不代表已经生产上线。
2. 仅在验证通过后，才会推进到正式上线阶段。
3. 当前主线仍为腾讯云 standalone 部署（见 `docs/DEPLOYMENT.md`）。

---

## 架构分工

### Cloudflare 负责

- Next.js 前端（wan.lat）
- Next.js API Routes
- Cloudflare D1 数据库
- DeepSeek API 调用
- BufPay 支付回调（/api/pay/notify）
- Web session（/api/auth/web-session）
- Dashboard / Pay / Bind / Admin 页面
- Hermes webhook 接收（/api/webhook/hermes）

### 腾讯云负责

- Hermes Agent（hermes.wan.lat）
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

Cloudflare Workers 配置文件，定义 Worker 名称、入口文件、资源目录和兼容性设置。

### open-next.config.ts

@opennextjs/cloudflare 的配置入口，当前使用默认配置。

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
| `BUFPAY_NOTIFY_URL` | BufPay 支付回调地址（`https://wan.lat/api/pay/notify`） |
| `BUFPAY_RETURN_URL` | BufPay 支付完成跳转地址（`https://wan.lat/dashboard`） |
| `BUFPAY_AMOUNT_TOLERANCE_CENTS` | 金额容差（分，默认 `0`） |

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

#### D1BindingAdapter（PR-CF2 新增）

`wrangler.jsonc` 中添加 `d1_databases` binding：
```jsonc
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

Worker 运行时通过 `getCloudflareContext()` 的 `env.DB` 获取原生 D1 绑定。

#### D1RestAdapter（PR-CF1 引入）

通过环境变量访问 D1：

| 变量 | 说明 |
|------|------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `CLOUDFLARE_DATABASE_ID` | Cloudflare D1 数据库 ID |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |

### 配置方式

Cloudflare Workers 环境变量通过以下方式配置：

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

## 命令

### 本地预览

```bash
npm run cf:preview
```

这将构建 Cloudflare Workers 版本并启动本地预览服务器。

### E2E Smoke 测试

```bash
BASE_URL=<cf-preview-url> npx tsx scripts/test-e2e-smoke.ts
```

### 部署

```bash
npm run cf:deploy
```

部署前需配置远端 secrets：

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put HERMES_WEBHOOK_SECRET
```

`wrangler.jsonc` 中的 `vars` 字段已包含 staging 默认值（APP_ENV, DEPLOY_ENV, CHAT_MIN_TOKEN_BALANCE 等）。

### TypeScript 类型生成

```bash
npm run cf:typegen
```

生成 `cloudflare-env.d.ts`，提供 Cloudflare Workers 环境变量类型提示。

---

## 回滚方式

1. **Cloudflare Workers 历史版本回滚**：在 Cloudflare Dashboard → Workers & Pages → xiaowangzi → Deployments → 选择历史版本回滚。
2. **重新部署上一个 commit**：`git checkout <previous-commit> && npm run cf:deploy`

---

## Workers Runtime 兼容性

### 未验证项汇总（PR-CF1.5 状态）

| 功能 | 状态 | 备注 |
|------|------|------|
| **HermesAgentManager** | ⏭️ 未验证 | Hermes 未验证，不可设置 `AGENT_BACKEND=hermes` |
| **BufPay 端到端支付** | ⚠️ 部分验证 | 签名验证通过（见下方），订单创建需完整 auth session |

### Staging 验证结果（PR-CF1.5 — Cloudflare D1 + DeepSeek）

> **验证日期**: 2026-06-04  
> **D1 访问方式**: D1 REST Adapter（通过 CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_DATABASE_ID / CLOUDFLARE_API_TOKEN 环境变量），**未使用** wrangler `d1_databases` binding  
> **Preview URL**: `http://localhost:8787` (Cloudflare workerd runtime)  
> **说明**: 所有验证使用 **真实 D1 REST Adapter**（非 MockAdapter），数据直接查询 D1 确认。D1 Binding Adapter 留到 PR-CF2。

| 功能 | 状态 | D1 验证 | 详情 |
|------|------|---------|------|
| API Routes (Route Handlers) | ✅ | N/A | `/api/health`、`/api/auth/web-session` 等 |
| Cookie set/read | ✅ | N/A | `auth_token` cookie |
| POST body JSON 解析 | ✅ | N/A | web-session、chat/send |
| x-www-form-urlencoded body 解析 | ✅ | N/A | BufPay notify `URLSearchParams` 解析 |
| BufPay MD5 签名验证 | ✅ | N/A | 正确签名通过，错误签名 400 拒绝 |
| node:crypto / crypto.randomBytes | ✅ | N/A | `nodejs_compat` 已启用 |
| **D1 REST Adapter** | ✅ | ✅ | 真实 D1 读写，users 表 2 条记录 |
| **auth_sessions 创建** | ✅ | ✅ | 2 个 session 持久化到 D1 |
| **token_ledger 写入 (grant)** | ✅ | ✅ | grant: +10000, source=free_trial |
| **token_ledger 写入 (usage)** | ✅ | ✅ | usage: -598, balance_after=9402 |
| **DeepSeek fetch** | ✅ | N/A | 真实 API 调用，小王子正常回复 |
| **conversations 写入** | ✅ | ✅ | user + assistant 消息持久化 |
| **Chat usage finalizer** | ✅ | ✅ | 598 tokens 正确扣减，balance: 10000→9402 |
| **Admin overview** | ✅ | ✅ | users_count: 2 |
| Payment finalizer | ⚠️ | N/A | 签名验证通过，订单创建需额外步骤 |
| system_events 写入 | ⏭️ | 未测试 | 未触发系统事件 |

### Remote Staging 验证结果（PR-CF3 — Cloudflare Workers 远端部署）

> **验证日期**: 2026-06-04  
> **远端 URL**: `https://xiaowangzi.348421501.workers.dev`  
> **D1 binding**: `DB` (xiaowangzi-staging, D1BindingAdapter)  
> **说明**: Worker 部署到 Cloudflare 远端，使用 `wrangler deploy`。所有验证通过远端 URL 发起，数据写入远程 D1。

| 功能 | 状态 | D1 确认 | 详情 |
|------|------|---------|------|
| **远端 Worker 部署** | ✅ | N/A | `wrangler deploy` 成功 |
| GET /api/health | ✅ | N/A | `{"ok":true}` |
| POST /api/auth/web-session | ✅ | ✅ | User 3/4 创建，session 持久化 |
| GET /api/user/me | ✅ | N/A | id match |
| GET /api/user/tokens | ✅ | ✅ | ledger 数据正确 |
| GET /api/user/orders | ✅ | N/A | orders array |
| GET /legal/privacy | ✅ | N/A | 200 |
| GET /legal/terms | ✅ | N/A | 200 |
| **POST /api/chat/send** | ✅ | ✅ | DeepSeek 真实回复, 516 tokens |
| **token_ledger (grant)** | ✅ | ✅ | +10000, free_trial |
| **token_ledger (usage)** | ✅ | ✅ | -516, balance=9484 |
| **conversations 写入** | ✅ | ✅ | user + assistant 消息 |
| GET /api/admin/overview | ✅ | ✅ | users_count: 4 |
| BufPay x-www-form-urlencoded | ⚠️ | N/A | 本地验证通过，远端未单独测试 |

#### 2. 已通过 (Staging Verification Passed) — 仅限创单与签名回调技术链路 (PR-CF4b)
- **create-order Blocker 解除**: 在接口请求体中明确传入 `format: 'json'` 参数，BufPay 接口在成功配置收款二维码后，已能正确以 JSON 返回包含订单和付款二维码的数据，成功解除 HTML Cashier 页面阻断问题。
- **返回订单支付数据**:
  - `status`: `"ok"`
  - `aoid`: BufPay 内部订单号 (如 `21816bc872ba4819b65d4d214841386a`)
  - `pay_type`: `wechat` (或 `alipay`)
  - `price`: 订单实际价格 (支持金额微调, 如 `28.98` 或 `29.00`)
  - `qr`: 支付二维码数据
  - `expires_in`: 订单过期时间 (秒)
  - `return_url`: 用户支付完成跳转页面
- **Signed Notify 技术链路通过**:
  - 成功验证：用户登录、获取真实订单、D1 确认为 pending、模拟签名 notify 触发、订单自动流转为 `paid`、`token_ledger` purchase 写入、用户余额 `token_balance` 增加、subscriptions active、防重幂等及安全边界检测。
- **金额容差微调兼容说明**: 
  - Staging 环境中 `BUFPAY_AMOUNT_TOLERANCE_CENTS` 设定为 `10`（10分）。
  - **原因**: 个人免签收款在并发支付相同金额套餐时，BufPay 会通过微调几分钱金额（如 29.00 -> 28.98）来防止多用户支付占位冲突。
  - **生产考量**: 此 10 分钱容差为 Staging 阶段技术闭环验证配置。在下一阶段 PR-CF5 中，生产环境的最终容差需要进一步明确，生产环境建议优先使用保守设置（如 0 或极小范围），除非 BufPay 实测回调确实需要微调容差。
- **联调测试脚本**: `scripts/test-bufpay-staging.ts` 执行成功，退出码为 `0`。
- **远端冒烟测试**: `scripts/test-e2e-smoke.ts` 验证通过，退出码为 `0`。

#### 3. 未验证项 (Staging 局限说明 — 并不代表生产完全上线)
- **用户真实扫码支付**: 尚未有人工进行真钱微信/支付宝扫码付；
- **真实扣款链路**: 尚未进行微信/支付宝账户扣款测试；
- **APP 到账检测**: 尚未通过手机端的 BufPay App 监听通知并发起真实到账 webhook notify；
- **生产环境**: 生产域名 `wan.lat` 与生产 Secrets 配置；
- **Hermes 微信机器人**: `HermesAgentManager` 核心对话控制流仍待后续单独验证。

#### 4. 联调验证测试指令
- **测试子链路（结算记账与幂等）**:
  ```bash
  BASE_URL=https://xiaowangzi.348421501.workers.dev \
  BUFPAY_APP_SECRET=$BUFPAY_APP_SECRET \
  npx tsx scripts/test-bufpay-notify-finalizer.ts
  ```
  *(注: 此脚本使用 D1 REST API 直连远程数据库，插入 pending 订单并模拟回调，预期通过 Exit 0)*

- **测试完整链路 (E2E)**:
  ```bash
  BASE_URL=https://xiaowangzi.348421501.workers.dev \
  BUFPAY_APP_SECRET=$BUFPAY_APP_SECRET \
  npx tsx scripts/test-bufpay-staging.ts
  ```
  *(注: 此脚本尝试通过 API 创建真实订单，当前已通，预期成功 Exit 0)*

> **说明**: 远端 staging 不等于生产上线。这是 Cloudflare Workers 的 POC staging 环境。  
> **APP_URL / NEXT_PUBLIC_APP_URL**: staging 环境指向 `https://xiaowangzi.348421501.workers.dev`，配置在 `wrangler.jsonc` 的 `vars` 中。



### 已知限制

- Cloudflare Workers 不支持完整的 Node.js API。项目使用 `nodejs_compat` 兼容性标志。
- `node:crypto` 的某些方法需要 `nodejs_compat`（已验证通过）。
- Workers 无文件系统访问，所有数据需通过 D1 或 KV 存储。
- Next.js `next build` 强制 `NODE_ENV=production`。本地 POC 使用 `DATABASE_ADAPTER=mock` 强制 MockAdapter（见 `lib/db.ts` 修改）。

### .dev.vars 本地开发文件

本地 preview 需要的环境变量通过 `.dev.vars` 提供（不入库）。最少配置：

```
APP_ENV=preview
DATABASE_ADAPTER=mock
SESSION_SECRET=dev-secret
CHAT_MIN_TOKEN_BALANCE=10000
```

> **关键**: `APP_ENV=preview` 用于标记非生产环境。Cloudflare Preview 中 Next.js 构建强制 `NODE_ENV=production`，需要通过 `APP_ENV=preview` 明确告知 `lib/db.ts`：这不是真实生产环境，允许使用 MockAdapter。

如需测试真实 D1（需要完整 D1 凭据）：
```
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_DATABASE_ID=xxx
CLOUDFLARE_API_TOKEN=xxx
```

> **注意**: `.dev.vars` 已加入 `.gitignore`，不要提交真实密钥。

---

## 数据库适配器生产门禁

`lib/db.ts` 的 `createDatabaseAdapter()` 有严格的生产环境门禁：

### 生产信号（任意一项命中代表非本地/CI）

| 信号 | 来源 |
|------|------|
| `NODE_ENV=production` | Next.js 构建设置 |
| `APP_ENV=production` | 显式生产标记 |
| `DEPLOY_ENV=production` | 部署环境标记 |
| `APP_URL` 包含 `wan.lat` | 生产域名 |
| `NEXT_PUBLIC_APP_URL` 包含 `wan.lat` | 生产域名 |

### MockAdapter 规则

| 场景 | 结果 |
|------|------|
| 生产信号 + `DATABASE_ADAPTER=mock` | ❌ 抛出错误: "Mock database adapter is not allowed in production" |
| 生产信号 + `APP_ENV=preview` + `DATABASE_ADAPTER=mock` | ✅ MockAdapter（preview 模式） |
| 非生产环境 + `DATABASE_ADAPTER=mock` | ✅ MockAdapter |
| 生产信号 + D1 凭据完整 | ✅ D1RestAdapter |
| 生产信号 + 无 D1 凭据 | ❌ 抛出错误 |

> **硬规则**: 真实生产环境**永远不允许**使用 MockAdapter，不会静默降级。

---

## 当前默认行为

1. **Agent 后端**: 当前默认使用 `LocalAgentManager`，不依赖 Hermes。
2. **Hermes 状态**: `HermesAgentManager` 未经验证，**不要设置 `AGENT_BACKEND=hermes`**。
3. **Web MVP 独立运行**: Web MVP 不依赖 Hermes，Hermes 不可用时仍可正常运行。
4. **Hermes webhook**: 当 Hermes 接入时，webhook 必须携带 `HERMES_WEBHOOK_SECRET` 进行签名验证。

---

## 注意事项

- 不要在此阶段删除 `docs/DEPLOYMENT.md`（腾讯云部署文档）。
- 不要将 Cloudflare API Token 写入文档或提交到仓库。
- 不要记录真实 secret 值。
- 这是 POC，不要假装 Cloudflare 已上线。
