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

  const updateResult = await db.execute(
    `UPDATE payment_orders
     SET status = 'paid', paid_at = datetime('now'), bufpay_aoid = COALESCE(bufpay_aoid, ?),
         raw_notify_json = ?
     WHERE order_id = ? AND status = 'pending'`,
    [params.aoid, params.raw_notify_json ?? JSON.stringify(params), params.order_id],
  );

  if ((updateResult.meta?.changes ?? 0) === 0) {
    const recheck = await db.query(
      "SELECT status FROM payment_orders WHERE order_id = ?",
      [params.order_id],
    );
    const currentStatus = recheck.results[0]?.status as string | undefined;
    if (currentStatus === 'paid') {
      return { status: 'already_finalized' };
    }
    await logSystemEvent('payment.finalize_race', {
      order_id: params.order_id,
      current_status: currentStatus ?? 'unknown',
    });
    return { status: 'error', message: 'concurrent update conflict' };
  }

  try {
    const userId = order.user_id as number;
    const tokens = order.tokens_amount as number;

    await db.execute(
      'UPDATE users SET token_balance = token_balance + ?, updated_at = datetime(\'now\') WHERE id = ?',
      [tokens, userId],
    );

    await db.execute(
      `INSERT INTO token_ledger
       (user_id, type, delta_tokens, balance_after, source, source_id, total_tokens, created_at)
       SELECT ?, 'purchase', ?, token_balance, 'bufpay', ?, ?, datetime('now')
       FROM users WHERE id = ?`,
      [userId, tokens, params.order_id, tokens, userId],
    );

    const planId = order.plan as string;
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

    return { status: 'ok' };

  } catch (err) {
    await logSystemEvent('payment.finalize_crash', {
      order_id: params.order_id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { status: 'error', message: '入账过程异常' };
  }
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
