# 数据库选择与原因

## 选择: Cloudflare D1

### 原因

1. **零运维成本**: D1 是 Cloudflare 的 serverless SQLite 数据库，无需管理服务器、备份、扩展。
2. **SQLite 兼容**: 语法标准，migration 可直接用 SQL 文件，本地开发可 mock。
3. **个人项目友好**: 免费额度足以覆盖初期运营（5GB 存储 / 100 万次读 / 月）。
4. **全球边缘**: 数据靠近用户，读取延迟低。
5. **REST API**: 可从任意环境（Next.js server, 本地脚本）访问，不依赖 Workers。

### 替代方案对比

| 数据库 | 优点 | 缺点 |
|--------|------|------|
| **Cloudflare D1** | 免费额度大、SQLite 兼容、serverless | 生态新、工具链不如 PG 成熟 |
| **Turso** | SQLite 兼容、多区域 | 免费额度有限、需额外服务 |
| **Supabase (PG)** | 功能全、生态成熟 | 免费额度有限、连接池管理复杂 |
| **PlanetScale (MySQL)** | 分支开发体验好 | 已关闭免费计划 |
| **腾讯云 MySQL** | 与服务器同区、延迟低 | 需运维、有月费 |

### 结论

D1 是最适合个人开发者的选择。如果后续规模增长需要更强的事务支持或全文搜索，可迁移至 Turso 或 Supabase。

## 未验证项

以下能力在本地开发环境中**未实际验证**，标记为待上线验证：

| 项目 | 说明 | 验证计划 |
|------|------|----------|
| D1 REST API 真实查询 | 本地使用 MockAdapter，D1 REST API 调用链路未测试 | PR-4/PR-7 部署后验证 |
| D1 migration 执行 | `migrations/0001_init.sql` 语法正确但未在真实 D1 实例上执行 | PR-7 上线前通过 wrangler CLI 执行 |
| D1 REST API 限流 | 免费计划有 1000次/分钟限制，当前未做重试逻辑 | 接入真实 D1 后视情况添加 |
| 数据库备份脚本 | `scripts/backup-db.sh` 待 PR-7 实现 | PR-7 |

## 数据模型说明

详见 `migrations/0001_init.sql`，共 10 张表：

| 表名 | 用途 | 关键约束 |
|------|------|----------|
| `users` | 用户主表 | `hermes_user_id` UNIQUE, `wechat_external_id` UNIQUE（均允许为空） |
| `auth_sessions` | 登录态 | `token` UNIQUE |
| `bind_codes` | 微信绑定配对码 | `code` UNIQUE, `status` CHECK |
| `subscriptions` | 用户订阅 | `plan` CHECK, `status` CHECK |
| `token_ledger` | Token 账本 | `type` CHECK, 完整追踪余额变化 |
| `payment_orders` | 支付订单 | `order_id` UNIQUE, `status` CHECK |
| `user_agents` | 用户子 Agent | `status` CHECK |
| `conversations` | 对话记录 | `role` CHECK |
| `system_events` | 系统事件日志 | -- |
| `admin_audit_logs` | 管理员操作审计 | -- |

## 金额处理

所有金额字段统一使用 `INTEGER` 存储**分（cents）**，不使用 DECIMAL/FLOAT。

示例：
- ￥29.00 → `amount_cents = 2900`
- ￥99.00 → `amount_cents = 9900`

## lib/db.ts 适配层

- `DatabaseAdapter` 接口：定义 `query`, `execute`, `batch` 三个方法
- `D1RestAdapter`: 通过 Cloudflare D1 REST API 真实查询
- `MockAdapter`: 内存模拟，本地开发用
- `createDatabaseAdapter()`: 根据环境变量自动选择
- 若 `CLOUDFLARE_*` 三变量任一缺失，自动降级为 `MockAdapter`
