# 上线运营检查清单

本文档用于记录 `xiaowangzi` 项目上线前后的基础运营检查项，避免发布时遗漏关键步骤。

## 1. 环境变量

上线前确认以下环境变量已在生产环境配置完成：

- `ADMIN_TOKEN`
- `CHAT_MIN_TOKEN_BALANCE`
- `CHAT_MIN_TOKEN_TOLERANCE`
- 支付回调相关密钥
- 数据库连接信息
- AI 服务 Provider / API Key

## 2. 构建与基础验证

发布前执行：

```bash
npm run build
```

确认构建通过，并检查生产路由、法律页面、健康检查接口是否可访问。

## 3. 核心链路 Smoke Test

发布后至少验证以下链路：

1. Web session 初始化
2. 用户信息读取：`user/me`
3. Token 余额读取：`user/tokens`
4. 订单读取：`user/orders`
5. 对话发送：`chat/send`
6. 法律页面：`/legal/privacy`、`/legal/terms`
7. 健康检查：`/api/health`

如果环境允许，运行：

```bash
npx tsx scripts/test-e2e-smoke.ts
```

## 4. 支付与扣费

上线前确认：

- 支付创建订单成功
- 支付回调签名校验成功
- 支付完成后 Token 正确入账
- 对话发送时 Token 正确扣减
- 余额不足时返回明确错误

## 5. 运营与合规

上线前确认：

- 页脚法律链接指向真实页面
- 隐私政策与用户协议可访问
- AI 内容说明清晰可见
- 不再展示 mock 对话或模拟扣费结果

## 6. 回滚预案

发布前记录：

- 当前生产版本 commit SHA
- 数据库迁移是否可回滚
- 环境变量变更记录
- 回滚命令或平台操作路径

## 7. 发布后观察

发布后重点观察：

- 错误日志
- 支付回调失败率
- AI 服务失败率和延迟
- Token 扣费异常
- 用户登录/session 异常
