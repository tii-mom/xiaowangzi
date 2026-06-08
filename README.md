# 小王子 SoulMate / xiaowangzi

小王子 SoulMate 是一个微信陪伴 AI 的 Web MVP。当前主线运行在 Cloudflare Workers + D1 上，Web 端已覆盖登录会话、免费 token、DeepSeek 对话、BufPay 支付、Dashboard、绑定状态、Admin 只读看板和生产巡检脚本。

## 当前状态

- Web/API 主线：Cloudflare Workers + Next.js App Router。
- 数据库：Cloudflare D1，已包含 Agent Profile、Core Document、Agent Binding、Hermes message 去重等 PR-HERMES2 结构。
- AI：DeepSeek `deepseek-v4-flash`，按接口返回的 `usage.total_tokens` 记账扣费。
- 支付：BufPay 创单、回调验签、finalizer 入账、防重复回调。
- Hermes / Clawbot：Cloudflare 侧已支持 Clawbot 网页扫码绑定 ticket/callback，以及 `/api/bot/clawbot/ingest` 普通聊天扣费闭环；腾讯云 Clawbot bridge 仍需真实微信扫码事件验收后灰度开放。
- Growth Journey：已支持 3 分钟 Z-27 进化地图、每日微行动、晚间复盘、成长记忆注入和公开脱敏分享卡。

生产环境不要设置 `AGENT_BACKEND=hermes`，直到 Hermes 普通消息链路在 staging 完整验收。

## 本地运行

```bash
npm install
npm run dev
```

本地没有 D1 配置时会使用 MockAdapter。生产环境禁止 MockAdapter，必须使用 Cloudflare D1 binding 或 D1 REST 凭据。

## 常用命令

```bash
npm run lint
npm run build
npm run cf:build
npm run cf:preview
npm run cf:deploy
npm run check:health
npm run check:d1
```

## 回归脚本

```bash
npx tsx scripts/test-e2e-smoke.ts
npx tsx scripts/test-chat-usage.ts
npx tsx scripts/test-user-dashboard.ts
npx tsx scripts/test-growth-journey.ts
npx tsx scripts/test-growth-share.ts
```

需要 staging/remote D1 或真实第三方密钥的脚本必须显式提供环境变量。生产写入型测试带有 `ALLOW_PRODUCTION_*` 安全开关，默认不要运行。

## 关键文档

- `docs/ARCHITECTURE.md`：目标架构和模块边界。
- `docs/CLOUDFLARE_DEPLOYMENT.md`：Cloudflare Workers/D1 部署和 staging 支付联调记录。
- `docs/HERMES_AGENT_ARCHITECTURE.md`：Hermes 分阶段路线图。
- `docs/HERMES_BINDING_FLOW.md`：Clawbot 网页扫码绑定与普通聊天 webhook 协议。
- `docs/HERMES_GATEWAY_DEPLOYMENT.md`：腾讯云 Hermes / Clawbot bridge 部署说明。
- `docs/LAUNCH_ACCEPTANCE_CHECKLIST.md`：生产上线验收清单。
- `docs/PRODUCTION_RUNBOOK.md`：生产运维和补单规范。
