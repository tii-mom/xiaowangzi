# Production Runbook (生产环境运维指南)

本指南针对 `xiaowangzi` 项目在 Cloudflare Worker 生产环境中的部署、验证、安全放行、容灾回滚及财务审计进行规范化定义。

---

## 1. 生产部署命令 (Production Deploy)

在进行生产环境代码上线时，需先清理 OpenNext/Next 缓存，重新执行构建并推送至生产环境环境。

```bash
# 1. 清理本地缓存并执行 Cloudflare App 编译
rm -rf .open-next .next
npm run cf:build

# 2. 部署至生产环境
npx wrangler deploy --env production
```

---

## 2. 生产 D1 数据库初始化与验证 (D1 Setup & Verify)

生产环境数据库使用独立的 `xiaowangzi-production`。

### 初始化表结构与迁移
```bash
# 执行数据库迁移 (0001 - 0004) 到生产环境
npx wrangler d1 migrations apply xiaowangzi-production --remote --env production
```

### 数据库表结构完整性验证
```bash
# 查询生成环境所有的表结构
npx wrangler d1 execute xiaowangzi-production --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```
**期望结果**: 必须包含 `users`, `auth_sessions`, `bind_codes`, `token_ledger`, `user_agents`, `conversations`, `system_events`, `admin_audit_logs`, `payment_orders`, `subscriptions` 共 10 张核心业务表。

---

## 3. 生产环境变量与 Secrets 配置清单 (Vars & Secrets)

### 3.1 环境变量配置 (`wrangler.jsonc`)
无需交互导入，存放在 `wrangler.jsonc` 的 `env.production.vars` 中：
- `APP_ENV`: `"production"`
- `DEPLOY_ENV`: `"production"`
- `CHAT_MIN_TOKEN_BALANCE`: `"10000"` (允许对话的最小 Token 限制)
- `DEEPSEEK_BASE_URL`: `"https://api.deepseek.com"`
- `DEEPSEEK_MODEL`: `"deepseek-v4-flash"`
- `APP_URL`: `"https://wan.lat"`
- `NEXT_PUBLIC_APP_URL`: `"https://wan.lat"`
- `BUFPAY_NOTIFY_URL`: `"https://wan.lat/api/pay/notify"`
- `BUFPAY_RETURN_URL`: `"https://wan.lat/dashboard"`
- `BUFPAY_AMOUNT_TOLERANCE_CENTS`: `"0"` (生产环境容差严格为 0 元)

### 3.2 敏感密钥配置 (Secrets)
需要在本地终端交互式上传至 Cloudflare (不泄露真实值)：
```bash
npx wrangler secret put SESSION_SECRET --env production
npx wrangler secret put ADMIN_TOKEN --env production
npx wrangler secret put DEEPSEEK_API_KEY --env production
npx wrangler secret put HERMES_WEBHOOK_SECRET --env production
npx wrangler secret put BUFPAY_AID --env production
npx wrangler secret put BUFPAY_APP_SECRET --env production
```

---

## 4. 生产域名与重定向配置 (`wan.lat`)

- 主域名 `wan.lat` 绑定到 Worker 的 production 环境路由。
- 备用域名 `www.wan.lat` 必须在 Cloudflare 侧配置 301 永久重定向（Page Rules / Redirect Rules）指向主域名 `https://wan.lat`，防止搜索引擎权重分散及用户访问凭证跨域丢失。

---

## 5. Cloudflare WAF 最小放行配置 (WAF Rules)

为了确保 BufPay 自动回调（`auto_notify`）不遭遇 HTTP 599 错误拦截，必须配置自定义 WAF Skip 规则。

### 规则细节
- **规则路径**: 只限放行 `/api/pay/notify`。
- **动作**: `Skip` (跳过)。
- **跳过模块**: `Managed Rules` (托管规则), `Bot Fight Mode` / `BIC` (机器人挑战), `Security Level` (安全级别)。
- **严禁事项**: 绝对不允许全站关闭 WAF！除 notify 回调外，其他所有接口依然需要经过正常 WAF 审查防御。

---

## 6. 生产环境冒烟测试 (Smoke Test)

运行自动化测试套件确保各核心路由（Web-Session、Health、Me、Tokens 等）通畅：

```bash
# 需传入 DEEPSEEK_API_KEY 作为开关 (设为 true 即可绕过本地 Key 验证) 
BASE_URL=https://wan.lat DEEPSEEK_API_KEY=true ADMIN_TOKEN=<NEW_ADMIN_TOKEN> node --experimental-strip-types scripts/test-e2e-smoke.ts
```

---

## 7. DeepSeek 生产环境真实验证步骤 (DeepSeek E2E Verify)

验证大模型调用与扣减逻辑：

1. **登录创建会话**: 发起 `POST https://wan.lat/api/auth/web-session` 获取 Session Cookie。
2. **确认支付开通余额**: 确保当前用户有大于 10,000 的 Token 余额。
3. **发起对话请求**: 向 `/api/chat/send` 发送一段文本，例如 `{"message": "你好，请用一个词回复"}`。
4. **验证响应与落库**:
   - HTTP 返回 `200 OK`，且包含真实的 `reply` 内容。
   - `usage` 中包含非零的 `prompt_tokens` 和 `completion_tokens`。
   - 查询 `token_ledger`，成功存在一条 `type = usage` 且 `delta_tokens = -total_tokens` 的扣减项。
   - 查询 `conversations` 表，成功存在两条 role 分别为 `user` 和 `assistant` 的对话记录。
   - 检查 `users.token_balance` 是否被按 total_tokens 的数量精确扣减。

---

## 8. BufPay 29元微信支付真实测试步骤 (WeChat Payment Verify)

测试真实入账、记账与订阅激活：

1. **启动测试脚本**:
   ```bash
   BASE_URL=https://wan.lat PLAN_ID=monthly PAY_TYPE=wechat node --experimental-strip-types scripts/test-bufpay-real-scan.ts
   ```
2. **扫码付款**: 扫码支付真实 29.00 元。
3. **自动回调确认**:
   - 手机完成支付后，BufPay 平台发起自动回调。
   - 检查脚本轮询输出状态，等待直至本地检测到 `paid` 状态。
   - 查询 D1 `subscriptions` 确认已为该 user 录入 `plan = monthly` 且 `status = active` 的记录。
   - 查询 D1 `token_ledger` 确认有一条 `delta_tokens = 100000` 记账。

---

## 8.5 支付高并发防重测试步骤 (Payment Idempotency Race Test)

为确保并发 notify 回调不会导致重复入账，项目提供了并发测试脚本 `scripts/test-payment-idempotency-race.ts`。

### 8.5.1 安全机制与默认运行
为了防止在生产环境误执行测试，该脚本具有硬安全保护：
- **安全默认**: 默认情况下，`BASE_URL` 会使用 Staging 环境 (`https://pay-staging.wan.lat`)，`D1_DATABASE` 默认使用 `xiaowangzi-staging`。
- **并发数量**: 脚本会并发发送 10 个相同的支付 Webhook 回调，自动验证订单状态转为 `paid` 且 `token_ledger` 仅保留有 1 笔 purchase 流水。

### 8.5.2 生产环境并发测试 (需显式授权)
在生产环境的测试会产生测试订单和 ledger，**严禁常规运行**。仅限在上线验收窗口期由项目负责人显式授权并运行：
```bash
ALLOW_PRODUCTION_RACE_TEST=YES_I_UNDERSTAND \
BASE_URL=https://wan.lat \
D1_DATABASE=xiaowangzi-production \
WRANGLER_ENV=production \
BUFPAY_APP_SECRET=<本地密钥值> \
node --experimental-strip-types scripts/test-payment-idempotency-race.ts
```
如果检测到 `wan.lat` 生产环境但缺少 `ALLOW_PRODUCTION_RACE_TEST=YES_I_UNDERSTAND`，脚本将自动强阻断并报错退出。

---

## 9. 测试套餐生产禁用验证 (Staging Plan Block Verify)

测试套餐 `staging_test_10c` 绝对禁止在生产环境被使用。

### 验证方法
```bash
node -e "
fetch('https://wan.lat/api/pay/create-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ plan: 'staging_test_10c' })
}).then(res => res.status === 400 ? console.log('PASS ✅') : console.log('FAIL ❌', res.status));
"
```
**期望结果**: 必须输出 `PASS ✅`，接口强阻断并响应 HTTP 400。

---

## 10. 套餐对照清单 (Plan Matrix)

生产环境上架的 3 个正式套餐参数如下：

| Plan ID | Plan Name | Price (Yuan) | Tokens Amount | Pay Type |
| :--- | :--- | :--- | :--- | :--- |
| `monthly` | 月光陪伴版 | 29.00 | 100,000 | `wechat` (微信) |
| `quarterly` | 星球成长版 | 99.00 | 500,000 | `wechat` (微信) |
| `premium` | 玫瑰星云版 | 399.00 | 3,000,000 | `wechat` (微信) |

---

## 11. 回滚方案 (Rollback Procedures)

### 11.1 Worker 代码及路由回滚
- **直接回退**: 在 Cloudflare Dashboard 针对该 Worker 找到 `Deployments` 页签，选择前一个历史 Version ID，点击 `Rollback` 即可实现秒级无缝回滚。
- **重新构建推送**:
  ```bash
  git checkout <PREVIOUS_STABLE_COMMIT>
  npm run cf:build
  npx wrangler deploy --env production
  ```

### 11.2 环境变量及密钥回滚
- 修改 `wrangler.jsonc` 并重新运行 `deploy` 以还原变量。
- 若需要修改 Secrets，重新运行 `npx wrangler secret put <KEY> --env production`。

### 11.3 数据库 (D1) 紧急数据回滚
- Cloudflare D1 会自动保存数据快照。如有核心逻辑损坏，在 Cloudflare 控制台选择 D1 -> Backups 选择指定时间点执行 `Restore`。
- **谨慎处理**: D1 一键还原会完全覆盖当前数据库，将导致还原时间点之后的订单和余额变更全部丢失。若非全库灾难性崩溃，建议使用订正 SQL 脚本（如退款或手动轧差）进行定向人工订正。

---

## 12. 人工补单原则与流程 (Manual Compensation Audits)

因网络问题或客户端保活失效导致订单已支付但回调未成功触达时，严禁使用临时 SQL 粗暴修改 `users.token_balance`！

### 正确补单流程
1. **核对账目**: 获取 BufPay 的 `aoid`，在商户后台核对确实付款到账。
2. **走 Finalizer 闭环入账**: 运行补单脚本或调用包含签名认证 of 内部接口重放/触发 `finalizePaidOrder`：
   ```typescript
   // 必须调用包含验签及自动记账的 finalizer 模块
   await finalizePaidOrder({
     order_id,
     aoid,
     order_uid,
     price,
     pay_price,
     raw_notify_json: 'manual_reconciled'
   });
   ```
### 12.4 生产测试数据与正式用户手动修正与审计记录
- **生产正式用户余额修正绝对不能常规使用 SQL 粗暴修改**。任何直接的 `users.token_balance += X` 绕过 `token_ledger` 均属于严重账目合规问题。
- **SQL recalibrate 仅允许做为灾难/事故后的紧急处置路径**。如果必须在生产环境运行 SQL 来订正余额或轧差（如测试或试运行期间对 user_id=7 出现的并发重复加币进行手动轧差对齐），必须严格遵守以下操作协议：
  1. **先备份**: 在操作 D1 之前，必须在 Cloudflare 控制台先手动创建一个 D1 数据库快照备份。
  2. **记录操作者与原因**: 严禁匿名修改，所有订正行为必须记录详细的责任人、订正单号。
  3. **强制审计**: 必须向 `admin_audit_logs` 数据库表中插入对应的操作审计日志，说明原因和操作人，供后期财务和安全审计备查。例如：
     ```sql
     INSERT INTO admin_audit_logs (admin_email, action, target_type, target_id, details)
     VALUES ('ops@wan.lat', 'recalibrate_user_balance', 'user', '7', 'Recalibrate user 7 balance due to concurrency race condition: reset balance to 110000 tokens matching token_ledger sum.');
     ```
  4. **优先使用脚本**: 优先使用 finalizer 回调重放或专门的 reconcile 脚本进行余额轧差，禁止在不更新 `token_ledger` 的情况下单方面更新 `users.token_balance`。

---

## 13. 未验证项说明 (Unverified Scope)

以下项由于测试条件限制（如缺乏真实微信境外签约境外卡测试、实盘成本控制），未在此 PR 进行真实验证，需留待后续或人工观察：
1. **支付宝生产付款通道**: 生产环境中未对支付宝进行真实 29 元扣款验证（开发侧在 staging 验证了 0.10 元支付宝通道闭环）。
2. **高级套餐支付**: 99 元和 399 元套餐在生产环境中仅通过了创单和套餐过滤展示，未完成真实大额款项扣划实扫。
3. **Hermes 外部同步管理 (`HermesAgentManager`)**: 未在生产环境中实测外部 Hermes 同步。
