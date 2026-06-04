import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getPaymentUser, PaymentAuthError } from '@/lib/payment-user';

export async function GET(_req: NextRequest) {
  try {
    let user;
    try {
      user = await getPaymentUser(_req);
    } catch (err) {
      if (err instanceof PaymentAuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    const db = getDb();
    const orders = await db.query(
      `SELECT order_id, plan, amount_cents, tokens_amount, status, created_at, paid_at
       FROM payment_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
      [user.id],
    );

    return NextResponse.json({ orders: orders.results });
  } catch (err) {
    console.error('[user/orders]', err);
    return NextResponse.json({ error: '获取订单失败' }, { status: 500 });
  }
}
