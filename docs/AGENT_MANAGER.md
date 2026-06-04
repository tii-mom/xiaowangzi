# Agent Manager — 子 Agent 抽象层

## 概述

`lib/agent-manager.ts` 提供统一的子 Agent 管理接口，目前有两个实现：

| Adapter | 状态 | 说明 |
|---------|------|------|
| **LocalAgentManager** | ✅ 默认使用 | 本地 namespace 隔离，不依赖 Hermes |
| **HermesAgentManager** | ❌ 未验证 | skeleton，待 Hermes 验证后启用 |

## 接口

```typescript
interface AgentManager {
  createUserAgent(userId): Promise<AgentResult>    // 创建/获取用户 agent
  getUserAgent(userId): Promise<AgentResult|null>  // 查询用户 agent
  resetUserAgent(userId): Promise<AgentResult>     // 重置用户 agent
}
```

## LocalAgentManager

- 在 `user_agents` 表中创建记录：`agent_name = local-user-{userId}`, `status = 'active'`
- 不调用任何外部服务
- Web MVP 当前默认使用
- 保证一个用户只有一个 `pending/active` 的 agent 记录

## HermesAgentManager

- skeleton 实现，所有方法均 throw 明确错误
- 只有当 `HERMES_BASE_URL` + `HERMES_API_KEY` 配置且 `AGENT_BACKEND=hermes` 时才尝试使用
- Hermes 子 Agent 创建 API 未验证
- 未来 Hermes 验证通过后，在此实现真实调用

## 切换方式

- 默认: `LocalAgentManager`
- 设置 `AGENT_BACKEND=hermes` 切换到 `HermesAgentManager`

## Web MVP 依赖

Web MVP 的所有对话、绑定、子 Agent 功能基于 `LocalAgentManager` 实现，不依赖 Hermes。未来 Hermes 接通后，可以通过环境变量切换。

## 绑定成功后的 Agent 创建

`/api/webhook/hermes` 在绑定成功时通过 `getAgentManager().createUserAgent(userId)` 创建本地 agent。
