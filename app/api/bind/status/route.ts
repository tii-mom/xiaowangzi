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

    const codes = await db.query(
      "SELECT code, status, expires_at, created_at FROM bind_codes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
      [user.id],
    );

    const bound = await db.query(
      'SELECT hermes_user_id, wechat_external_id FROM users WHERE id = ?',
      [user.id],
    );

    return NextResponse.json({
      bind_code: codes.results[0] ?? null,
      hermes_user_id: (bound.results[0]?.hermes_user_id as string) ?? null,
      wechat_external_id: (bound.results[0]?.wechat_external_id as string) ?? null,
      is_bound: Boolean((bound.results[0]?.hermes_user_id as string) || (bound.results[0]?.wechat_external_id as string)),
    });
  } catch (err) {
    console.error('[bind/status]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '查询绑定状态失败' },
      { status: 500 },
    );
  }
}
