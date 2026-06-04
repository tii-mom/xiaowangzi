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
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '5'), 20);
    const rows = await db.query(
      `SELECT role, content, model, total_tokens, created_at
       FROM conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [user.id, limit],
    );
    return NextResponse.json({ conversations: rows.results });
  } catch (err) {
    return NextResponse.json({ error: '获取对话历史失败' }, { status: 500 });
  }
}
