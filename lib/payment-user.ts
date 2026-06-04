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
  const isDebug = process.env.INTERNAL_PAYMENT_DEBUG === 'true';

  const fromSession = await getBySession(req);
  if (fromSession) return fromSession;

  if (isProd && !isDebug) {
    throw new PaymentAuthError(
      '未登录或未绑定用户，请先完成绑定后再充值',
      401,
    );
  }

  if (!isProd || isDebug) {
    const fromHeader = getByHeader(req);
    if (fromHeader) return fromHeader;
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

async function getBySession(req: NextRequest): Promise<PaymentUser | null> {
  const cookie = req.cookies.get('auth_token')?.value;
  if (!cookie) return null;

  const sessions = await getDb().query(
    'SELECT user_id FROM auth_sessions WHERE token = ? AND expires_at > datetime(\'now\')',
    [cookie],
  );
  if (sessions.results.length === 0) return null;

  const userId = sessions.results[0].user_id as number;
  const users = await getDb().query(
    'SELECT id, token_balance, status FROM users WHERE id = ?',
    [userId],
  );
  if (users.results.length === 0) return null;

  return users.results[0] as unknown as PaymentUser;
}

function getByHeader(req: NextRequest): PaymentUser | null {
  const headerUserId = req.headers.get('x-user-id');
  if (!headerUserId || headerUserId === 'demo-user') return null;

  const id = Number(headerUserId);
  if (Number.isNaN(id) || id <= 0) return null;

  throw new PaymentAuthError(
    'x-user-id header is only allowed in development/test or with INTERNAL_PAYMENT_DEBUG=true',
    401,
  );
}

export class PaymentAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PaymentAuthError';
    this.status = status;
  }
}
