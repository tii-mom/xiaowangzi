import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDb } from '@/lib/db';
import { PLANS } from '@/lib/plans';
import { ensureUserPrimaryAgentProfile } from '@/lib/agent-profile';

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(req: NextRequest) {
  try {
    const existingCookie = req.cookies.get('auth_token')?.value;
    const db = getDb();

    if (existingCookie) {
      const sessions = await db.query(
        "SELECT user_id FROM auth_sessions WHERE token = ? AND expires_at > datetime('now')",
        [existingCookie],
      );
      if (sessions.results.length > 0) {
        const userId = sessions.results[0].user_id as number;
        // 升级已存在登录态的用户，确保创建 primary agent profile
        await ensureUserPrimaryAgentProfile(userId);
        const users = await db.query(
          'SELECT id, token_balance, status FROM users WHERE id = ?',
          [userId],
        );
        if (users.results.length > 0) {
          return NextResponse.json({
            user: users.results[0],
            created: false,
          });
        }
      }
    }

    const db2 = getDb();
    const insertUser = await db2.execute(
      "INSERT INTO users (token_balance, status) VALUES (?, 'active')",
      [PLANS.free_trial.tokens_amount],
    );
    const userId = insertUser.meta?.last_row_id ?? 1;

    const token = generateToken();
    const thirtyDays = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

    await db2.execute(
      'INSERT INTO auth_sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, token, thirtyDays],
    );

    const users = await db2.query(
      'SELECT token_balance FROM users WHERE id = ?',
      [userId],
    );
    const balanceAfter = (users.results[0]?.token_balance as number) ?? PLANS.free_trial.tokens_amount;

    await db2.execute(
      `INSERT INTO token_ledger
       (user_id, type, delta_tokens, balance_after, source, source_id, created_at)
       VALUES (?, 'grant', ?, ?, 'free_trial', ?, datetime('now'))`,
      [userId, PLANS.free_trial.tokens_amount, balanceAfter, `web-session:${userId}`],
    );

    // 强要求：确保初始化用户 Primary Agent Profile，失败则直接抛出 500 阻断登录
    await ensureUserPrimaryAgentProfile(userId as number);

    const isProd = (process.env.NODE_ENV ?? '') === 'production';

    const response = NextResponse.json({
      user: { id: userId, token_balance: balanceAfter, status: 'active' },
      created: true,
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 30 * 86400,
    });

    return response;
  } catch (err) {
    console.error('[auth/web-session]', err);
    return NextResponse.json(
      { error: '创建会话失败' },
      { status: 500 },
    );
  }
}
