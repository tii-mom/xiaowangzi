import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, type AdminRole } from '@/lib/admin-auth';

const ROLES = new Set<AdminRole>(['owner', 'admin', 'support', 'readonly']);

function isRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && ROLES.has(value as AdminRole);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, { minRole: 'owner' });
  if (!admin) {
    return NextResponse.json({ error: '未授权' }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      user_id?: unknown;
      role?: unknown;
      reason?: unknown;
      status?: unknown;
    };

    const userId = Number(body.user_id);
    const role = isRole(body.role) ? body.role : 'admin';
    const status = body.status === 'disabled' ? 'disabled' : 'active';
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: 'user_id_invalid' }, { status: 400 });
    }

    const db = getDb();
    const user = await db.query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
    if (user.results.length === 0) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    await db.batch([
      {
        sql: `INSERT INTO admin_users (user_id, role, status, granted_by, reason, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
              ON CONFLICT(user_id) DO UPDATE SET
                role = excluded.role,
                status = excluded.status,
                granted_by = excluded.granted_by,
                reason = excluded.reason,
                updated_at = datetime('now')`,
        params: [userId, role, status, admin.label, reason],
      },
      {
        sql: `INSERT INTO admin_audit_logs (admin_email, action, target_type, target_id, details)
              VALUES (?, 'admin_user.upsert', 'user', ?, ?)`,
        params: [
          admin.label,
          String(userId),
          JSON.stringify({ role, status, reason }),
        ],
      },
    ]);

    return NextResponse.json({
      ok: true,
      user_id: userId,
      role,
      status,
    });
  } catch (err) {
    console.error('[admin/users]', err);
    return NextResponse.json({ error: 'admin_user_upsert_failed' }, { status: 500 });
  }
}
