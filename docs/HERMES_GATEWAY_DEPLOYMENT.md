# Hermes / Clawbot Gateway Deployment

Hermes / Clawbot 是腾讯云上的微信消息通道层。正确绑定方式是 **Web 页面扫码 / ticket 绑定**，不是让用户向微信发送 8 位绑定码。

当前服务器上已有 `xms-clawbot-bridge`，它暴露 Clawbot 绑定入口，并把扫码确认结果回调到 Web 后端。

## 安全边界

腾讯云端只允许配置：

- Clawbot / Hermes webhook secret
- Clawbot / Hermes gateway public base URL
- 微信连接相关配置与账号状态
- PM2 运行参数

腾讯云端禁止配置：

- `DEEPSEEK_API_KEY`
- D1 / Cloudflare API Token
- `BUFPAY_AID` / `BUFPAY_APP_SECRET`
- `ADMIN_TOKEN`
- `SESSION_SECRET`

所有 Agent Profile、Core Document、DeepSeek 调用、token 扣费和 D1 写入都在 Cloudflare API 侧完成。

## 正确绑定流程

1. Web 后端为当前登录用户创建一次性 `ticket`。
2. `/bind` 页面展示 Hermes / Clawbot 网页扫码入口，例如 `https://<clawbot-host>/xms/wechat/bind?ticket=<ticket>`。
3. 用户在网页扫码授权后，Clawbot 得到微信侧 `providerUserId`。
4. Clawbot 调用 `POST /wechat/bind-confirm`，请求体包含 `ticket`、`providerUserId`、`nickname`、`avatarUrl`。
5. Clawbot bridge 使用签名头回调 Web 后端 `/api/bot/clawbot/bind-callback`。
6. Web 后端校验签名、消费 ticket，并写入 `agent_bindings`。

## Clawbot Bridge 接口

扫码确认请求：

```json
{
  "ticket": "bind_ticket_xxx",
  "providerUserId": "wechat_provider_user_id",
  "nickname": "可选昵称",
  "avatarUrl": "可选头像"
}
```

Web 后端回调需要校验签名头：

```text
x-clawbot-timestamp
x-clawbot-nonce
x-clawbot-signature
```

签名算法由 `xms-clawbot-bridge` 实现：

```text
HMAC-SHA256(secret, `${timestamp}.${nonce}.${rawBody}`)
```

## Staging 验收

1. Web 创建 session。
2. `/bind` 创建绑定 ticket。
3. Web 页面展示 Clawbot 扫码入口。
4. 用户扫码确认。
5. Clawbot bridge 回调 `/api/bot/clawbot/bind-callback`。
6. `/bind` 与 Dashboard 显示已绑定。
7. 微信普通消息链路由 Clawbot bridge 投递到 `/api/bot/clawbot/ingest`，不通过 OpenClaw adapter。

## 普通消息 ingest

Clawbot bridge 调用 Cloudflare：

```text
POST /api/bot/clawbot/ingest
x-dreamer-bridge-timestamp
x-dreamer-bridge-nonce
x-dreamer-bridge-signature
```

报文：

```json
{
  "provider": "clawbot",
  "providerUserId": "wxid_abc123",
  "content": "今天我有点难过",
  "messageId": "msg_898912781",
  "contextToken": "optional"
}
```

Cloudflare 通过 `agent_bindings(channel='wechat', external_id=providerUserId)` 定位用户，并复用共享聊天服务写入 `conversations(channel='hermes')` 和 `token_ledger`。
