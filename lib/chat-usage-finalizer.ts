import { getDb } from '@/lib/db';

export interface ChatUsageParams {
  userId: number;
  threadId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ChatUsageResult {
  status: 'ok' | 'insufficient_tokens' | 'already_processed' | 'error';
  remainingTokens?: number;
  message?: string;
}

export async function finalizeChatUsage(
  params: ChatUsageParams,
): Promise<ChatUsageResult> {
  const db = getDb();

  if (params.totalTokens <= 0) {
    await logSystemEvent('chat.usage_zero_or_negative', {
      user_id: params.userId, total_tokens: params.totalTokens,
    });
    return { status: 'error', message: 'usage must be > 0' };
  }

  const rows = await db.query(
    "SELECT id FROM token_ledger WHERE source = 'deepseek' AND source_id = ? AND type = 'usage'",
    [params.threadId],
  );
  if (rows.results.length > 0) {
    return { status: 'already_processed' };
  }

  try {
    await db.execute(
      `INSERT INTO token_ledger
       (user_id, type, delta_tokens, balance_after, source, source_id,
        model, input_tokens, output_tokens, total_tokens, estimated_cost_cents, created_at)
       VALUES (?, 'usage', ?, 0, 'deepseek', ?, ?, ?, ?, ?, 0, datetime('now'))`,
      [params.userId, -params.totalTokens, params.threadId,
        params.model, params.inputTokens, params.outputTokens, params.totalTokens],
    );
  } catch {
    const recheck = await db.query(
      "SELECT id FROM token_ledger WHERE source = 'deepseek' AND source_id = ? AND type = 'usage'",
      [params.threadId],
    );
    if (recheck.results.length > 0) return { status: 'already_processed' };
    return { status: 'error', message: '账本写入失败' };
  }

  let updateFailed = false;
  let updateError = '';
  try {
    const updateResult = await db.execute(
      `UPDATE users
       SET token_balance = token_balance - ?,
           updated_at = datetime('now')
       WHERE id = ?
         AND token_balance >= ?`,
      [params.totalTokens, params.userId, params.totalTokens],
    );

    if ((updateResult.meta?.changes ?? 0) === 0) {
      updateFailed = true;
    }
  } catch (err) {
    updateFailed = true;
    updateError = err instanceof Error ? err.message : String(err);
  }

  if (updateFailed) {
    await deleteUsageLedger(db, params.threadId);

    const users = await db.query(
      'SELECT token_balance FROM users WHERE id = ?', [params.userId],
    );
    const currentBalance = (users.results[0]?.token_balance as number) ?? 0;

    if (currentBalance < params.totalTokens) {
      await logSystemEvent('chat.insufficient_tokens', {
        user_id: params.userId, thread_id: params.threadId,
        current_balance: currentBalance, required: params.totalTokens,
      });
      return { status: 'insufficient_tokens', remainingTokens: currentBalance };
    }

    await logSystemEvent('chat.balance_update_failed', {
      user_id: params.userId, thread_id: params.threadId,
      current_balance: currentBalance, required: params.totalTokens,
      error: updateError,
    });
    return { status: 'error', message: '余额更新失败，账本已回滚' };
  }

  const users = await db.query(
    'SELECT token_balance FROM users WHERE id = ?', [params.userId],
  );
  const remainingTokens = (users.results[0]?.token_balance as number) ?? 0;

  try {
    await db.execute(
      `UPDATE token_ledger SET balance_after = ?
       WHERE source = 'deepseek' AND source_id = ? AND type = 'usage'`,
      [remainingTokens, params.threadId],
    );
  } catch (err) {
    await logSystemEvent('chat.ledger_balance_update_failed', {
      user_id: params.userId,
      thread_id: params.threadId,
      remaining_tokens: remainingTokens,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { status: 'ok', remainingTokens };
}

async function deleteUsageLedger(
  db: ReturnType<typeof getDb>,
  threadId: string,
): Promise<void> {
  try {
    await db.execute(
      "DELETE FROM token_ledger WHERE source = 'deepseek' AND source_id = ? AND type = 'usage'",
      [threadId],
    );
  } catch {
    // best-effort cleanup
  }
}

async function logSystemEvent(
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const db = getDb();
    await db.execute(
      'INSERT INTO system_events (type, payload) VALUES (?, ?)',
      [type, JSON.stringify(payload)],
    );
  } catch {
    console.error('[finalizeChatUsage] system_events write failed:', type);
  }
}
