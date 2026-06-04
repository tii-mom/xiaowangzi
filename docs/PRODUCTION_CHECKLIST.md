# Web MVP 生产灰度上线检查清单

本清单用于把 `xiaowangzi` 推进到“可灰度上线 Web MVP”的状态。项目负责人负责最终验收；任何未真实验证的项目都必须标记为阻塞或未验证，不得跳过门禁。

## 0. 上线边界

- 当前目标：Web MVP 灰度上线。
- 完整微信机器人不属于本阶段目标。
- Hermes 微信通道尚未真实验证，不得声明已接通。
- 生产环境不得启用 `AGENT_BACKEND=hermes`。
- 生产环境默认使用 `LocalAgentManager`。
- 生产环境不得使用 MockAdapter 或任何 mock 数据库降级路径。
- 不提交 `.env`、API key、token、app secret、webhook secret。

## 1. 代码同步与本地基线验证

在本地或服务器项目目录执行：

```bash
git checkout main
git pull origin main
npm ci
npm run lint
npm run build
npx tsx scripts/test-user-dashboard.ts
```

启动本地服务后执行：

```bash
npx tsx scripts/test-e2e-smoke.ts
```

门禁：

- 任何失败都必须先修复。
- 不允许失败测试 `exit 0`。
- 不允许在旧分支继续开发。
- 有 open PR 时必须先阅读，避免重复实现。

## 2. 生产环境变量检查

服务器真实 `.env` 路径：

```text
/Users/yudeyou/Desktop/wangzi/xiaowangzi/.env
```

只检查变量是否存在和格式是否正确，不输出真实值。

### P0 必需变量

- `NODE_ENV=production`
- `APP_URL=https://wan.lat`
- `NEXT_PUBLIC_APP_URL=https://wan.lat`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_DATABASE_ID`
- `CLOUDFLARE_API_TOKEN`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL=https://api.deepseek.com`
- `DEEPSEEK_MODEL=deepseek-v4-flash`
- `ADMIN_TOKEN`
- `SESSION_SECRET`

### P1 支付变量

- `BUFPAY_AID`
- `BUFPAY_APP_SECRET`
- `BUFPAY_NOTIFY_URL=https://wan.lat/api/pay/notify`
- `BUFPAY_RETURN_URL=https://wan.lat/dashboard`
- `BUFPAY_AMOUNT_TOLERANCE_CENTS=0`

### P2 Hermes 变量

- `HERMES_BASE_URL`
- `HERMES_API_KEY`
- `HERMES_WEBHOOK_SECRET`

Hermes 未真实验证前，只允许变量预留，不允许生产启用。

## 3. Cloudflare D1 门禁

必须完成：

1. 创建 Cloudflare D1 数据库。
2. 记录 `account_id` 与 `database_id`，但不记录 API token。
3. 执行以下 migration：
   - `migrations/0001_init.sql`
   - `migrations/0002_payment_idempotency.sql`
   - `migrations/0003_usage_idempotency.sql`
4. 验证表存在：
   - `users`
   - `auth_sessions`
   - `bind_codes`
   - `subscriptions`
   - `token_ledger`
   - `payment_orders`
   - `user_agents`
   - `conversations`
   - `system_events`
   - `admin_audit_logs`
5. 用生产环境变量运行一次真实 D1 查询。
6. 确认 production 不会自动降级 MockAdapter。

交付文档：`docs/PRODUCTION_D1_VERIFICATION.md`。

## 4. DeepSeek 真实联调门禁

必须验证 `/api/chat/send` 在真实 DeepSeek 下可用：

1. 配置 `DEEPSEEK_API_KEY`。
2. 启动本地或服务器生产等价环境。
3. 调用 `POST /api/auth/web-session` 并保留 `auth_token` cookie。
4. 调用 `POST /api/chat/send`：

```json
{ "message": "你好小王子，今天我有点累" }
```

必须验证：

- 返回 `reply`。
- `usage.total_tokens > 0`。
- `users.token_balance` 正确扣减。
- `token_ledger` 写入 `usage`。
- `conversations` 写入 user + assistant。
- 余额不足返回 402，不返回正式回复。
- usage 缺失时不免费放行。

交付文档：`docs/DEEPSEEK_REAL_TEST.md`。

## 5. BufPay 真实支付门禁

必须完成小额真实支付闭环：

1. BufPay Android App 在线。
2. 微信/支付宝收款码已配置。
3. `BUFPAY_AID` 与 `BUFPAY_APP_SECRET` 已配置。
4. `https://wan.lat/api/pay/notify` 公网可访问。
5. 创建订单：`POST /api/pay/create-order`。
6. 展示二维码并完成小额真实支付。
7. 等待 BufPay 回调。
8. 验证：
   - `payment_orders.status = paid`
   - `token_ledger` 的 purchase 只有 1 条
   - `users.token_balance` 增加 `tokens_amount`
   - `subscriptions` 创建或更新
   - 重复回调不会重复充值
   - 金额不一致会拒绝
   - 错误签名会拒绝

必须运行：

```bash
npx tsx scripts/test-bufpay-sign.ts
npx tsx scripts/test-payment-finalize.ts
```

交付文档：`docs/BUFPAY_REAL_TEST.md`。

## 6. 腾讯云部署门禁

目标：腾讯云 CVM + 域名 `wan.lat`。

必须满足：

- Node.js 20+
- `npm ci`
- `npm run build`
- Next standalone 输出
- PM2 启动
- Nginx 反向代理
- SSL 证书
- 防火墙只开放必要端口
- `/api/health` 可公网访问

部署文件：

- `ecosystem.config.js`
- `deploy/nginx.conf.example`
- `scripts/deploy.sh`
- `scripts/backup-db.sh`

PM2 要求：

- app name: `xiaowangzi`
- crash 后自动重启
- 日志路径：`/var/log/xiaowangzi/`
- `env_file` 指向服务器 `.env`

Nginx 要求：

- 反代到 `127.0.0.1:3000`
- 支持 Web API
- SSL
- `client_max_body_size 10m`
- `/api/pay/notify` 不被拦截

## 7. 部署后 E2E Smoke

部署后必须运行：

```bash
BASE_URL=https://wan.lat npx tsx scripts/test-e2e-smoke.ts
```

要求：

- web-session 成功
- cookie 保持成功
- `/api/user/me` 成功
- `/api/user/tokens` 成功
- `/api/user/orders` 成功
- `/api/health` 成功
- `/legal/privacy` 成功
- `/legal/terms` 成功
- 如果 `DEEPSEEK_API_KEY` 已配置，`chat/send` 必须成功或返回明确 402
- 如果 `ADMIN_TOKEN` 已配置，admin overview 必须带 token 成功

未通过前，不得声明已上线。

## 8. 最小运维能力

### 日志路径

- PM2 stdout：`/var/log/xiaowangzi/pm2-out.log`
- PM2 stderr：`/var/log/xiaowangzi/pm2-error.log`
- PM2 combined：`/var/log/xiaowangzi/pm2-combined.log`
- Nginx access：`/var/log/nginx/xiaowangzi.access.log`
- Nginx error：`/var/log/nginx/xiaowangzi.error.log`

### 常用命令

```bash
pm2 status xiaowangzi
pm2 restart xiaowangzi --update-env
pm2 reload ecosystem.config.js --only xiaowangzi --update-env
sudo nginx -t
sudo systemctl reload nginx
```

### 支付异常时关闭支付入口

优先使用代码或配置开关禁用创建订单入口；如果尚未实现运行时开关，则临时在 Nginx 层拦截 `/pay` 和 `/api/pay/create-order`，但不要拦截 `/api/pay/notify`，以免已支付订单无法回调。

### DeepSeek 异常时提示用户

- 用户界面返回明确的服务暂不可用提示。
- 不扣 Token，或确保失败扣费有补偿机制。
- 记录 `system_events`，但不得记录 API key 或完整敏感请求头。

### BufPay 回调失败人工补单

1. 在 BufPay 后台确认真实支付订单。
2. 根据 `payment_orders` 查询本地订单状态。
3. 确认金额、订单号、用户 ID、套餐与签名记录。
4. 通过受控 admin 工具或一次性脚本补记 `payment_orders`、`token_ledger` 与用户余额。
5. 记录 `admin_audit_logs` 与 `system_events`。
6. 同一订单不得重复补单。

### Admin 查看最近 system_events

使用 Admin 页面或受控 API 查询最近 `system_events`。访问时必须携带 `ADMIN_TOKEN`，不得在日志或截图中暴露 token。

## 9. 安全与运营边界

- 小王子不是医疗或心理治疗工具。
- 自伤、自杀、严重危机时，必须引导现实求助。
- legal 页面必须真实可访问。
- Footer 链接必须真实可访问。
- Prompt 不承诺治疗效果。
- 日志不输出密钥。
- webhook secret 不输出。
- admin token 不输出。
- `.env` 不入库。
