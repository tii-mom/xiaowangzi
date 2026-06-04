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

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100);
    const before = url.searchParams.get('before');

    const db = getDb();

    let sql = `SELECT role, content, model, total_tokens, created_at
               FROM conversations
               WHERE user_id = ?`;
    const params: unknown[] = [user.id];

    if (before) {
      sql += ' AND created_at < ?';
      params.push(before);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = await db.query(sql, params);

    const messages = rows.results.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        role: row.role,
        content: row.content,
        model: row.model,
        tokens: row.total_tokens,
        created_at: row.created_at,
      };
    });

    const userRows = await db.query(
      'SELECT token_balance FROM users WHERE id = ?',
      [user.id],
    );
    const tokenBalance = (userRows.results[0]?.token_balance as number) ?? 0;

    return NextResponse.json({
      messages,
      token_balance: tokenBalance,
    });
  } catch (err) {
    console.error('[chat/history]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '获取历史失败' },
      { status: 500 },
    );
  }
}
