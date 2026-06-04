import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireEnv } from '@/lib/env';
import { callDeepSeekChat, DEEPSEEK_MODEL } from '@/lib/deepseek';
import { PRINCE_SYSTEM_PROMPT } from '@/lib/prince-prompt';
import { finalizeChatUsage } from '@/lib/chat-usage-finalizer';
import { getPaymentUser, PaymentAuthError } from '@/lib/payment-user';

const MAX_CONTEXT_MESSAGES = 20;
const MIN_CHAT_TOKEN_BALANCE = parseInt(process.env.CHAT_MIN_TOKEN_BALANCE ?? '10000', 10);

export async function POST(req: NextRequest) {
  let userId: number | undefined;
  let threadId: string | undefined;

  try {
    const body = await req.json() as { message?: string };
    if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    }

    let user;
    try {
      user = await getPaymentUser(req);
      userId = user.id;
    } catch (err) {
      if (err instanceof PaymentAuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    const db = getDb();

    if (user.token_balance <= MIN_CHAT_TOKEN_BALANCE) {
      return NextResponse.json(
        { error: '这次小星球能量不足，请先充值后继续', token_balance: user.token_balance },
        { status: 402 },
      );
    }

    threadId = `chat_${user.id}_${Date.now().toString(36)}`;

    const agentRows = await db.query(
      "SELECT id FROM user_agents WHERE user_id = ? AND status = 'active' LIMIT 1",
      [user.id],
    );
    const userAgentId = agentRows.results[0]?.id as number | undefined;

    const historyRows = await db.query(
      `SELECT role, content FROM conversations
       WHERE user_id = ? AND role IN ('user', 'assistant')
       ORDER BY created_at DESC LIMIT ?`,
      [user.id, MAX_CONTEXT_MESSAGES],
    );

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: PRINCE_SYSTEM_PROMPT },
    ];

    for (let i = historyRows.results.length - 1; i >= 0; i--) {
      const row = historyRows.results[i] as Record<string, unknown>;
      messages.push({
        role: row.role as 'user' | 'assistant',
        content: row.content as string,
      });
    }

    messages.push({ role: 'user', content: body.message });

    const apiKey = requireEnv('DEEPSEEK_API_KEY');
    const result = await callDeepSeekChat(messages, apiKey);

    const usageResult = await finalizeChatUsage({
      userId: user.id,
      threadId,
      model: DEEPSEEK_MODEL,
      inputTokens: result.usage.prompt_tokens,
      outputTokens: result.usage.completion_tokens,
      totalTokens: result.usage.total_tokens,
    });

    if (usageResult.status !== 'ok' && usageResult.status !== 'already_processed') {
      await insertSystemEvent(db, 'chat.send_failed', {
        user_id: user.id,
        thread_id: threadId,
        reason: usageResult.status,
        message: usageResult.message ?? '',
        stage: 'finalize_usage',
      });

      const status = usageResult.status === 'insufficient_tokens' ? 402 : 500;
      return NextResponse.json(
        { error: '这次小星球能量不足，请先充值后继续' },
        { status },
      );
    }

    await db.execute(
      `INSERT INTO conversations
       (user_id, thread_id, user_agent_id, role, content, model,
        prompt_tokens, completion_tokens, total_tokens)
       VALUES (?, ?, ?, 'user', ?, ?, ?, ?, ?)`,
       [user.id, threadId, userAgentId ?? null, body.message, DEEPSEEK_MODEL,
        result.usage.prompt_tokens, result.usage.completion_tokens, result.usage.total_tokens],
    );

    try {
      await db.execute(
        `INSERT INTO conversations
         (user_id, thread_id, user_agent_id, role, content, model,
          prompt_tokens, completion_tokens, total_tokens)
         VALUES (?, ?, ?, 'assistant', ?, ?, ?, ?, ?)`,
        [user.id, threadId, userAgentId ?? null, result.content, DEEPSEEK_MODEL,
          result.usage.prompt_tokens, result.usage.completion_tokens, result.usage.total_tokens],
      );
    } catch (err) {
      await insertSystemEvent(db, 'chat.conversation_insert_failed', {
        user_id: user.id,
        thread_id: threadId,
        role: 'assistant',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return NextResponse.json({
      reply: result.content,
      usage: result.usage,
      remaining_tokens: usageResult.remainingTokens ?? 0,
      thread_id: threadId,
    });
  } catch (err) {
    console.error('[chat/send]', err);
    const db = getDb();
    await insertSystemEvent(db, 'chat.send_exception', {
      user_id: userId ?? null,
      thread_id: threadId ?? null,
      error: err instanceof Error ? err.message : String(err),
      stage: 'unknown',
    }).catch(() => {});

    return NextResponse.json(
      { error: err instanceof Error ? err.message : '对话失败' },
      { status: 500 },
    );
  }
}

async function insertSystemEvent(
  db: ReturnType<typeof getDb>,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await db.execute(
      'INSERT INTO system_events (type, payload) VALUES (?, ?)',
      [type, JSON.stringify(payload)],
    );
  } catch {
    // best-effort
  }
}
