import { getDb } from '@/lib/db';
import { priceYuanToCents } from '@/lib/plans';

export interface FinalizeParams {
  order_id: string;
  aoid: string;
  order_uid: string;
  price: string;
  pay_price: string;
  raw_notify_json?: string;
}

export interface FinalizeResult {
  status: 'ok' | 'already_finalized' | 'error';
  message?: string;
}

export async function finalizePaidOrder(params: FinalizeParams): Promise<FinalizeResult> {
  const db = getDb();
  const toleranceCents = parseEnvTolerance();

  const orders = await db.query(
    'SELECT * FROM payment_orders WHERE order_id = ?',
    [params.order_id],
  );

  if (orders.results.length === 0) {
    await logSystemEvent('payment.order_not_found', { order_id: params.order_id });
    return { status: 'error', message: 'order not found' };
  }

  const order = orders.results[0] as Record<string, unknown>;
  const userId = order.user_id as number;

  if (String(order.user_id) !== params.order_uid) {
    await logSystemEvent('payment.uid_mismatch', {
      order_id: params.order_id,
      expected: String(order.user_id),
      received: params.order_uid,
    });
    return { status: 'error', message: 'order_uid mismatch' };
  }

  const expectedCents = order.amount_cents as number;
  const actualCents = priceYuanToCents(params.pay_price || params.price);

  if (Math.abs(actualCents - expectedCents) > toleranceCents) {
    await logSystemEvent('payment.amount_mismatch', {
      order_id: params.order_id,
      expected_cents: expectedCents,
      actual_cents: actualCents,
      tolerance_cents: toleranceCents,
    });
    return { status: 'error', message: 'amount mismatch' };
  }

  const existingAoid = order.bufpay_aoid as string | null;
  if (existingAoid && existingAoid !== params.aoid) {
    await logSystemEvent('payment.aoid_mismatch', {
      order_id: params.order_id,
      existing_aoid: existingAoid,
      received_aoid: params.aoid,
    });
    return { status: 'error', message: 'aoid mismatch' };
  }

  const currentStatus = order.status as string;

  if (await checkTokenLedger(db, params.order_id)) {
    await reconcileUserBalance(db, userId);
    await ensureOrderPaid(db, params.order_id);
    return { status: 'already_finalized' };
  }

  if (currentStatus === 'paid') {
    await logSystemEvent('payment.paid_without_ledger_recovery', {
      order_id: params.order_id,
    });
  }

  const isRecovery = currentStatus === 'paid' || currentStatus === 'processing';

  if (!isRecovery && currentStatus !== 'pending') {
    await logSystemEvent('payment.unexpected_status', {
      order_id: params.order_id,
      status: currentStatus,
    });
    return { status: 'error', message: `unexpected order status: ${currentStatus}` };
  }

  if (!isRecovery) {
    const claimResult = await db.execute(
      `UPDATE payment_orders
       SET status = 'processing', bufpay_aoid = COALESCE(bufpay_aoid, ?),
           raw_notify_json = ?
       WHERE order_id = ? AND status = 'pending'`,
      [params.aoid, params.raw_notify_json ?? JSON.stringify(params), params.order_id],
    );

    if ((claimResult.meta?.changes ?? 0) === 0) {
      if (await checkTokenLedger(db, params.order_id)) {
        await reconcileUserBalance(db, userId);
        await ensureOrderPaid(db, params.order_id);
        return { status: 'already_finalized' };
      }
      await logSystemEvent('payment.finalize_race', {
        order_id: params.order_id,
      });
      return { status: 'error', message: 'concurrent update conflict' };
    }
  }

  return executeRecharge(db, order, params.order_id);
}

export async function reconcileUserBalance(
  db: ReturnType<typeof getDb>,
  userId: number,
): Promise<void> {
  try {
    await db.execute(
      `UPDATE users SET token_balance = (
        SELECT COALESCE(SUM(delta_tokens), 0) FROM token_ledger WHERE user_id = ?
      ), updated_at = datetime('now')
      WHERE id = ?`,
      [userId, userId],
    );
  } catch (err) {
    await logSystemEvent('payment.reconcile_failed', {
      user_id: userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function ensureOrderPaid(
  db: ReturnType<typeof getDb>,
  orderId: string,
): Promise<void> {
  try {
    await db.execute(
      `UPDATE payment_orders
       SET status = 'paid', paid_at = COALESCE(paid_at, datetime('now'))
       WHERE order_id = ? AND status IN ('pending', 'processing')`,
      [orderId],
    );
  } catch (err) {
    await logSystemEvent('payment.ensure_paid_failed', {
      order_id: orderId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function checkTokenLedger(
  db: ReturnType<typeof getDb>,
  orderId: string,
): Promise<boolean> {
  const rows = await db.query(
    "SELECT id FROM token_ledger WHERE source = 'bufpay' AND source_id = ? AND type = 'purchase'",
    [orderId],
  );
  return rows.results.length > 0;
}

async function executeRecharge(
  db: ReturnType<typeof getDb>,
  order: Record<string, unknown>,
  orderId: string,
): Promise<FinalizeResult> {
  const userId = order.user_id as number;
  const tokens = order.tokens_amount as number;
  const planId = order.plan as string;

  const insertLedger = await db.execute(
    `INSERT INTO token_ledger
     (user_id, type, delta_tokens, balance_after, source, source_id, total_tokens, created_at)
     VALUES (?, 'purchase', ?, 0, 'bufpay', ?, ?, datetime('now'))`,
    [userId, tokens, orderId, tokens],
  );

  if ((insertLedger.meta?.changes ?? 0) === 0) {
    await reconcileUserBalance(db, userId);
    await ensureOrderPaid(db, orderId);
    await logSystemEvent('payment.ledger_insert_duplicate', { order_id: orderId });
    return { status: 'already_finalized' };
  }

  try {
    await db.execute(
      'UPDATE users SET token_balance = token_balance + ?, updated_at = datetime(\'now\') WHERE id = ?',
      [tokens, userId],
    );
  } catch (err) {
    await logSystemEvent('payment.balance_update_failed', {
      order_id: orderId,
      error: err instanceof Error ? err.message : String(err),
    });
    await reconcileUserBalance(db, userId);
    return { status: 'error', message: '余额更新失败，已尝试 reconcile' };
  }

  const users = await db.query(
    'SELECT token_balance FROM users WHERE id = ?',
    [userId],
  );
  const latestBalance = (users.results[0]?.token_balance as number) ?? tokens;

  try {
    await db.execute(
      `UPDATE token_ledger SET balance_after = ?
       WHERE source = 'bufpay' AND source_id = ? AND type = 'purchase'`,
      [latestBalance, orderId],
    );
  } catch (err) {
    await logSystemEvent('payment.ledger_balance_after_update_failed', {
      order_id: orderId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const existingSub = await db.query(
      "SELECT id FROM subscriptions WHERE user_id = ? AND status = 'active' AND plan = ?",
      [userId, planId],
    );

    if (existingSub.results.length === 0) {
      await db.execute(
        `INSERT INTO subscriptions (user_id, plan, status, started_at)
         VALUES (?, ?, 'active', datetime('now'))`,
        [userId, planId],
      );
    } else {
      await db.execute(
        "UPDATE subscriptions SET updated_at = datetime('now') WHERE id = ?",
        [existingSub.results[0].id],
      );
    }
  } catch (err) {
    await logSystemEvent('payment.subscription_update_failed', {
      order_id: orderId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await ensureOrderPaid(db, orderId);

  return { status: 'ok' };
}

function parseEnvTolerance(): number {
  const raw = process.env.BUFPAY_AMOUNT_TOLERANCE_CENTS;
  if (raw === undefined || raw === '') return 0;
  const val = Number(raw);
  return Number.isFinite(val) && val >= 0 ? Math.round(val) : 0;
}

async function logSystemEvent(type: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const db = getDb();
    await db.execute(
      'INSERT INTO system_events (type, payload) VALUES (?, ?)',
      [type, JSON.stringify(payload)],
    );
  } catch {
    console.error('[finalizePaidOrder] failed to write system_events:', type, payload);
  }
}
