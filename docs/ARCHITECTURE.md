# 小王子 SoulMate — 目标架构

## 概览

- **Web 框架**: Next.js 15+ (App Router) 部署于腾讯云服务器
- **AI 对话模型**: DeepSeek v4 flash (deepseek-v4-flash)
- **支付**: BufPay 个人支付网关
- **数据库**: Cloudflare D1 (通过 REST API 或适配器访问)
- **消息网关**: Hermes Agent (微信消息收发、子 Agent 管理)
- **Token 账本**: 自建 token_ledger 表，基于 DeepSeek 返回的 `usage` 精确扣费

## 核心数据流

```
用户微信 → Hermes Gateway → Webhook → Next.js API
                                      ↓
                              鉴权 / 路由 / Token 检查
                                      ↓
                              DeepSeek Chat API
                                      ↓
                              写入 conversations + token_ledger
                                      ↓
                              返回消息 → Hermes → 微信
```

## 部署拓扑

```
[腾讯云 CVM]
  ├── Nginx (反向代理 + SSL)
  ├── Next.js standalone (PM2)
  └── 静态资源

[Cloudflare D1]
  └── REST API 访问

[外部服务]
  ├── api.deepseek.com (DeepSeek API)
  ├── bufpay.com (支付)
  └── Hermes Agent (消息网关)
```

## 关键模块

| 模块 | 说明 | 状态 |
|------|------|------|
| 前端展示页 | Next.js App Router, Tailwind | 已完成原型 |
| /api/health | 健康检查 | PR-0 |
| 数据库层 lib/db.ts | Cloudflare D1 适配 | PR-1 |
| 支付闭环 lib/bufpay.ts | BufPay 订单/回调 | PR-2 |
| AI 对话 lib/deepseek.ts | DeepSeek API 调用 | PR-3 |
| Token 计费 | token_ledger 精确扣费 | PR-3 |
| Hermes 集成 | 微信消息、子 Agent | PR-4/PR-5 |
| 用户面板 | /dashboard, /pay, /bind | PR-6 |
| 部署上线 | PM2 + Nginx + SSL | PR-7 |

## Token 计费原则

- 禁止估算扣费，优先使用 DeepSeek API 返回的 `usage.total_tokens`
- 每次 API 调用前检查余额
- 余额不足时拦截请求，不调用 DeepSeek
- 所有 Token 变动写入 token_ledger，可完整追溯

## 安全边界

- 小王子是 AI 陪伴角色，非临床治疗工具
- 遇到自伤、自杀、严重危机时，引导现实求助
- 用户数据隔离：每个用户独立子 Agent，上下文不串
