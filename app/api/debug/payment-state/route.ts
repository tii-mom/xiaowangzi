import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { reconcileUserBalance } from '@/lib/payment-finalizer';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.INTERNAL_PAYMENT_DEBUG !== 'true') {
    return NextResponse.json({ error: 'forbidden in production' }, { status: 403 });
  }

  const url = new URL(req.url);
  const orderId = url.searchParams.get('order_id');

  if (!orderId) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }

  const db = getDb();

  const orders = await db.query(
    'SELECT * FROM payment_orders WHERE order_id = ?',
    [orderId],
  );
  const order = orders.results[0] as Record<string, unknown> | undefined;

  const ledgerRows = await db.query(
    "SELECT COUNT(*) as cnt FROM token_ledger WHERE source = 'bufpay' AND source_id = ? AND type = 'purchase'",
    [orderId],
  );
  const ledgerCount = (ledgerRows.results[0]?.cnt as number) ?? 0;

  let user = null;
  if (order) {
    if (order.status === 'paid' && ledgerCount > 0) {
      await reconcileUserBalance(db, order.user_id as number);
    }

    const userRows = await db.query(
      'SELECT id, token_balance, status FROM users WHERE id = ?',
      [order.user_id],
    );
    user = userRows.results[0] ?? null;
  }

  return NextResponse.json({
    order: order
      ? {
          order_id: order.order_id,
          status: order.status,
          plan: order.plan,
          tokens_amount: order.tokens_amount,
          amount_cents: order.amount_cents,
          bufpay_aoid: order.bufpay_aoid,
        }
      : null,
    ledger_count: ledgerCount,
    user,
  });
}
