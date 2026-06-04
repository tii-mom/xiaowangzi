import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireEnv } from '@/lib/env';
import { callDeepSeekChat } from '@/lib/deepseek';
import { loadSystemPrompt } from '@/lib/load-prompt';
import { getPaymentUser, PaymentAuthError } from '@/lib/payment-user';

const MODEL = 'deepseek-v4-flash';
const MAX_CONTEXT_MESSAGES = 20;
const LOW_TOKEN_THRESHOLD = 2000;

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

    if (user.token_balance < LOW_TOKEN_THRESHOLD) {
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
    const systemPrompt = loadSystemPrompt();

    const historyRows = await db.query(
      `SELECT role, content FROM conversations
       WHERE user_id = ? AND role IN ('user', 'assistant')
       ORDER BY created_at DESC LIMIT ?`,
      [user.id, MAX_CONTEXT_MESSAGES],
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

    messages.push({ role: 'user', content: message });

    const apiKey = requireEnv('DEEPSEEK_API_KEY');
    const result = await callDeepSeekChat(messages, apiKey);

    const tokensUsed = result.usage.total_tokens;

    await db.execute(
      `INSERT INTO conversations
       (user_id, thread_id, user_agent_id, role, content, model,
        prompt_tokens, completion_tokens, total_tokens)
       VALUES (?, ?, ?, 'user', ?, ?, ?, ?, ?)`,
      [user.id, threadId, userAgentId ?? null, message,
       result.usage.prompt_tokens, result.usage.completion_tokens, tokensUsed],
    );

    await db.execute(
      `INSERT INTO conversations
       (user_id, thread_id, user_agent_id, role, content, model,
        prompt_tokens, completion_tokens, total_tokens)
       VALUES (?, ?, ?, 'assistant', ?, ?, ?, ?, ?)`,
      [user.id, threadId, userAgentId ?? null, result.content,
       result.usage.prompt_tokens, result.usage.completion_tokens, tokensUsed],
    );

    await db.execute(
      'UPDATE users SET token_balance = MAX(0, token_balance - ?), updated_at = datetime(\'now\') WHERE id = ?',
      [tokensUsed, user.id],
    );

    const users = await db.query(
      'SELECT token_balance FROM users WHERE id = ?',
      [user.id],
    );
    const remainingTokens = (users.results[0]?.token_balance as number) ?? 0;

    await db.execute(
      `INSERT INTO token_ledger
       (user_id, type, delta_tokens, balance_after, source, source_id,
        model, input_tokens, output_tokens, total_tokens, estimated_cost_cents, created_at)
       VALUES (?, 'usage', ?, ?, 'deepseek', ?, ?, ?, ?, ?, 0, datetime('now'))`,
      [user.id, -tokensUsed, remainingTokens, threadId,
       MODEL, result.usage.prompt_tokens, result.usage.completion_tokens, tokensUsed],
    );

    return NextResponse.json({
      reply: result.content,
      usage: result.usage,
      remaining_tokens: remainingTokens,
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
