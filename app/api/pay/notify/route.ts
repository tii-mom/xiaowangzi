import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireEnv } from '@/lib/env';
import { verifyNotifySign } from '@/lib/bufpay';
import { planIdToLabel, priceYuanToCents } from '@/lib/plans';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let body: Record<string, string>;

    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    }

    const aoid = body.aoid ?? '';
    const order_id = body.order_id ?? '';
    const order_uid = body.order_uid ?? '';
    const price = body.price ?? '';
    const pay_price = body.pay_price ?? '';
    const sign = body.sign ?? '';

    if (!aoid || !order_id || !price || !sign) {
      console.error('[notify] missing fields', { aoid, order_id, price, sign });
      return new NextResponse('missing fields', { status: 400 });
    }

    const appSecret = requireEnv('BUFPAY_APP_SECRET');

    const valid = verifyNotifySign(
      { aoid, order_id, order_uid, price, pay_price, sign },
      appSecret,
    );

    if (!valid) {
      console.error('[notify] sign mismatch', { order_id, aoid });
      return new NextResponse('sign error', { status: 400 });
    }

    const db = getDb();
    const orders = await db.query(
      'SELECT * FROM payment_orders WHERE order_id = ?',
      [order_id],
    );

    if (orders.results.length === 0) {
      console.error('[notify] order not found', { order_id });
      return new NextResponse('order not found', { status: 404 });
    }

    const order = orders.results[0] as Record<string, unknown>;

    if (order.status === 'paid') {
      return new NextResponse('ok', { status: 200 });
    }

    const expectedCents = order.amount_cents as number;
    const actualCents = priceYuanToCents(pay_price || price);

    if (actualCents < expectedCents) {
      console.error('[notify] amount mismatch', {
        order_id,
        expected: expectedCents,
        actual: actualCents,
      });
      return new NextResponse('amount mismatch', { status: 400 });
    }

    await db.execute(
      `UPDATE payment_orders
       SET status = 'paid', paid_at = datetime('now'), bufpay_aoid = ?,
           raw_notify_json = ?
       WHERE order_id = ? AND status = 'pending'`,
      [aoid, JSON.stringify(body), order_id],
    );

    const userId = order.user_id as number;
    const tokens = order.tokens_amount as number;

    const users = await db.query('SELECT token_balance FROM users WHERE id = ?', [
      userId,
    ]);
    const currentBalance = (users.results[0]?.token_balance as number) ?? 0;
    const newBalance = currentBalance + tokens;

    await db.execute('UPDATE users SET token_balance = ?, updated_at = datetime(\"now\") WHERE id = ?', [
      newBalance,
      userId,
    ]);

    await db.execute(
      `INSERT INTO token_ledger
       (user_id, type, delta_tokens, balance_after, source, source_id, created_at)
       VALUES (?, 'purchase', ?, ?, 'bufpay', ?, datetime('now'))`,
      [userId, tokens, newBalance, order_id],
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

    console.log(`[notify] payment success: user=${userId}, order=${order_id}, tokens=${tokens}, balance=${newBalance}`);

    return new NextResponse('ok', { status: 200 });
  } catch (err) {
    console.error('[notify] error', err);
    return new NextResponse('internal error', { status: 500 });
  }
}
