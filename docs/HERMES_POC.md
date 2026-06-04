# Hermes POC — 集成验证报告

## 概述

Hermes Agent 是微信 Bot 消息网关，负责：
- 微信消息收发
- 用户身份识别（绑定/解绑）
- Webhook 回调
- 子 Agent 管理

## 已验证项

| 项目 | 状态 | 说明 |
|------|------|------|
| HERMES_BASE_URL 可达性 | ❌ 未验证 | 未配置真实 Hermes 实例 |
| HERMES_API_KEY 可用性 | ❌ 未验证 | 未配置 |
| 一次性配对码生成 | ❌ 未验证 | 不确定原生是否支持 |
| iLink / 扫码绑定 | ❌ 未验证 | 不确定原生是否支持 |
| Webhook 回调 | ❌ 未验证 | 不确定是否支持自定义通知 |
| 子 Agent 创建 | ❌ 未验证 | 不确定原生 API 是否暴露 |
| Token 使用量读取 | ❌ 未验证 | 不确定 |
| 消息发送测试 | ❌ 未验证 | 未连接真实微信账号 |

## 假设的 Hermes 能力（待验证）

基于环境和常见微信 Bot 平台推断：

1. **REST API**: `HERMES_BASE_URL` 提供 HTTP API
2. **认证**: `HERMES_API_KEY` 作为 Bearer Token
3. **Webhook**: `HERMES_WEBHOOK_SECRET` 用于签名验证
4. **用户绑定**: 平台可能支持一次性配对码或扫码绑定
5. **子 Agent**: 可能支持创建独立 Agent 实例

## 绑定流程设计（待 Hermes 验证后启用）

### 方案 A: 一次性配对码（当前实现）

```
1. 用户访问网页 → 生成 bind_code
2. 用户添加固定微信小王子账号为好友
3. 用户发送 bind_code 到微信
4. Hermes webhook 接收消息 → 通知后端
5. 后端完成 user ↔ hermes_user_id 绑定
```

### 方案 B: iLink / 微信开放平台（如 Hermes 原生支持）

## Webhook 安全策略

- `HERMES_WEBHOOK_SECRET` 环境变量用于 webhook 认证
- 校验方式：`x-hermes-secret` header 或 `Authorization: Bearer <secret>`
- **production 环境**: 如果 `HERMES_WEBHOOK_SECRET` 未配置，webhook 返回 403，拒绝所有请求
- **development/test 环境**: secret 未配置时写 console.warn，接受所有请求
- secret 不输出到日志
- 绑定码使用：条件 UPDATE `WHERE status='pending'` + changes 检查，防止并发重复绑定

```
1. 后端调 Hermes API 生成绑定二维码
2. 用户微信扫码
3. Hermes 自动完成绑定并回调 webhook
```

## 当前实现状态

| 组件 | 状态 | 说明 |
|------|------|------|
| `scripts/hermes-healthcheck.ts` | ✅ 已实现 | 检查 Hermes 服务可达性 |
| `POST /api/bind/create-code` | ✅ 已实现 | 生成绑定码 |
| `GET /api/bind/status` | ✅ 已实现 | 查询绑定状态 |
| `POST /api/webhook/hermes` | ✅ 已实现 | 接收 Hermes 回调 |
| `lib/bind.ts` | ✅ 已实现 | 绑定码生成/验证工具 |

## 待 Hermes 配置后的验证步骤

1. 设置 `HERMES_BASE_URL` 指向真实 Hermes 实例
2. 设置 `HERMES_API_KEY` 
3. 运行 `npx tsx scripts/hermes-healthcheck.ts` 验证
4. 测试 bind-code 生成和 webhook 回调
5. 验证消息收发

## 限制与已知问题

- Hermes Agent 的具体产品形态未知（开源项目/商业平台/自建？）
- 如果 Hermes 不支持原生子 Agent，将使用主 Agent + user_id namespace 隔离
- 所有 Hermes 相关功能标记为 POC，未上线
