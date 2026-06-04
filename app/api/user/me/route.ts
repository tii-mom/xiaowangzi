import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getPaymentUser, PaymentAuthError } from '@/lib/payment-user';

export async function GET(req: NextRequest) {
  try {
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
    const rows = await db.query(
      'SELECT id, token_balance, status, hermes_user_id, wechat_external_id, created_at FROM users WHERE id = ?',
      [user.id],
    );

    if (rows.results.length === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json(rows.results[0]);
  } catch (err) {
    console.error('[user/me]', err);
    return NextResponse.json({ error: '获取用户信息失败' }, { status: 500 });
  }
}
