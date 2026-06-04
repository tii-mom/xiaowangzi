import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getPaymentUser, PaymentAuthError } from '@/lib/payment-user';

export async function GET(req: NextRequest) {
  try {
    let user;
    try { user = await getPaymentUser(req); } catch (err) {
      if (err instanceof PaymentAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }
    const db = getDb();
    const subs = await db.query(
      "SELECT plan, status, started_at, expires_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
      [user.id],
    );
    return NextResponse.json({ subscription: subs.results[0] ?? null });
  } catch (err) {
    return NextResponse.json({ error: '获取订阅失败' }, { status: 500 });
  }
}
