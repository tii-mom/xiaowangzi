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
  try {
    const { message } = await req.json();
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    }

    let user;
    try {
      user = await getPaymentUser(req);
    } catch (err) {
      if (err instanceof PaymentAuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    const db = getDb();

    if (user.token_balance <= MIN_CHAT_TOKEN_BALANCE) {
      return NextResponse.json({
        error: 'Token 余额不足，请充值后继续对话',
        token_balance: user.token_balance,
      }, { status: 402 });
    }

    const threadId = `chat_${user.id}_${Date.now().toString(36)}`;

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

    messages.push({ role: 'user', content: message });

    const apiKey = requireEnv('DEEPSEEK_API_KEY');
    const result = await callDeepSeekChat(messages, apiKey);

    await db.execute(
      `INSERT INTO conversations
       (user_id, thread_id, user_agent_id, role, content, model,
        prompt_tokens, completion_tokens, total_tokens)
       VALUES (?, ?, ?, 'user', ?, ?, ?, ?, ?)`,
      [user.id, threadId, userAgentId ?? null, message, DEEPSEEK_MODEL,
        result.usage.prompt_tokens, result.usage.completion_tokens, result.usage.total_tokens],
    );

    await db.execute(
      `INSERT INTO conversations
       (user_id, thread_id, user_agent_id, role, content, model,
        prompt_tokens, completion_tokens, total_tokens)
       VALUES (?, ?, ?, 'assistant', ?, ?, ?, ?, ?)`,
      [user.id, threadId, userAgentId ?? null, result.content, DEEPSEEK_MODEL,
        result.usage.prompt_tokens, result.usage.completion_tokens, result.usage.total_tokens],
    );

    const usageResult = await finalizeChatUsage({
      userId: user.id,
      threadId,
      model: DEEPSEEK_MODEL,
      inputTokens: result.usage.prompt_tokens,
      outputTokens: result.usage.completion_tokens,
      totalTokens: result.usage.total_tokens,
    });

    if (usageResult.status === 'insufficient_tokens') {
      return NextResponse.json({
        reply: result.content,
        warning: '此次对话已发送，但 Token 余额不足，请尽快充值',
        usage: result.usage,
        remaining_tokens: usageResult.remainingTokens ?? 0,
        thread_id: threadId,
      });
    }

    if (usageResult.status === 'error') {
      return NextResponse.json({
        reply: result.content,
        usage: result.usage,
        remaining_tokens: usageResult.remainingTokens ?? 0,
        thread_id: threadId,
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '对话失败' },
      { status: 500 },
    );
  }
}
