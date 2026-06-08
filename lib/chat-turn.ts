import { getDb, type DatabaseAdapter } from '@/lib/db';
import { requireEnv } from '@/lib/env';
import { callDeepSeekChat, DEEPSEEK_MODEL, type ChatResult } from '@/lib/deepseek';
import { buildAgentSystemContext, ensureUserPrimaryAgentProfile } from '@/lib/agent-profile';

const DEFAULT_MAX_CONTEXT_MESSAGES = 20;

type ChatChannel = 'web' | 'hermes';

export interface ChatTurnParams {
  userId: number;
  tokenBalance: number;
  message: string;
  minTokenBalance: number;
  channel?: ChatChannel;
  externalMessageId?: string | null;
  chatCompletion?: (messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) => Promise<ChatResult>;
  threadId?: string;
}

export interface ChatTurnResult {
  status: 'ok' | 'insufficient_tokens' | 'already_processed' | 'error';
  reply?: string;
  usage?: ChatResult['usage'];
  remainingTokens?: number;
  threadId?: string;
  message?: string;
}

interface ActiveAgentProfileRow {
  id: number;
  user_agent_id: number | null;
}

export async function processUserChatTurn(
  params: ChatTurnParams,
): Promise<ChatTurnResult> {
  const channel = params.channel ?? 'web';
  const db = getDb();

  if (params.tokenBalance <= params.minTokenBalance) {
    return {
      status: 'insufficient_tokens',
      remainingTokens: params.tokenBalance,
      message: '这次小星球能量不足，请先充值后继续',
    };
  }

  await ensureUserPrimaryAgentProfile(params.userId);
  const agentProfile = await getActiveAgentProfile(db, params.userId);
  const agentContext = await buildAgentSystemContext(params.userId);
  const messages = await buildChatMessages(
    db,
    params.userId,
    withRuntimeContext(agentContext.combinedPrompt, channel),
    params.message,
  );

  const threadId = params.threadId ?? `chat_${params.userId}_${Date.now().toString(36)}`;
  if (params.externalMessageId) {
    const existingConversation = await db.query<{ thread_id: string; content: string | null }>(
      "SELECT thread_id, content FROM conversations WHERE channel = ? AND external_message_id = ? LIMIT 1",
      [channel, params.externalMessageId],
    );
    if (existingConversation.results.length > 0) {
      const existingThreadId = existingConversation.results[0].thread_id;
      const assistantRows = await db.query<{ content: string }>(
        "SELECT content FROM conversations WHERE thread_id = ? AND role = 'assistant' ORDER BY created_at DESC LIMIT 1",
        [existingThreadId],
      );
      const balanceRows = await db.query<{ token_balance: number }>(
        'SELECT token_balance FROM users WHERE id = ?',
        [params.userId],
      );
      return {
        status: 'already_processed',
        reply: assistantRows.results[0]?.content ?? undefined,
        remainingTokens: balanceRows.results[0]?.token_balance ?? params.tokenBalance,
        threadId: existingThreadId,
      };
    }
  }

  const deepSeekResult = params.chatCompletion
    ? await params.chatCompletion(messages)
    : await callDeepSeekChat(messages, requireEnv('DEEPSEEK_API_KEY'));

  const finalizeResult = await finalizeChatTurn(db, {
    userId: params.userId,
    threadId,
    model: DEEPSEEK_MODEL,
    inputTokens: deepSeekResult.usage.prompt_tokens,
    outputTokens: deepSeekResult.usage.completion_tokens,
    totalTokens: deepSeekResult.usage.total_tokens,
    userMessage: params.message,
    assistantMessage: deepSeekResult.content,
    userAgentId: agentProfile.user_agent_id,
    agentProfileId: agentProfile.id,
    channel,
    externalMessageId: params.externalMessageId ?? null,
  });

  if (finalizeResult.status !== 'ok' && finalizeResult.status !== 'already_processed') {
    return finalizeResult;
  }

  return {
    status: finalizeResult.status,
    reply: deepSeekResult.content,
    usage: deepSeekResult.usage,
    remainingTokens: finalizeResult.remainingTokens,
    threadId,
  };
}

async function getActiveAgentProfile(
  db: DatabaseAdapter,
  userId: number,
): Promise<ActiveAgentProfileRow> {
  const rows = await db.query<ActiveAgentProfileRow>(
    "SELECT id, user_agent_id FROM agent_profiles WHERE user_id = ? AND is_primary = 1 AND status = 'active' LIMIT 1",
    [userId],
  );

  const profile = rows.results[0];
  if (!profile) {
    throw new Error(`Agent Profile 未初始化: user_id=${userId}`);
  }
  return profile;
}

async function buildChatMessages(
  db: DatabaseAdapter,
  userId: number,
  systemPrompt: string,
  userMessage: string,
) {
  const historyRows = await db.query(
    `SELECT role, content FROM conversations
     WHERE user_id = ? AND role IN ('user', 'assistant')
     ORDER BY created_at DESC LIMIT ?`,
    [userId, DEFAULT_MAX_CONTEXT_MESSAGES],
  );

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  for (let i = historyRows.results.length - 1; i >= 0; i--) {
    const row = historyRows.results[i] as Record<string, unknown>;
    messages.push({
      role: row.role as 'user' | 'assistant',
      content: row.content as string,
    });
  }

  messages.push({ role: 'user', content: userMessage });
  return messages;
}

function withRuntimeContext(systemPrompt: string, channel: ChatChannel): string {
  const now = new Date();
  const timeZone = 'Asia/Shanghai';
  const formatted = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'medium',
    hour12: false,
  }).format(now);

  return `${systemPrompt}

[运行时上下文]
- 当前时间：${formatted}
- 当前时区：${timeZone}
- 当前渠道：${channel}
- 如果用户询问当前时间或日期，直接使用以上运行时上下文回答。`;
}

interface FinalizeChatTurnParams {
  userId: number;
  threadId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  userMessage: string;
  assistantMessage: string;
  userAgentId: number | null;
  agentProfileId: number;
  channel: ChatChannel;
  externalMessageId: string | null;
}

async function finalizeChatTurn(
  db: DatabaseAdapter,
  params: FinalizeChatTurnParams,
): Promise<ChatTurnResult> {
  if (params.totalTokens <= 0) {
    await logSystemEvent('chat.usage_zero_or_negative', {
      user_id: params.userId,
      thread_id: params.threadId,
      total_tokens: params.totalTokens,
    });
    return { status: 'error', message: 'usage must be > 0' };
  }

  const existing = await db.query(
    "SELECT id FROM token_ledger WHERE source = 'deepseek' AND source_id = ? AND type = 'usage'",
    [params.threadId],
  );
  if (existing.results.length > 0) {
    return { status: 'already_processed' };
  }

  const debitResult = await db.execute(
    `UPDATE users
     SET token_balance = token_balance - ?,
         updated_at = datetime('now')
     WHERE id = ?
       AND token_balance >= ?`,
    [params.totalTokens, params.userId, params.totalTokens],
  );

  if ((debitResult.meta?.changes ?? 0) === 0) {
    const users = await db.query('SELECT token_balance FROM users WHERE id = ?', [params.userId]);
    const currentBalance = (users.results[0]?.token_balance as number) ?? 0;
    await logSystemEvent('chat.insufficient_tokens', {
      user_id: params.userId,
      thread_id: params.threadId,
      current_balance: currentBalance,
      required: params.totalTokens,
    });
    return { status: 'insufficient_tokens', remainingTokens: currentBalance };
  }

  const users = await db.query('SELECT token_balance FROM users WHERE id = ?', [params.userId]);
  const remainingTokens = (users.results[0]?.token_balance as number) ?? 0;

  try {
    await db.batch([
      {
        sql: `INSERT INTO token_ledger
              (user_id, type, delta_tokens, balance_after, source, source_id,
               model, input_tokens, output_tokens, total_tokens, estimated_cost_cents, created_at)
              VALUES (?, 'usage', ?, ?, 'deepseek', ?, ?, ?, ?, ?, 0, datetime('now'))`,
        params: [
          params.userId,
          -params.totalTokens,
          remainingTokens,
          params.threadId,
          params.model,
          params.inputTokens,
          params.outputTokens,
          params.totalTokens,
        ],
      },
      {
        sql: `INSERT INTO conversations
              (user_id, thread_id, user_agent_id, agent_profile_id, channel, external_message_id,
               role, content, model, prompt_tokens, completion_tokens, total_tokens)
              VALUES (?, ?, ?, ?, ?, ?, 'user', ?, ?, ?, ?, ?)`,
        params: [
          params.userId,
          params.threadId,
          params.userAgentId,
          params.agentProfileId,
          params.channel,
          params.externalMessageId,
          params.userMessage,
          params.model,
          params.inputTokens,
          params.outputTokens,
          params.totalTokens,
        ],
      },
      {
        sql: `INSERT INTO conversations
              (user_id, thread_id, user_agent_id, agent_profile_id, channel,
               role, content, model, prompt_tokens, completion_tokens, total_tokens)
              VALUES (?, ?, ?, ?, ?, 'assistant', ?, ?, ?, ?, ?)`,
        params: [
          params.userId,
          params.threadId,
          params.userAgentId,
          params.agentProfileId,
          params.channel,
          params.assistantMessage,
          params.model,
          params.inputTokens,
          params.outputTokens,
          params.totalTokens,
        ],
      },
    ]);
  } catch (err) {
    await db.execute(
      "DELETE FROM token_ledger WHERE source = 'deepseek' AND source_id = ? AND type = 'usage'",
      [params.threadId],
    ).catch(() => {});
    await reconcileUserBalance(db, params.userId);
    await logSystemEvent('chat.turn_finalize_failed', {
      user_id: params.userId,
      thread_id: params.threadId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { status: 'error', message: '对话记录写入失败，账本已回滚' };
  }

  return { status: 'ok', remainingTokens };
}

async function reconcileUserBalance(db: DatabaseAdapter, userId: number): Promise<void> {
  await db.execute(
    `UPDATE users SET token_balance = (
      SELECT COALESCE(SUM(delta_tokens), 0) FROM token_ledger WHERE user_id = ?
    ), updated_at = datetime('now')
    WHERE id = ?`,
    [userId, userId],
  );
}

async function logSystemEvent(type: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await getDb().execute(
      'INSERT INTO system_events (type, payload) VALUES (?, ?)',
      [type, JSON.stringify(payload)],
    );
  } catch {
    console.error('[chat-turn] system_events write failed:', type);
  }
}
