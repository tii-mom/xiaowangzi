# 小王子 SoulMate / xiaowangzi 项目 生产环境运维日报模板 (PRODUCTION_DAILY_REPORT_TEMPLATE)

值班运维人员需在每日下班前，根据生产监控看板和巡检脚本输出，填写本篇日报并同步至团队。

---

## 1. 基础数据统计 (Daily Metrics Summary)

- **汇报日期**：2026年[MM]月[DD]日  
- **值班运维**：[运维姓名]  
- **PV / UV 访问量**：[PV] / [UV] (可从 Cloudflare Web Analytics 获取)  
- **当日新增注册用户数**：[新增数] (可通过 D1 统计当日创建的 user 数)  

---

## 2. 支付订单与流水统计 (Payment Summary)

- **当日总创单数**：[创单数] 笔  
- **支付成功 (paid) 笔数**：[成功数] 笔  
- **自动匹配成功率**：[成功数 / 创单数 * 100]%  
- **累计交易额**：[金额] 元 (按 `amount_cents` 换算)  
- **挂起中 (pending) 订单数**：[挂起数] 笔  
- **已过期 (expired) 订单数**：[过期数] 笔  

---

## 3. 故障与异常记录 (Exceptions & Incidents)

- **支付异常**：
  - [ ] 无异常
  - [ ] 有异常，详情：[记录未到账、签名错误、或 WAF 拦截回调等具体案例，附带 order_id 和 aoid]
- **大模型 (DeepSeek) 异常**：
  - [ ] 无异常
  - [ ] 有异常，详情：[如 API 响应 502、对话中断、用户 Token 余额不足被拦截等]
- **Cloudflare 状态**：
  - Cloudflare 5xx 拦截次数：[数量] 次  
  - WAF 拦截回调次数：[数量] 次  

---

## 4. 数据库账本一致性核对 (D1 Balance Audit)

- **D1 账本一致性校对结果**：
  - [ ] ✅ 账本校验完全一致（所有用户 `users.token_balance` 等于 `token_ledger` 之和）
  - [ ] ❌ 发现不一致用户，详情如下：
    - 不一致用户 ID：[user_id]
    - 用户当前余额：[balance]
    - 账本流水总和：[ledger_sum]
    - 偏差值：[diff]
    - [重要：严禁手工 SQL 直接订正余额，必须走 finalizer 并将轧差记录在 audit logs 中]

---

## 5. 用户反馈与当日处理 (User Feedback & Operations Action)

- **用户反馈情况**：[记录商户/用户通过反馈入口提交的充值问题、登录问题、模型回答缓慢等]
- **当日处理动作**：[如执行人工补单并录入 admin_audit_logs、重启安卓监听设备等]
- **明日观察重点**：[如关注大额套餐创单情况、高并发下的设备延迟等]
