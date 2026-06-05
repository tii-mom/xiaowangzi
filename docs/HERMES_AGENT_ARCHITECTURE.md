# Hermes / Agent 架构审计与实施计划报告 (HERMES_AGENT_ARCHITECTURE)

本报告针对 `xiaowangzi` (小王子) 微信陪伴机器人系统的 Hermes 消息网关与“每用户一个 Agent”的系统架构进行审计，并定义后续实施的生产级设计和 PR 路线图。

> [!IMPORTANT]
> **当前状态警示**：Hermes 微信机器人网关当前未上线，且在没有完整通过 staging 联调和安全防护审查前，生产环境变量 **`AGENT_BACKEND=hermes` 保持禁止设置状态**。

---

## 1. 现有代码审计与现状评估 (Code Audit)

### 1.1 文件及模块现状检查

* **`docs/HERMES_POC.md`**：记录了前期针对 Hermes 集成的一些假设（如 REST API 验证、Webhook 签名鉴权），目前所有实际连接和通信通道均为 **未验证 (Mock)** 状态。
* **`app/api/webhook/hermes/route.ts`**：实现了基础的 Webhook 接收端逻辑，具备了针对 `HERMES_WEBHOOK_SECRET` 的签名校验及简单的一次性绑定码解析（通过正则 `/^[A-F0-9]{8}$/` 匹配），并在 pending 期限内通过 D1 锁定绑定状态，同时会在绑定成功后触发 `getAgentManager().createUserAgent(userId)`。
* **`app/api/bind/create-code/route.ts` & `status/route.ts`**：
  * `create-code`：在 D1 中为已登录的 Web 用户生成唯一的、限时 15 分钟失效的一次性 pending 绑定码。
  * `status`：返回用户的微信绑定状态（`is_bound`，判断 `hermes_user_id` 或 `wechat_external_id` 是否存在）。
* **`/bind` 页面与 BindFlowMock**：前端已经完成了微信绑定二维码指引、绑定状态轮询交互，目前状态更新逻辑依赖前端 Mock 状态。
* **`lib/agent-manager.ts`**：
  * 包含 `LocalAgentManager`：Web MVP 默认在 D1 数据库中创建 `status = 'active'` 的本地 Agent 代理占位行（`local-user-${userId}`），用于支持 Web Chat。
  * 包含 `HermesAgentManager`：仅包含 skeleton 架构，凡是调用均会直接 `throw new Error` 提示未验证，防止在开发环境误用。
* **数据库表设计状况**：
  * `users`：包含了 `hermes_user_id` 和 `wechat_external_id`，用于绑定微信。
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
| **缺失能力** | **微信消息幂等校验**（微信重试可能导致 D1 账本重复扣费）；**渠道分流**（`conversations` 无法分类）；**Agent 核心文档的装配与 Admin 后台更新架构**。 |
| **Blocker 阻碍项** | 微信 Bot 协议长连接未跑通；未冻结的每用户 Agent / 核心文档 D1 Schema。 |
| **安全风险** | 1. 微信个人号极易因触发高频回复被官方判定为 Bot 进而封号；<br>2. 腾讯云 Hermes 实例如果直接持有 DeepSeek API Key 或直连 D1，将面临极大的信息安全和秘钥泄露风险（Hermes 必须定位为**无状态无秘钥网关**）。 |
| **Web MVP 边界** | **Cloudflare 端** 承担全部大脑控制（大模型调用、核心文档拼接、D1 账本计费与存储）；**腾讯云 Hermes 端** 仅作为长连接网络通道，只负责接收/呈现微信消息。 |

---

## 2. 核心架构关键问题回答 (Key Q&A)

1. **当前是否真正实现“每个用户一个 Agent”？**
   * **答**：没有。当前仅在 `user_agents` 中写入了一个包含用户 ID 的占位记录。本质上所有用户在后台交互时，依然是在共享同一个硬编码在代码里的全局 system prompt (`PRINCE_SYSTEM_PROMPT`)，没有任何针对用户的个性化“核心文档”装配与人设分发。
2. **当前 `user_agents` 表是否足够支撑生产？**
   * **答**：不足够。当前表缺少关联的 Profile 形象、Core Document 版本、记忆体（Memory）以及多渠道接入标识。
3. **Web Chat 当前使用的 Agent 与未来微信 Agent 是否会是同一个？**
   * **答**：是的。为了保证用户对话体验的连贯性与长期记忆的同步，两端必须共用同一个 Agent Brain 与账本。
4. **LocalAgentManager 和 HermesAgentManager 的边界是什么？**
   * **答**：原先的 HermesAgentManager 设想在 Hermes 网关侧同步镜像 Agent。**新架构决定废弃此边界**：将所有的 Agent 逻辑和状态管理收回 Cloudflare 端。因此，微信端和 Web 端统一共用 `AgentManager`，Hermes 网关保持彻底的无状态。
5. **HermesAgentManager 现在缺什么？**
   * **答**：应废弃其在网关侧生成 Agent 镜像的设计。缺的是 Cloudflare 侧统一装配核心文档、进行消息推送回调的标准 Webhook 网关客户端。
6. **每个 Agent 的“核心文档”应该存哪里？**
   * **答**：应存储在生产 D1 数据库的新建表 `agent_core_documents` 中，通过物理隔离和版本化管理规避泄露和注入。
7. **当前 prince prompt TS 常量是否只能算全局默认 prompt？**
   * **答**：是的。它是一个系统级别的全局兜底人设，用于规范最基础的性格基调与自残/自杀危机干预边界。
8. **是否需要新增核心表？**
   * **答**：需要新增 `agent_profiles`（存储不同 Agent 人设、偏好与昵称）以及 `agent_core_documents`（存储 Agent 专有核心参考文档）。至于长期记忆 `agent_memories` 等可在后续 PR 中以非阻塞形式追加。
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

## 5. 生产微信绑定流程设计 (WeChat Binding Flow)

```
[Web 用户]                 [Cloudflare Workers]             [Hermes (Tencent Cloud)]      [微信端]
    |                               |                                  |                     |
    | 1. 点击绑定，请求 bind_code     |                                  |                     |
    |------------------------------>|                                  |                     |
    | 2. 生成 code & 15m expires    |                                  |                     |
    |    写入 D1 status='pending'    |                                  |                     |
    |<------------------------------|                                  |                     |
    | 3. 展示 8位大写十六进制绑定码   |                                  |                     |
    |                               |                                  |                     |
    | 4. 向小王子微信公众号/个人号发送绑定码 ------------------------------------------------->|
    |                                                                  |                     |
    |                                                                  | 5. 收到消息并捕获码 |
    |                                                                  |                     |
    |                               6. POST /api/webhook/hermes        |<--------------------|
    |                                  Header: x-hermes-secret         |                     |
    |                                  Payload: { user_id, content }  |                     |
    |                               <----------------------------------|                     |
    | 7. 校验 Webhook Secret         |                                  |                     |
    | 8. 查找 pending bind_code      |                                  |                     |
    | 9. 唯一性校对 (一微信绑一用户)   |                                  |                     |
    | 10. 更新 users.hermes_user_id |                                  |                     |
    |     更新 bind_codes 为 'used'  |                                  |                     |
    |     写入 system_events         |                                  |                     |
    | 11. 返回 { ok: true } -------->|                                  |                     |
    |                               | 12. 回显 "绑定成功，开始聊天！" ---->|                     |
    |                               |                                  |-------------------->|
    | 13. 轮询 status 检测到 is_bound|                                  |                     |
    |     自动跳转到 dashboard       |                                  |                     |
```

### 5.1 异常防御规则
* **防篡改与覆盖**：若 `users` 表对应的行已有 `hermes_user_id` 且不一致，拒绝该次绑定，避免重复绑定或将不同微信错绑到同一账号上。
* **一次性失效**：绑定码一旦使用或在 15 分钟超时后自动物理失效，且在数据库中使用 `WHERE status = 'pending'` 限制条件更新，避免高并发重放漏洞。
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
CLOUDFLARE_WEBHOOK_URL=https://wan.lat/api/pay/notify # 后续改为 /api/webhook/hermes
HERMES_PORT=3001
WECHAT_CONN_MODE=ilink # 微信通信模式
# 生产环境运行中绝对不在腾讯云端跑 Next.js 页面与 D1 数据库，保持无状态。
```

### 6.3 内存限制与 PM2 守护 (`pm2.config.js`)
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
         +--> [校验 x-hermes-secret / Bearer Token] -> 失败抛出 403
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

### 7.2 Webhook 响应数据格式
```json
{
  "ok": true,
  "reply": "你好，今天我看到了一朵漂亮的玫瑰...",
  "tokens_charged": 450,
  "remaining_balance": 99550
}
```

---

## 8. 数据库迁移方案变更建议 (Migrations)

以下为后续 PR-HERMES1 构建时拟引入的数据库 D1 变更：

1. **`conversations` 表扩充**：
   * `channel` (TEXT, 限制为 `'web'`, `'hermes'`)。
   * `external_message_id` (TEXT, 建立唯一索引以去重)。
2. **`user_agents` 表扩充**：
   * `agent_profile_id` (INTEGER REFERENCES `agent_profiles`)。
   * `core_document_id` (INTEGER REFERENCES `agent_core_documents`)。
3. **新增 `agent_profiles` 表**：人设基本描述。
4. **新增 `agent_core_documents` 表**：版本化管理人设核心参考文档。

---

## 9. 生产环境安全边界与风控限制 (Security Boundary)

* **绝对禁止事项**：
  * **在生产环境启用 `AGENT_BACKEND=hermes`**。在所有联调与压力测试未通过前，均使用 LocalAgentManager。
  * **Hermes 持有密钥**：腾讯云 Hermes 严禁持有 DeepSeek API Key 或直接读写 D1，防止被侵入后导致账目和模型密钥泄露。
  * **绕过 Webhook Secret**：Cloudflare 的 Webhook 接收端在生产环境如果未提供正确的 `HERMES_WEBHOOK_SECRET`，必须强阻断并返回 `403 Forbidden`。
* **风控防御**：
  * 微信个人号容易面临被腾讯官方封锁的风控。Hermes 必须在断线、重连和无法唤起长连接时向 `system_events` 上报异常。
  * 日志脱敏：调试日志在云端保留期统一限制在 7 天内，超时自动擦除。

---

## 10. 后续 PR 逐步推进路线图 (Roadmap)

### PR-HERMES1：Agent profile + core document schema
* **目标**：新建 `agent_profiles` 与 `agent_core_documents` 数据库表，并扩充 `conversations` 字段（`channel`, `external_message_id`）。
* **修改文件**：新增 D1 数据库迁移 SQL。
* **验收标准**：通过本地 wrangler d1 迁移，生成无损新表并验证字段。
* **不做事项**：不编写任何微信端长连接接口。

### PR-HERMES2：微信绑定生产化
* **目标**：完善 Cloudflare 端微信绑定 Webhook 校验、唯一性冲突防护与 system_events 记录。
* **修改文件**：`app/api/webhook/hermes/route.ts`。
* **验收标准**：模拟发送已绑定、不存在绑定码、绑定码过期的 mock 请求，返回对应的拦截信息。

### PR-HERMES3：腾讯云 Hermes 独立部署文档与脚本
* **目标**：编写部署至腾讯云所需的 `PM2` 配置文件、安装脚本与无状态 Gateway 目录脚手架。
* **修改文件**：新增 `hermes/*` 目录及部署运行文档。
* **验收标准**：在测试机启动 PM2 成功拉起守护进程，模拟掉线重连。

### PR-HERMES4：Hermes Webhook Staging 联调
* **目标**：打通腾讯云网关与 Cloudflare 之间的 Webhook 通道，利用 Mock 消息完成双端收发链路。
* **修改文件**：开发接口验证工具与调试工具。
* **验收标准**：在 Staging 域名成功接收并正确解析 Hermes 发来的测试消息。

### PR-HERMES5：微信消息收发 + DeepSeek + token_ledger 扣费闭环
* **目标**：合并大模型接口调用与 `token_ledger` 计费，完成最终微信端扣款闭环。
* **修改文件**：`app/api/webhook/hermes/route.ts`。
* **验收标准**：用测试微信向 Bot 发送消息，账本扣费数符合 usage 结果，重复发送被幂等忽略。

### PR-HERMES6：灰度上线与告警
* **目标**：上线微信网关，接入小部分用户并设定健康度和连接丢失预警阈值。
* **修改文件**：`docs/PRODUCTION_OBSERVABILITY.md` (增加微信部分)。
* **验收标准**：微信掉线时能在控制台及告警渠道获取相应推送。

### PR-HERMES7：Admin Agent 管理和核心文档编辑
* **目标**：在管理员控制台提供核心文档修改、审计与版本发布功能。
* **修改文件**：Admin 页面及对应的上传 API 接口。
* **验收标准**：管理员在后台可修改核心文档，操作行为在 `admin_audit_logs` 中完整体现。
