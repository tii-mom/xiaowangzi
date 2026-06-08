import type { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';

export type AdminRole = 'owner' | 'admin' | 'support' | 'readonly';

export interface AdminPrincipal {
  method: 'admin_token' | 'session';
  userId: number | null;
  role: AdminRole;
  label: string;
}

function roleRank(role: AdminRole): number {
  switch (role) {
    case 'owner':
      return 4;
    case 'admin':
      return 3;
    case 'support':
      return 2;
    case 'readonly':
      return 1;
    default:
      return 0;
  }
}

function tokenFromRequest(req: NextRequest): string {
  const header = req.headers.get('x-admin-token');
  if (header) return header;

  const auth = req.headers.get('authorization');
  if (!auth) return '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : auth;
}

async function sessionUserId(req: NextRequest): Promise<number | null> {
  const cookie = req.cookies.get('auth_token')?.value;
  if (!cookie) return null;

  const sessions = await getDb().query<{ user_id: number }>(
    "SELECT user_id FROM auth_sessions WHERE token = ? AND expires_at > datetime('now') LIMIT 1",
    [cookie],
  );
  return sessions.results[0]?.user_id ?? null;
}

async function getSessionAdmin(userId: number, minRole: AdminRole): Promise<AdminPrincipal | null> {
  const rows = await getDb().query<{ role: AdminRole; status: string }>(
    "SELECT role, status FROM admin_users WHERE user_id = ? AND status = 'active' LIMIT 1",
    [userId],
  );
  const row = rows.results[0];
  if (!row || roleRank(row.role) < roleRank(minRole)) return null;

  return {
    method: 'session',
    userId,
    role: row.role,
    label: `user:${userId}:${row.role}`,
  };
}

export async function requireAdmin(
  req: NextRequest,
  options: { minRole?: AdminRole } = {},
): Promise<AdminPrincipal | null> {
  const minRole = options.minRole ?? 'readonly';
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const adminToken = getEnv('ADMIN_TOKEN');
  const requestToken = tokenFromRequest(req);

  if (adminToken && requestToken === adminToken) {
    return {
      method: 'admin_token',
      userId: null,
      role: 'owner',
      label: 'ADMIN_TOKEN',
    };
  }

  const userId = await sessionUserId(req);
  if (userId) {
    const sessionAdmin = await getSessionAdmin(userId, minRole);
    if (sessionAdmin) return sessionAdmin;
  }

  if (!adminToken && nodeEnv !== 'production') {
    console.warn('[admin] ADMIN_TOKEN not configured and no admin_users match - accepting in dev');
    return {
      method: 'admin_token',
      userId: null,
      role: 'owner',
      label: 'dev:no-admin-token',
    };
  }

  return null;
}
