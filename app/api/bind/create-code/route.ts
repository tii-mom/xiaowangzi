import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateBindCode, generateCodeExpiry } from '@/lib/bind';
import { getPaymentUser, PaymentAuthError } from '@/lib/payment-user';

export async function POST(req: NextRequest) {
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

    const existing = await db.query(
      "SELECT id, code FROM bind_codes WHERE user_id = ? AND status = 'pending' AND expires_at > datetime('now')",
      [user.id],
    );

    if (existing.results.length > 0) {
      const row = existing.results[0] as Record<string, unknown>;
      return NextResponse.json({
        code: row.code,
        status: 'pending',
        expires_at: null,
        message: '已有有效绑定码',
      });
    }

    const code = generateBindCode();
    const expiresAt = generateCodeExpiry(1);

    await db.execute(
      "INSERT INTO bind_codes (code, user_id, status, expires_at) VALUES (?, ?, 'pending', ?)",
      [code, user.id, expiresAt],
    );

    return NextResponse.json({
      code,
      status: 'pending',
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error('[bind/create-code]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '生成绑定码失败' },
      { status: 500 },
    );
  }
}
