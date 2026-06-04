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

### D1 REST Adapter（PR-CF1 阶段）

PR-CF1 继续使用 D1 REST Adapter（`lib/db.ts`），需要以下环境变量：

| 变量 | 说明 |
|------|------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `CLOUDFLARE_DATABASE_ID` | Cloudflare D1 数据库 ID |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（有 D1 读/写权限） |

> **注意**: PR-CF2 将引入 D1 Binding Adapter，届时不再需要 REST API 方式访问 D1。

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

### 已验证（PR-CF1 首次验证）

| 功能 | 状态 | 备注 |
|------|------|------|
| API Routes (Route Handlers) | ✅ 通过 | `/api/health`、`/api/auth/web-session` 等 |
| Cookie set/read | ✅ 通过 | `auth_token` cookie 正常设置和读取 |
| POST body JSON 解析 | ✅ 通过 | web-session、chat/send 等正常 |
| x-www-form-urlencoded body 解析 | ⏭️ 未验证 | BufPay notify 使用，本地 POC 未测试 |
| node:crypto / crypto.randomBytes | ✅ 通过 | `nodejs_compat` 已启用，crypto 正常 |
| DeepSeek fetch | ⏭️ 未配置 | DEEPSEEK_API_KEY 未在 .dev.vars 中设置 |
| D1 REST Adapter fetch | ⏭️ 未验证 | CLOUDFLARE_DATABASE_ID 未配置 |
| MockAdapter (内存数据库) | ✅ 通过 | DATABASE_ADAPTER=mock 正常 |
| auth_sessions 创建 | ✅ 通过 | web-session 创建用户和 session |
| token_ledger 写入 | ✅ 通过 | free_trial grant 正常写入 |
| payment_orders 写入 | ⏭️ 未验证 | 需要 BUFPAY 配置 |
| conversations 写入 | ⏭️ 未验证 | 需要 DEEPSEEK_API_KEY |
| system_events 写入 | ⏭️ 未验证 | 需要 D1 或 MockAdapter |
| Chat usage finalizer | ⏭️ 未验证 | 需要 DEEPSEEK_API_KEY |
| Payment finalizer | ⏭️ 未验证 | 需要 BUFPAY 配置 |
| Admin overview | ⏭️ 未验证 | 本地 POC 使用 MockAdapter，admin 需 ADMIN_TOKEN |

### 已知限制

- Cloudflare Workers 不支持完整的 Node.js API。项目使用 `nodejs_compat` 兼容性标志。
- `node:crypto` 的某些方法需要 `nodejs_compat`（已验证通过）。
- Workers 无文件系统访问，所有数据需通过 D1 或 KV 存储。
- Next.js `next build` 强制 `NODE_ENV=production`。本地 POC 使用 `DATABASE_ADAPTER=mock` 强制 MockAdapter（见 `lib/db.ts` 修改）。

### .dev.vars 本地开发文件

本地 preview 需要的环境变量通过 `.dev.vars` 提供（不入库）。最少配置：

```
NODE_ENV=development
DATABASE_ADAPTER=mock
SESSION_SECRET=dev-secret
CHAT_MIN_TOKEN_BALANCE=10000
```

如需测试真实 D1：
```
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_DATABASE_ID=xxx
CLOUDFLARE_API_TOKEN=xxx
```

> **注意**: `.dev.vars` 已加入 `.gitignore`，不要提交真实密钥。

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
