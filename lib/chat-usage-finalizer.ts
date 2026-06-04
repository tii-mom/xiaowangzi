import { getDb } from '@/lib/db';
import { DEEPSEEK_MODEL } from '@/lib/deepseek';

export interface ChatUsageParams {
  userId: number;
  threadId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ChatUsageResult {
  status: 'ok' | 'insufficient_tokens' | 'error';
  remainingTokens?: number;
  message?: string;
}

export async function finalizeChatUsage(
  params: ChatUsageParams,
): Promise<ChatUsageResult> {
  const db = getDb();

  if (params.totalTokens <= 0) {
    await logSystemEvent('chat.usage_zero_or_negative', {
      user_id: params.userId,
      total_tokens: params.totalTokens,
    });
    return { status: 'error', message: 'usage must be > 0' };
  }

  const updateResult = await db.execute(
    `UPDATE users
     SET token_balance = token_balance - ?,
         updated_at = datetime('now')
     WHERE id = ?
       AND token_balance >= ?`,
    [params.totalTokens, params.userId, params.totalTokens],
  );

  if ((updateResult.meta?.changes ?? 0) === 0) {
    const users = await db.query(
      'SELECT token_balance FROM users WHERE id = ?',
      [params.userId],
    );
    const currentBalance = (users.results[0]?.token_balance as number) ?? 0;
    if (currentBalance < params.totalTokens) {
      await logSystemEvent('chat.insufficient_tokens', {
        user_id: params.userId,
        current_balance: currentBalance,
        required: params.totalTokens,
      });
      return { status: 'insufficient_tokens', remainingTokens: currentBalance };
    }
    await logSystemEvent('chat.atomic_update_no_changes', {
      user_id: params.userId,
      current_balance: currentBalance,
      required: params.totalTokens,
    });
    return { status: 'insufficient_tokens', remainingTokens: currentBalance };
  }

  const users = await db.query(
    'SELECT token_balance FROM users WHERE id = ?',
    [params.userId],
  );
  const remainingTokens = (users.results[0]?.token_balance as number) ?? 0;

  try {
    await db.execute(
      `INSERT INTO token_ledger
       (user_id, type, delta_tokens, balance_after, source, source_id,
        model, input_tokens, output_tokens, total_tokens, estimated_cost_cents, created_at)
       VALUES (?, 'usage', ?, ?, 'deepseek', ?, ?, ?, ?, ?, 0, datetime('now'))`,
      [params.userId, -params.totalTokens, remainingTokens, params.threadId,
        params.model, params.inputTokens, params.outputTokens, params.totalTokens],
    );
  } catch (err) {
    await logSystemEvent('chat.token_ledger_insert_failed', {
      user_id: params.userId,
      thread_id: params.threadId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { status: 'error', message: '账本写入失败，余额已扣除' };
  }

  return { status: 'ok', remainingTokens };
}

async function logSystemEvent(type: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const db = getDb();
    await db.execute(
      'INSERT INTO system_events (type, payload) VALUES (?, ?)',
      [type, JSON.stringify(payload)],
    );
  } catch {
    console.error('[finalizeChatUsage] failed to write system_events:', type, payload);
  }
}
