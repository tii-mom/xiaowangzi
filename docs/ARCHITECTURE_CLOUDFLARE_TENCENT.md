# 小王子 SoulMate — 目标架构 (Cloudflare + 腾讯云)

> **状态**: 目标架构 / 渐进迁移中  
> **最后更新**: 2026-06-04

## 架构概览

```
┌─────────────────────────────────────────────────────┐
│                  Cloudflare Workers                  │
│                  (wan.lat)                           │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Next.js UI  │  │  API Routes  │  │  D1 (REST)  │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
│                                                     │
│  • DeepSeek API 调用                                 │
│  • BufPay 支付回调 (/api/pay/notify)                 │
│  • Web session (/api/auth/web-session)               │
│  • Dashboard / Pay / Bind / Admin                    │
│  • Hermes webhook 接收 (/api/webhook/hermes)         │
└─────────────────────────┬───────────────────────────┘
                          │
                          │ webhook (带 HERMES_WEBHOOK_SECRET)
                          ▼
┌─────────────────────────────────────────────────────┐
│                  腾讯云 CVM (2G)                      │
│               (hermes.wan.lat)                       │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │              Hermes Agent                     │    │
│  │                                               │    │
│  │  • 微信机器人                                  │    │
│  │  • iLink / 扫码 / 个人号消息收发                │    │
│  │  • 长连接                                      │    │
│  │  • 向 Cloudflare webhook 转发消息               │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## 为什么这样分拆

腾讯云当前只有 2G 内存，不适合长期同时运行 Next.js + API + Hermes。

- **Cloudflare Workers** 承担无状态的 Web/API 流量，自动扩展，零运维。
- **腾讯云 CVM** 只保留 Hermes（需要长连接、微信 SDK 等 Worker 环境不支持的能力）。

## 域名规划

| 域名 | 指向 | 用途 |
|------|------|------|
| `wan.lat` | Cloudflare Workers | Web UI + API |
| `hermes.wan.lat` | 腾讯云 CVM | Hermes Agent |

## 关键设计决策

### Web MVP 不依赖 Hermes

- Web MVP（首页、Dashboard、Pay、Bind、Admin、Legal、DeepSeek 对话）完全独立于 Hermes。
- 当 Hermes 不可用时，Web MVP 仍可正常运行。
- Hermes 是 Web MVP 的**可选增强**，不是前置依赖。

### Hermes 接入是后续阶段

1. **当前阶段（PR-CF1）**: Cloudflare Workers POC，验证 Web MVP 在 Worker 环境运行。
2. **后续阶段**: Hermes 真实验证通过后，配置 `AGENT_BACKEND=hermes`，启用 Hermes webhook。

### 安全边界

- Hermes webhook 必须携带 `HERMES_WEBHOOK_SECRET`，Cloudflare 端验证签名。
- 不要在生产环境使用 MockAdapter。
- 不要绕过 `token_ledger`。

## 当前默认行为

| 配置项 | 当前值 | 说明 |
|--------|--------|------|
| Agent 后端 | `LocalAgentManager` | 默认，已验证 |
| `AGENT_BACKEND` | 未设置 | 等同于 `local` |
| Hermes 状态 | **未验证** | 不要设置 `AGENT_BACKEND=hermes` |

## 数据流（完整）

```
用户微信 → Hermes Gateway（腾讯云）
              │
              │ POST /api/webhook/hermes
              │ Header: x-webhook-signature
              ▼
         Cloudflare Workers（wan.lat）
              │
              ├─ 验证 HMAC 签名
              ├─ Session 鉴权
              ├─ Token 余额检查
              ├─ DeepSeek Chat API
              ├─ 写入 conversations
              ├─ 写入 token_ledger
              └─ 返回响应
              │
              ▼
         Hermes Gateway → 微信用户
```

## 迁移路线图

| 阶段 | 内容 | 平台 | 状态 |
|------|------|------|------|
| PR-0 ~ PR-6 | Web MVP 构建 | 腾讯云 standalone | ✅ 已完成 |
| PR-CF1 | Cloudflare Workers POC | Cloudflare Workers | 🔄 进行中 |
| PR-CF2 | D1 Binding Adapter | Cloudflare D1 | 📋 计划中 |
| 后续 | Hermes 真实验证 | 腾讯云 | 📋 计划中 |
| 后续 | 生产上线 | Cloudflare + 腾讯云 | 📋 计划中 |

## 相关文档

- Cloudflare 部署详情: `docs/CLOUDFLARE_DEPLOYMENT.md`
- 腾讯云部署（备用）: `docs/DEPLOYMENT.md`
- 数据库设计: `docs/DATABASE.md`
- Agent 管理: `docs/AGENT_MANAGER.md`
- 现有架构文档: `docs/ARCHITECTURE.md`
