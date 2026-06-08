# Launch Acceptance Checklist (上线验收检查清单)

本清单用于对 `PR-CF6: Launch acceptance and operations handoff` 阶段的上线前状态进行最终盘点和确认。

---

## 1. Domain (域名配置)
- [x] 主域名 `wan.lat` 成功绑定到 Workers 生产环境并验证通过。
- [x] `https://wan.lat` 响应状态码为 `200 OK`。
- [x] 子域名 `www.wan.lat` 状态确认：暂未配置 Cloudflare CNAME 记录，后续应由运维补充 301 重定向规则至 `https://wan.lat`。

## 2. Cloudflare Deploy (部署确认)
- [x] 最新 `main` 分支代码已重新编译打包（`npm run lint && npm run cf:build` 通过）。
- [x] 成功部署至 Cloudflare Workers 生产环境（Latest Version ID: `ad3e258c-58f2-4b28-ae6c-65a1239244a8`）。

## 3. D1 (生产数据库)
- [x] 独立生产数据库 `xiaowangzi-production` 已激活。
- [x] `0001` - `0006` 结构迁移应全部应用完毕，包含 Agent Profile/Core Document/Binding 与 Hermes 消息去重表。
- [x] 远程 D1 表结构验证通过：基础 10 张业务表 + PR-HERMES1/2 新增表与字段完整存在。

## 4. Secrets (敏感密钥)
- [x] 所有必需生产 Secret 已在 Cloudflare 后台配置完毕（`SESSION_SECRET`, `ADMIN_TOKEN`, `DEEPSEEK_API_KEY`, `HERMES_WEBHOOK_SECRET`, `BUFPAY_AID`, `BUFPAY_APP_SECRET`）。
- [x] 无任何明文敏感密钥泄露至 PR、日志或配置文件。

## 5. WAF (网络安全放行)
- [x] 在 Cloudflare Zones 配置了放行防护的 Skip 规则，解除 Bot Fight 与安全级别校验。
- [x] 限制条件确认：仅放行 `/api/pay/notify` 路径，未关闭全站 WAF，保障系统核心安全。

## 6. Smoke Test (冒烟测试)
- [x] 运行本地 Smoke Test 套件（`scripts/test-e2e-smoke.ts`）针对 `https://wan.lat` 顺利跑通全部验证项。

## 7. Pay Page (支付套餐展示)
- [x] 确认 `/pay` 页面仅呈现正式套餐：月光陪伴版 (29元)、星球成长版 (99元)、玫瑰星云版 (399元)。
- [x] 确认已排除了 `free_trial` 与 `staging_test_10c` 的渲染。
- [x] 确认没有展示 Wallet / Balance 入口。

## 8. BufPay Notify (回调防重)
- [x] 确认生产环境 `BUFPAY_AMOUNT_TOLERANCE_CENTS = 0` (从严为 0 元)。
- [x] 确认 `BUFPAY_NOTIFY_URL = https://wan.lat/api/pay/notify`。
- [x] 确认 `BUFPAY_RETURN_URL = https://wan.lat/dashboard`。
- [x] 验证高并发防重机制：使用 D1 batch 事务机制对 `token_ledger` 唯一性做原子处理，并在本地使用 `scripts/test-payment-idempotency-race.ts` 跑通 10 次并发 notify 防重及 replay 验证。

## 9. DeepSeek (大模型对话)
- [x] 实盘大模型路由（`deepseek-v4-flash`）测试通过：
  - 成功接收并返回 Assistant 真实 reply (`"B612"`)。
  - Token 消耗被精确记入 `token_ledger` (`delta_tokens = -476`)。
  - 扣划后的余额被安全记录，`conversations` 表正确生成对话纪录。

## 10. Admin (管理员概览)
- [x] 使用轮换后的 `ADMIN_TOKEN` 鉴权，`GET https://wan.lat/api/admin/overview` 正常访问响应 `200` 并拉取业务看板信息。

## 11. Rollback (灾备回滚)
- [x] 代码回滚方案已在 Runbook 中记录（使用 wrangler / dashboard rollback 快速秒回退）。
- [x] D1 数据库备份还原机制已确认（结合小时/日度 snapshot 执行）。

## 12. Manual Compensation SOP (人工补单规程)
- [x] 严禁使用 SQL 粗暴订正 `users.token_balance`，必须通过 finalizer 机制或专门的轧差修正脚本处理。
- [x] 任何测试订正（如对 user 7 进行的轧差）均需通过 `admin_audit_logs` 审计上报，已记录归档。

## 13. Known Unverified Items (已知未验证/未上线范围)
- [ ] 支付宝生产真实付款通道未进行实扫扣款（Staging 已通过 0.10 元通道闭环校验）。
- [ ] 微信 29 元生产实扫状态需以最新运营付款凭证再次确认；若无凭证，不得仅凭 staging 0.10 元测试标记为生产已实扫。
- [ ] 99 元与 399 元大额正式套餐未执行实扫扣款。
- [ ] `HermesAgentManager` 外部同步在生产环境未实测。
- [ ] Wallet（钱包余额充值及消费）未上线。
- [ ] SelfPay（自有微信/支付宝直连）未上线。

---

## 14. Go / No-Go Decision

### 验收结论
> **Production domain readiness verified，等待验收。**
> 是否建议正式上线由验收后决定。
