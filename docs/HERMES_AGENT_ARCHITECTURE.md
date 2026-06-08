# Hermes / Agent 架构审计与实施计划报告 (HERMES_AGENT_ARCHITECTURE)

本报告针对 `xiaowangzi` (小王子) 微信陪伴机器人系统的 Hermes 消息网关与“每用户一个 Agent”的系统架构进行审计，并定义后续实施的生产级设计和 PR 路线图。

> [!IMPORTANT]
> **当前状态警示**：Hermes 微信机器人网关当前未真实上线，且在没有完整通过 staging 联调和安全防护审查前，生产环境变量 **`AGENT_BACKEND=hermes` 保持禁止设置状态**。
>
> **2026-06-08 更新**：本文早期章节中的“向微信发送 8 位绑定码”方案已废弃。当前唯一有效绑定路径是 Hermes / Clawbot 网页扫码：`POST /api/bot/clawbot/bind-ticket` 生成 `claw_*` ticket，Clawbot bridge 回调 `POST /api/bot/clawbot/bind-callback` 完成绑定。

---

## 1. 现有代码审计与现状评估 (Code Audit)

### 1.1 文件及模块现状检查

* **`docs/HERMES_POC.md`**：记录了前期针对 Hermes 集成的一些假设（如 REST API 验证、Webhook 签名鉴权），目前所有实际连接和通信通道均为 **未验证 (Mock)** 状态。
* **`app/api/webhook/hermes/route.ts`**：实现了基础的 Webhook 接收端逻辑，能够对 `HERMES_WEBHOOK_SECRET` 进行校验。目前优先使用 `x-hermes-secret` 作为校验头（向下兼容 Authorization Bearer 头）。具备基本的一次性绑定码解析（通过正则 `/^[A-F0-9]{8}$/` 匹配），并在 pending 期限内通过 D1 锁定绑定状态，同时在绑定成功后触发 `getAgentManager().createUserAgent(userId)`。
* **`app/api/bind/create-code/route.ts` & `status/route.ts`**：
  * `create-code`：在 D1 中为已登录的 Web 用户生成唯一的、限时 15 分钟失效的一次性 pending 绑定码。
  * `status`：返回用户的微信绑定状态（`status` + 兼容字段 `is_bound`），以 `agent_bindings` 的 active wechat 绑定为准。
* **`/bind` 页面与 BindFlowMock**：前端已经完成了微信绑定二维码指引、绑定状态轮询交互，目前状态更新逻辑依赖前端 Mock 状态。
* **`lib/agent-manager.ts`**：
  * 包含 `LocalAgentManager`：Web MVP 默认在 D1 数据库中创建 `status = 'active'` 的本地 Agent 代理占位行（`local-user-${userId}`），用于支持 Web Chat。
  * 包含 `HermesAgentManager`：目前仍是 skeleton 状态，任何实际调用均会直接 `throw new Error` 阻断，提醒开发者当前不可启用，保障主链路安全。
* **数据库表设计状况**：
  * `users`：仍保留 `hermes_user_id` 和 `wechat_external_id` 兼容字段；当前绑定状态以 `agent_bindings` 为准。
  * `user_agents`：存储 Agent 的基本代理关联，目前仅有 `id`, `user_id`, `agent_name`, `status` 字段。
  * `bind_codes`：包含 `code`, `user_id`, `status` (`pending`/`used`/`expired`), `expires_at`。
  * `conversations`：用于存储聊天记录，目前**缺少来源渠道分类**，无法区分 Web Chat 与微信消息。
  * `system_events` 与 `admin_audit_logs`：结构完整，已支持操作审计和系统异常记录。

### 1.2 审计结论矩阵

| 评估维度 | 详情说明 |
|:---|:---|
| **已完成能力** | Web 侧的绑定码（create-code/status）生命周期管理；本地 `user_agents` 虚拟代理占位符自动初始化；Webhook 鉴权逻辑框架。 |
| **POC 能力** | 前端 `/bind` 二维码及绑定进度轮询交互；不依赖真实网关的内存 Mock 绑定。 |
| **未验证能力** | 微信扫码/长连接状态同步；基于 `HERMES_WEBHOOK_SECRET` 的腾讯云与 Cloudflare 真实跨网段回调；消息收发及 Token 账本的并发扣费。 |
| **缺失能力** | **微信消息幂等校验**（微信重试可能导致 D1 账本重复扣费）；**渠道分流与投递日志**（`conversations` 无法分类，缺少消息递送记录）；**Agent 核心文档的装配与 Admin 后台更新架构**。 |
| **Blocker 阻碍项** | 微信 Bot 协议长连接未跑通；未冻结的每用户 Agent / 核心文档 D1 Schema。 |
| **安全风险** | 1. 微信个人号极易因触发高频回复被官方判定为 Bot 进而封号；<br>2. 腾讯云 Hermes 实例如果直接持有敏感 Key，将面临极大的信息安全和秘钥泄露风险（必须贯彻**无状态无敏感秘钥网关**原则）。 |
| **Web MVP 边界** | **Cloudflare 端** 承担全部大脑控制（大模型调用、核心文档拼接、D1 账本计费与存储）；**腾讯云 Hermes 端** 仅作为长连接网络通道，只负责接收/呈现微信消息。 |

---

## 2. 核心架构关键问题回答 (Key Q&A)

1. **当前是否真正实现“每个用户一个 Agent”？**
   * **答**：已完成 Web 主线的 Primary Agent Profile 初始化，并在 Web Chat 中装配 active Core Document 与 persona summary；微信普通消息链路仍未接入。
2. **当前 `user_agents` 表是否足够支撑生产？**
   * **答**：不足够。当前表缺少关联的 Profile 形象、Core Document 版本、记忆体（Memory）以及多渠道接入标识。
3. **Web Chat 当前使用的 Agent 与未来微信 Agent 是否会是同一个？**
   * **答**：是的。为了保证用户对话体验的连贯性与长期记忆的同步，两端必须共用同一个 Agent Brain 与账本。
4. **LocalAgentManager 和 HermesAgentManager 的边界是什么？**
   * **答**：`HermesAgentManager` 当前仍是 skeleton，绝对不能启用。短期内保留，但不能承担 Agent Brain 逻辑。后续建议将 `HermesAgentManager` 重构为 `HermesGatewayClient` / `HermesChannelAdapter` 等纯通道适配层。Agent Brain 逻辑（大模型调用、核心文档组装、D1 存储、扣费账本）将始终驻留在 Cloudflare API 侧。
5. **HermesAgentManager 现在缺什么？**
   * **答**：当前缺的是无状态的网关客户端定义，以及用于往腾讯云 Hermes 网关推送微信回复消息的通道发送接口。
6. **每个 Agent 的“核心文档”应该存哪里？**
   * **答**：应存储在生产 D1 数据库中的 `agent_core_documents` 新增表中。
7. **当前 prince prompt TS 常量是否只能算全局默认 prompt？**
   * **答**：是的。它是一个系统级别的全局兜底人设，用于规范最基础的性格基调与自残/自杀危机干预边界。
8. **是否需要新增核心表？**
   * **答**：需要新增 `agent_profiles`（存储不同 Agent 人设、偏好与昵称）以及 `agent_core_documents`（存储 Agent 专有核心参考文档）。
9. **`conversations` 是否需要增加 `channel/source` 字段？**
   * **答**：需要。应增加 `channel` 字段（`web` / `hermes`），以便细分聊天记录来源，并新增 `external_message_id` 以便支持微信重试消息的幂等去重。
10. **微信消息幂等如何做？**
    * **答**：微信服务器投递给 Hermes 的每条消息都携带唯一的 `MsgId`。Cloudflare Webhook 接收消息时，在写入 `conversations` 前以 `external_message_id` 为索引进行唯一性冲突检查（通过 D1 联合索引或 D1 事务）。若冲突，直接响应已保存的历史回复或 `200 OK`，杜绝重复调用大模型与重复计费。

---

## 3. 每用户 Agent 极简生产级设计 (Per-User Agent Design)

### 3.1 极简状态装配模型

每个用户注册后，系统默认初始化一个 Primary Agent（默认使用全局小王子基本 Prompt 版本）。当用户上传个性化核心文档或进行 Admin 后端调整时，Prompt 按照以下四层优先级由上至下在 Cloudflare 端组装：

```
+------------------------------------------------------------------+
| 1. 全局系统人设 Prompt (PRINCE_SYSTEM_PROMPT，危机拦截与付费墙提示) |
+------------------------------------------------------------------+
                                  |
                                  v
+------------------------------------------------------------------+
| 2. Agent 核心文档 (从 D1 agent_core_documents 中拉取 active 版本)   |
+------------------------------------------------------------------+
                                  |
                                  v
+------------------------------------------------------------------+
| 3. 用户上下文/长期记忆 (从 D1 提取的用户特定历史偏好)                    |
+------------------------------------------------------------------+
                                  |
                                  v
+------------------------------------------------------------------+
| 4. 会话上下文 (D1 conversations 最近 10 轮对话，带 channel 标识)   |
+------------------------------------------------------------------+
```

---

## 4. 核心文档 (Core Document) 方案设计

### 4.1 新增表 `agent_core_documents`
```sql
CREATE TABLE IF NOT EXISTS agent_core_documents (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id        INTEGER NOT NULL REFERENCES user_agents(id),
    version         INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' 
                    CHECK (status IN ('pending', 'active', 'archived')),
    content         TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_core_docs_agent_status ON agent_core_documents(agent_id, status);
```

### 4.2 运维与安全机制
* **生成策略**：在绑定时自动基于经典小王子语录库为用户生成 Version 1 作为默认 active 文档。
* **Admin 编辑与审计**：Admin 控制台支持上传新的核心文档，每次上传写入一个新 version 记录，并以 D1 事务将老版本置为 `archived`，新版本置为 `active`。该行为强制插入一条 `admin_audit_logs` 审计记录。
* **注入防护**：
  * 微信渠道仅作为“只读交互通道”，**严禁**让用户通过微信聊天指令直接或间接修改 `agent_core_documents`。
  * 仅限在经过 Web Session 认证的管理员面板和用户配置后台进行文档变更。
  * 在 D1 装配 Prompt 时，对用户输入进行安全转义，并加入人设指令防逃逸防护语段（System Prompt 隔离）。

---

## 5. 微信绑定正式化设计 (WeChat Binding Flow)

```
[Web 用户]                 [Cloudflare Workers]             [Hermes / Clawbot Bridge]      [微信端]
    |                               |                                  |                     |
    | 1. 点击绑定，请求 Clawbot ticket |                                  |                     |
    |------------------------------>|                                  |                     |
    | 2. 生成 claw_* ticket & expires|                                  |                     |
    |    写入 D1 status='pending'    |                                  |                     |
    |<------------------------------|                                  |                     |
    | 3. 展示 Clawbot bind_url       |                                  |                     |
    |                               |                                  |                     |
    | 4. 打开 bind_url 并按页面提示扫码确认 --------------------------->|
    |                                                                  | 5. 微信扫码确认      |
    |                               6. POST /api/bot/clawbot/bind-callback<--------------------|
    |                                  Header: x-clawbot-signature     |                     |
    |                                  Payload: { ticket, providerUserId }|                   |
    |                               <----------------------------------|                     |
    | 7. 校验 Clawbot HMAC           |                                  |                     |
    | 8. 查找 pending ticket         |                                  |                     |
    | 9. 唯一性校对 (一微信绑一用户)   |                                  |                     |
    | 10. 写入 agent_bindings       |                                  |                     |
    |     更新 bind_codes 为 consumed|                                  |                     |
    |     写入 system_events         |                                  |                     |
    | 11. 返回 { ok: true } -------->|                                  |                     |
    | 12. 轮询 status 检测到 bound/is_bound|                              |                     |
    |     自动跳转到 dashboard       |                                  |                     |
```

### 5.1 异常防御规则
* **防篡改与覆盖**：若 `agent_bindings` 中已存在 active wechat 绑定，则拒绝该次绑定，避免重复绑定或将不同微信错绑到同一账号上。
* **一次性失效**：Clawbot ticket 一旦使用或超时后自动失效，且在数据库中使用 `WHERE status = 'pending'` 限制条件更新，避免高并发重放漏洞。
* **解绑设计**：解绑流程暂不放在首发 MVP，后续 PR 另外单独处理。

---

## 6. Hermes 腾讯云独立部署设计 (Hermes Tencent Cloud Deployment)

### 6.1 腾讯云 Hermes 服务目录结构
```text
/opt/hermes/
├── package.json
├── package-lock.json
├── src/
│   ├── app.ts            # 服务主入口
│   ├── wechat-client.ts  # 微信协议长连接长轮询管理
│   ├── dispatcher.ts     # 消息流转调度器
│   └── crypto.ts         # 回调签名与认证逻辑
├── logs/
│   ├── app.log           # 系统运行日志
│   └── error.log         # 异常日志
├── .env                  # 腾讯云环境变量 (不含敏感秘钥)
└── pm2.config.js         # PM2 进程守护配置
```

### 6.2 环境变量清单 (`.env`)
```bash
PORT=3001
CLOUDFLARE_WEBHOOK_URL=https://wan.lat/api/webhook/hermes
HERMES_PORT=3001
WECHAT_CONN_MODE=ilink # 微信通信模式
# 生产环境运行中绝对不在腾讯云端跑 Next.js 页面与 D1 数据库，保持无状态。
```

### 6.3 秘钥与签名边界保护
* **腾讯云 Hermes 实例严禁持有以下敏感密钥**：
  * `DEEPSEEK_API_KEY` (大模型 API key)
  * `D1 / Cloudflare API Token` (数据库与 Workers 访问凭证)
  * `BUFPAY_APP_SECRET` (支付商户密钥)
  * `SESSION_SECRET` (Web会话加密密钥)
  * `ADMIN_TOKEN` (管理员口令)
* **允许持有的最小凭证**：
  * `HERMES_WEBHOOK_SECRET` (用于调用 Cloudflare `/api/webhook/hermes` 时的签名校验)

* **接口地址严正隔离**：
  * `/api/pay/notify` **仅限且只能**用于接收 BufPay 支付回调。
  * `/api/webhook/hermes` **仅限且只能**用于接收 Hermes 微信消息推送。
  * **两者绝对不能混用**。

### 6.4 内存限制与 PM2 守护 (`pm2.config.js`)
为防止 Node-Wechat 内存泄漏，设置 `max_memory_restart` 限制为 2G 强制重启：
```javascript
module.exports = {
  apps: [{
    name: 'hermes-wechat-gateway',
    script: './src/app.ts',
    max_memory_restart: '2G',
    restart_delay: 5000,
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

---

## 7. 微信消息收发完整闭环设计 (WeChat Message Loop)

### 7.1 Webhook 状态与计费机流转

```
  [微信用户发送消息]
         |
         v
  [Hermes 接收微信事件]
         |
         v
  [Hermes 发起 POST 请求至 CF /api/webhook/hermes]
         |
         +--> [校验 x-hermes-secret Header] -> 失败抛出 403
         |
         +--> [D1 唯一索引查询 external_message_id] -> 重复则直接返回 200 (幂等)
         |
         +--> [获取该微信对应的 user_id]
         |
         +--> [查询该用户的 users.token_balance 余额]
         |          |
         |          +--> (余额不足 < 10000) -----------------------------------> [CF 直接返回 200 + 充值友情提醒]
         |          |                                                                   |
         |          v                                                                   v
         +--> [组装 System + Core Doc + Conversations]                           [Hermes 发送提醒至微信]
         |          |
         |          v
         +--> [调用 DeepSeek API 产生回复]
         |          |
         |          v
         +--> [原子 D1 事务: 扣减 users.token_balance + 写入 token_ledger 流水]
         |          |
         |          v
         +--> [写入 conversations 表 (channel = 'hermes')]
         |          |
         |          v
         +--> [CF 响应 200 返回 JSON: { reply: '回复文本' }]
         |          |
         |          v
  [Hermes 接收 JSON 并渲染推送至用户微信]
```

### 7.2 Webhook 校验协议
* **统一 Header 鉴权方式**：
  * 请求必须携带 Header: `x-hermes-secret: <HERMES_WEBHOOK_SECRET>` 
  * 注：未来架构升级时可考虑逐步迁移至标准 `Authorization: Bearer <HERMES_WEBHOOK_SECRET>`，当前联调以 `x-hermes-secret` 为准。

### 7.3 Webhook 响应数据格式
```json
{
  "ok": true,
  "reply": "你好，今天我看到了一朵漂亮的玫瑰...",
  "tokens_charged": 450,
  "remaining_balance": 99550
}
```

---

## 8. 数据库迁移方案与候选表设计建议 (Migrations)

以下为后续 PR 实施推进过程中，可能引入的 D1 数据库表结构变更建议（作为候选方案，不一定在 PR-HERMES1 一次性落地）：

### 8.1 候选新增表
1. **`agent_profiles`** (Agent人设表)：存储特定的名称、头像、语调风格描述。
2. **`agent_core_documents`** (核心文档表)：存储版本化管理的用户核心参考知识库与文档。
3. **`agent_bindings`** 或 **`user_agent_bindings`**：记录 Agent 与不同渠道标识（如 Web UUID、微信开放 ID、iLink ID）的细粒度绑定映射。
4. **`hermes_messages`**：记录微信外部消息的 `message_id`、排队状态及处理状态，用于极端高并发下的防抖与幂等去重。
5. **`hermes_delivery_logs`**：记录回复消息推回微信渠道的发送日志（包含发送成功/失败、重试次数及异常报错原因）。

### 8.2 候选字段扩充
1. `conversations.channel` (区分 `'web'` / `'hermes'`)。
2. `conversations.external_message_id` (微信推送的唯一 MsgId 索引)。
3. `conversations.agent_id` (关联具体交互的 Agent 实体)。
4. `user_agents.agent_type` (代理类型描述)。
5. `user_agents.core_document_id` (关联当前处于 active 状态的核心参考文档)。
6. `bind_codes.consumed_at` (记录配对码实际被兑换消耗的时间戳)。

---

## 9. 生产环境安全边界与风控限制 (Security Boundary)

* **安全红线**：
  * **在所有 staging 测试与大模型并发回调扣费压测验证通过前，AGENT_BACKEND 保持禁用 (local) 状态**。
  * **微信个人号被动风控**：微信个人号挂机存在较高的封号风险。系统必须具备通过 `system_events` 对长连接心跳失效进行检测和报警的机制。
  * **日志留存期安全防护**：调试原始日志留存上限严格设为 7 天，定时物理擦除，防止聊天记录及用户隐私在云端留存过久。

---

## 10. 后续 PR 逐步推进路线图 (Roadmap & Gates)

### PR-HERMES1：Agent profile + core document schema [本 PR 落地]
* **目标**：建立 `agent_profiles`、`agent_core_documents` 与 `agent_bindings` 数据库表，并扩充 `conversations` 字段（`channel`, `external_message_id`等）。实现登录/会话初始化过程中的默认 Profile 与 Core Document 初始化。
* **安全门**：**绝对禁止**在生产环境设置 `AGENT_BACKEND=hermes`。
* **验收标准**：通过本地及 Staging 数据库 D1 迁移，支持 `/api/user/agent-profile` 只读数据接口，且通过 `scripts/test-agent-profile.ts` 幂等性测试。
* **回滚方式**：运行降级 SQL 迁移删除新增列与表。

### PR-HERMES2：微信绑定生产化 [本 PR 落地]
* **目标**：实现 bind_codes 生产化重构（使用 `pending/consumed/expired/revoked`CHECK）、双向一对一 active bindings 偏独特索引防重、`hermes_messages` 去重幂等及 `system_events` 脱敏审计日志。
* **安全门**：**绝对禁止**设置 `AGENT_BACKEND=hermes`。暂不接入真实微信，不消费 DeepSeek，不改变计费扣费逻辑。
* **验收标准**：通过本地及 Staging D1 迁移，支持并发与撤销测试，且 `scripts/test-hermes-binding.ts` 强外键一致性比对通过。

### PR-HERMES3：腾讯云 Hermes 独立部署文档与脚本
* **目标**：编写部署至腾讯云所需的 `PM2` 配置文件、安装脚本与无状态 Gateway 目录脚手架。
* **安全门**：**绝对禁止**设置 `AGENT_BACKEND=hermes`。
* **修改文件**：新增 `hermes/*` 目录及部署运行文档。
* **验收标准**：在测试机启动 PM2 成功拉起守护进程，模拟掉线重连。

### PR-HERMES4：Hermes Webhook Staging 联调
* **目标**：打通腾讯云网关与 Cloudflare 之间的 Webhook 通道，利用 Mock 消息完成双端收发链路。
* **安全门**：仅限在 Staging 联调环境下将 `AGENT_BACKEND` 临时设为 `hermes`，生产环境继续禁用。
* **修改文件**：开发接口验证工具与调试工具。
* **验收标准**：在 Staging 域名成功接收并正确解析 Hermes 发来的测试消息。

### PR-HERMES5：微信消息收发 + DeepSeek + token_ledger 扣费闭环
* **目标**：合并大模型接口调用与 `token_ledger` 计费，完成最终微信端扣款闭环。
* **安全门**：只有本阶段在 Staging 环境下通过全部压测及幂等扣费校验后，才允许提交 PR 并推进至 PR-HERMES6 灰度上线评估。
* **修改文件**：`app/api/webhook/hermes/route.ts`。
* **验收标准**：用测试微信向 Bot 发送消息，账本扣减数符合 usage 结果，重复发送被幂等忽略。

### PR-HERMES6：灰度上线与告警
* **目标**：灰度上线微信网关，接入小部分用户并设定健康度和连接丢失预警阈值。
* **安全门**：灰度上线前**不得对外宣称微信机器人已上线**，防止因个人微信号异常掉线导致大面积客诉。
* **修改文件**：`docs/PRODUCTION_OBSERVABILITY.md` (增加微信部分)。
* **验收标准**：微信掉线时能在控制台及告警渠道获取相应推送。

### PR-HERMES7：Admin Agent 管理和核心文档编辑
* **目标**：在管理员控制台提供核心文档修改、审计与版本发布功能。
* **修改文件**：Admin 页面及对应的上传 API 接口。
* **验收标准**：管理员在后台可修改核心文档，操作行为在 `admin_audit_logs` 中完整体现。
