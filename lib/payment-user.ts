import type { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export interface PaymentUser {
  id: number;
  token_balance: number;
  status: string;
}

export async function getPaymentUser(req: NextRequest): Promise<PaymentUser> {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';

  const existing = await dbQueryForUser(req);

  if (existing) {
    return existing;
  }

  if (isProd) {
    throw new PaymentAuthError(
      '未登录或未绑定用户，请先完成绑定后再充值',
      401,
    );
  }

  const devId = 1;
  const users = await getDb().query(
    'SELECT id, token_balance, status FROM users WHERE id = ?',
    [devId],
  );

  if (users.results.length > 0) {
    return users.results[0] as unknown as PaymentUser;
  }

  await getDb().execute(
    'INSERT INTO users (id, token_balance, status) VALUES (?, 0, ?)',
    [devId, 'active'],
  );

  return { id: devId, token_balance: 0, status: 'active' };
}

async function dbQueryForUser(req: NextRequest): Promise<PaymentUser | null> {
  const cookie = req.cookies.get('auth_token')?.value;
  if (cookie) {
    const sessions = await getDb().query(
      'SELECT user_id FROM auth_sessions WHERE token = ? AND expires_at > datetime(\'now\')',
      [cookie],
    );
    if (sessions.results.length > 0) {
      const userId = sessions.results[0].user_id as number;
      const users = await getDb().query(
        'SELECT id, token_balance, status FROM users WHERE id = ?',
        [userId],
      );
      if (users.results.length > 0) {
        return users.results[0] as unknown as PaymentUser;
      }
    }
  }

  const headerUserId = req.headers.get('x-user-id');
  if (headerUserId && headerUserId !== 'demo-user') {
    const id = Number(headerUserId);
    if (!Number.isNaN(id) && id > 0) {
      const users = await getDb().query(
        'SELECT id, token_balance, status FROM users WHERE id = ?',
        [id],
      );
      if (users.results.length > 0) {
        return users.results[0] as unknown as PaymentUser;
      }
    }
  }

  return null;
}

export class PaymentAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PaymentAuthError';
    this.status = status;
  }
}
