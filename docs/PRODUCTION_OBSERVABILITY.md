# 小王子 SoulMate / xiaowangzi 项目 生产环境观测与上线运维规范 (PRODUCTION_OBSERVABILITY)

本规范定义了项目进入生产观察期后的每日巡检流程、设备保活要求、挂起订单对账审计机制以及生产环境已知未验证范围。

---

## 1. 每日运维巡检清单 (Daily Checklist)

值班运维人员每日上午 10:00 前必须完成以下例行巡检并填写日报：

1. **服务健康性巡检**：运行 `npm run check:health` 自动检查 `https://wan.lat` 各核心公开路由可用性。
2. **D1 状态巡检**：运行 `npm run check:d1` 检查最近 20 笔订单状态、是否存在 pending 堆积以及账本一致性校对。
3. **安全与日志审查**：登录 Cloudflare Dashboard，审查 Workers Logs 及 WAF 安全防护拦截日志，核对 `/api/pay/notify` 路径是否有正常的回调入栈，无 5xx 错误。
4. **App 状态确认**：登录 BufPay 控制台或运行查询确认 BufPay Android 监听 App 设备心跳是否在 5 分钟内上报，App 在线状态为“在线”。

---

## 2. BufPay Android 监听 App 设备保活与状态要求 (Keepalive Guidelines)

自动匹配系统的核心在于 BufPay Android 监听 App 的通知监听能力，请严格确保监听设备符合以下配置规范：

- **硬件保障**：监听设备必须常年插电（保持恒定电源供应），且连接稳定的无线网络（有条件的优先采用有线网络或独享宽带）。
- **运行要求**：BufPay Android 监听 App 必须保持在前台/前台服务运行，**严禁手动关闭后台或划掉进程**。
- **通知权限**：确保微信和支付宝的“允许通知”和“锁屏显示通知”权限开启，且微信/支付宝未在 PC 端登录（PC 端登录通常会阻断手机通知栏推送）。
- **系统设置**：
  1. 开启“无障碍服务”或“通知读取权限”（取决于客户端监听模式）。
  2. 将 App 加入系统“电池优化白名单”（忽略电池优化）。
  3. 开启 App 的“自启动”与“后台关联启动”权限，防止系统低内存强杀。

---

## 3. 支付挂起 (Pending) 订单处理原则与人工补单流程 (Pending Reconcile Flow)

当订单创建 5 分钟后依然处于 `pending` 状态时，属于异常状态，运维人员应按以下顺序进行排查，**严禁直接使用 SQL 修改 users.token_balance 余额**。

```
[排查步骤]
1. 查看 BufPay 官方商户后台 -> 核对对应订单 ID 是否存在已支付的真实资金流入。
2. 若已支付，但云端 payment_orders 表为 pending -> 说明 Webhook 回调丢失或被 WAF 阻断。
3. 检查 Cloudflare system_events，核查是否有该 order_id 相关的 notify 错误事件。
4. 执行补单 SOP，通过 Finalizer 事务模块或重放 Webhook 完成入账与记账一致性。
```

### 3.1 财务轧差与审计规范
- 补单操作必须生成一条 `type = purchase` 且包含 `source_id = {order_id}` 的 `token_ledger` 记账。
- 所有手动干预记录（如冲正或轧差）必须由操作员在 `admin_audit_logs` 数据库中录入审计日志备查：
  ```sql
  INSERT INTO admin_audit_logs (admin_email, action, target_type, target_id, details)
  VALUES ('ops@wan.lat', 'manual_reconcile', 'order', 'wxz_order_123456', 'Manual reconciliation for order because BufPay callback failed due to timeout.');
  ```

---

## 4. D1 巡检常用 SQL 命令清单 (D1 Maintenance Queries)

```bash
# 1. 快速检查账本不一致用户 (Ledger Mismatch Audit)
npx wrangler d1 execute xiaowangzi-production --remote --command "SELECT u.id, u.nickname, u.token_balance, SUM(l.delta_tokens) as ledger_sum FROM users u JOIN token_ledger l ON u.id = l.user_id GROUP BY u.id HAVING u.token_balance != ledger_sum;"

# 2. 查看最近 5 笔被管理员干预或更正的审计日志
npx wrangler d1 execute xiaowangzi-production --remote --command "SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 5;"

# 3. 统计各种支付状态 of 订单总数
npx wrangler d1 execute xiaowangzi-production --remote --command "SELECT status, COUNT(*) FROM payment_orders GROUP BY status;"
```

---

## 5. 云端接口与第三方服务观察点 (Cloud Service Watchpoints)

- **Cloudflare Workers & WAF**：主要观察 WAF 规则是否将正常的 notify webhooks 判定为爬虫。在 WAF 规则中设置对 `/api/pay/notify` 的 Bypass 放行。
- **DeepSeek 路由观察**：观察 `/api/chat/send` 调用的报错日志。确保生产用 `DEEPSEEK_MODEL = deepseek-v4-flash` 返回正常，扣费与 ledger 一致。
- **Admin Overview 板块**：管理员接口 `/api/admin/overview` 必须定期核对 `users_count`、订单转化率与大模型总消耗代币数。

---

## 6. 用户反馈入口与响应建议 (User Feedback)

- 生产环境中建议保留静态的商户/客服联系邮箱（如 `support@wan.lat`）或微信服务号二维码，建立快速响应群聊。
- 用户反馈扣费异常或余额未增加时，客服必须先在 D1 获取用户的 `user_id`，核对其 `token_ledger` 流水，再进行反馈。

---

## 7. 生产环境已知未验证与受限范围 (Unverified Scope)

以下模块在当前阶段未经验证或不予开放上线，值班运维与产品人员需知悉：

1. **支付宝生产实付验证**：支付宝支付通道在生产环境仅完成了创单测试，尚未进行真实实扣付款对账（微信 29.00 元已完成实付款闭环）。
2. **大额正式套餐支付**：99 元（星球成长版）和 399 元（玫瑰星云版）套餐仅完成创单和过滤校验，未执行大额真付款实扫。
3. **外部系统同步 (Hermes)**：Agent 数据外部同步在生产环境未接入，配置中 `AGENT_BACKEND` 必须留空或保留默认值，**禁止开启 hermes 同步**。
4. **钱包与充值 (Wallet)**：自由钱包余额充值及自主消费功能暂未上线。
5. **直连免签 (SelfPay)**：微信/支付宝个人直连通道在此阶段不予提供。
