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

## 绑定流程设计

### 当前主线: Clawbot 网页扫码绑定

```
1. 用户访问网页 /bind → 生成 claw_* ticket
2. 用户打开 Clawbot 绑定页并按页面提示扫码确认
3. Clawbot bridge 回调 /api/bot/clawbot/bind-callback
4. 后端校验 HMAC、消费 ticket
5. 后端写入 `agent_bindings(channel='wechat', external_id=providerUserId)` 完成绑定
```

### 冻结旧方案: 发送一次性配对码到微信

该路径已废弃，不作为 Hermes / Clawbot 发布门禁。用户不能通过向微信发送 8 位绑定码完成绑定。

## Webhook 安全策略

- `HERMES_WEBHOOK_SECRET` 环境变量用于 webhook 认证
- 普通消息校验方式：`x-hermes-secret` header
- Clawbot 绑定 callback 校验方式：`x-clawbot-timestamp` + `x-clawbot-nonce` + `x-clawbot-signature`
- **production 环境**: 如果 `HERMES_WEBHOOK_SECRET` 未配置，webhook 返回 403，拒绝所有请求
- **development/test 环境**: secret 未配置时写 console.warn，接受所有请求
- secret 不输出到日志
- 绑定 ticket 使用：条件 UPDATE `WHERE status='pending'` + changes 检查，防止并发重复绑定

```
1. 后端调 Hermes API 生成绑定二维码
2. 用户微信扫码
3. Hermes 自动完成绑定并回调 webhook
```

## 当前实现状态

| 组件 | 状态 | 说明 |
|------|------|------|
| `scripts/hermes-healthcheck.ts` | ✅ 已实现 | 检查 Hermes 服务可达性 |
| `POST /api/bot/clawbot/bind-ticket` | ✅ 已实现 | 生成 Clawbot 绑定 ticket |
| `GET /api/bind/status` | ✅ 已实现 | 查询绑定状态 |
| `POST /api/webhook/hermes` | ✅ 已实现 | 接收 Hermes 回调 |
| `lib/bind.ts` | ✅ 已实现 | 绑定 ticket 生成工具 |

## 待 Hermes 配置后的验证步骤

1. 设置 `HERMES_BASE_URL` 指向真实 Hermes 实例
2. 设置 `HERMES_API_KEY` 
3. 运行 `npx tsx scripts/hermes-healthcheck.ts` 验证
4. 测试 Clawbot ticket 生成和 bind-callback 回调
5. 验证消息收发

## 限制与已知问题

- Hermes Agent 的具体产品形态未知（开源项目/商业平台/自建？）
- 如果 Hermes 不支持原生子 Agent，将使用主 Agent + user_id namespace 隔离
- 所有 Hermes 相关功能标记为 POC，未上线
