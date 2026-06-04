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

    const ledger = await db.query(
      `SELECT type, delta_tokens, balance_after, source, source_id, total_tokens, model, created_at
       FROM token_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
      [user.id],
    );

    const totals = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'purchase' THEN delta_tokens ELSE 0 END), 0) as total_purchased,
         COALESCE(SUM(CASE WHEN type = 'usage' THEN ABS(delta_tokens) ELSE 0 END), 0) as total_used
       FROM token_ledger WHERE user_id = ?`,
      [user.id],
    );

    return NextResponse.json({
      token_balance: user.token_balance,
      ledger: ledger.results,
      total_purchased: (totals.results[0] as Record<string, unknown>)?.total_purchased ?? 0,
      total_used: (totals.results[0] as Record<string, unknown>)?.total_used ?? 0,
    });
  } catch (err) {
    console.error('[user/tokens]', err);
    return NextResponse.json({ error: '获取Token记录失败' }, { status: 500 });
  }
}
