import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { PLANS } from '@/lib/plans';
import { ensureUserPrimaryAgentProfile } from '@/lib/agent-profile';

export interface WebSessionUser {
  id: number;
  token_balance: number;
  status: string;
}

export interface WebSessionResult {
  user: WebSessionUser;
  created: boolean;
  authToken?: string;
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function getAuthCookie(req: NextRequest): string | undefined {
  const cookieFromNext = req.cookies?.get?.('auth_token')?.value;
  if (cookieFromNext) return cookieFromNext;

  const header = req.headers.get('cookie') ?? '';
  const match = header.match(/(?:^|;\s*)auth_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function authCookieOptions() {
  const isProd = (process.env.NODE_ENV ?? '') === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    maxAge: 30 * 86400,
  };
}

export async function getOrCreateWebSession(req: NextRequest): Promise<WebSessionResult> {
  const db = getDb();
  const existingCookie = getAuthCookie(req);

  if (existingCookie) {
    const sessions = await db.query<{ user_id: number }>(
      "SELECT user_id FROM auth_sessions WHERE token = ? AND expires_at > datetime('now')",
      [existingCookie],
    );
    const userId = sessions.results[0]?.user_id;
    if (typeof userId === 'number') {
      await ensureUserPrimaryAgentProfile(userId);
      const users = await db.query<WebSessionUser>(
        'SELECT id, token_balance, status FROM users WHERE id = ?',
        [userId],
      );
      const user = users.results[0];
      if (user) {
        return { user, created: false };
      }
    }
  }

  const insertUser = await db.execute(
    "INSERT INTO users (token_balance, status) VALUES (?, 'active')",
    [PLANS.free_trial.tokens_amount],
  );
  const userId = insertUser.meta?.last_row_id;
  if (!userId) {
    throw new Error('创建用户失败：缺少 last_row_id');
  }

  const token = generateToken();
  const thirtyDays = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
  await db.execute(
    'INSERT INTO auth_sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, thirtyDays],
  );

  const users = await db.query<{ token_balance: number }>(
    'SELECT token_balance FROM users WHERE id = ?',
    [userId],
  );
  const balanceAfter = (users.results[0]?.token_balance as number) ?? PLANS.free_trial.tokens_amount;

  await db.execute(
    `INSERT INTO token_ledger
     (user_id, type, delta_tokens, balance_after, source, source_id, created_at)
     VALUES (?, 'grant', ?, ?, 'free_trial', ?, datetime('now'))`,
    [userId, PLANS.free_trial.tokens_amount, balanceAfter, `web-session:${userId}`],
  );

  await ensureUserPrimaryAgentProfile(userId);

  return {
    user: { id: userId, token_balance: balanceAfter, status: 'active' },
    created: true,
    authToken: token,
  };
}
