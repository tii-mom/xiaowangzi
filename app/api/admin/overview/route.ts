import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, { minRole: 'readonly' });
  if (!admin) {
    return NextResponse.json({ error: '未授权' }, { status: 403 });
  }

  try {
    const db = getDb();

    const usersCount = await db.query('SELECT COUNT(*) as cnt FROM users', []);
    const ordersCount = await db.query('SELECT COUNT(*) as cnt FROM payment_orders', []);
    const paidOrders = await db.query("SELECT COUNT(*) as cnt FROM payment_orders WHERE status = 'paid'", []);
    const revenue = await db.query(
      "SELECT COALESCE(SUM(amount_cents), 0) as total FROM payment_orders WHERE status = 'paid'",
      [],
    );
    const tokenPurchased = await db.query(
      "SELECT COALESCE(SUM(delta_tokens), 0) as total FROM token_ledger WHERE type = 'purchase'",
      [],
    );
    const tokenUsed = await db.query(
      "SELECT COALESCE(SUM(ABS(delta_tokens)), 0) as total FROM token_ledger WHERE type = 'usage'",
      [],
    );
    const recentEvents = await db.query(
      'SELECT type, payload, created_at FROM system_events ORDER BY created_at DESC LIMIT 20',
      [],
    );
    const recentOrders = await db.query(
      'SELECT order_id, plan, amount_cents, status, created_at FROM payment_orders ORDER BY created_at DESC LIMIT 10',
      [],
    );
    const recentUsers = await db.query(
      'SELECT id, token_balance, status, created_at FROM users ORDER BY created_at DESC LIMIT 10',
      [],
    );

    return NextResponse.json({
      admin: {
        method: admin.method,
        user_id: admin.userId,
        role: admin.role,
      },
      users_count: (usersCount.results[0] as Record<string, unknown>)?.cnt,
      orders_count: (ordersCount.results[0] as Record<string, unknown>)?.cnt,
      paid_orders_count: (paidOrders.results[0] as Record<string, unknown>)?.cnt,
      revenue_cents: (revenue.results[0] as Record<string, unknown>)?.total,
      token_purchased_sum: (tokenPurchased.results[0] as Record<string, unknown>)?.total,
      token_used_sum: (tokenUsed.results[0] as Record<string, unknown>)?.total,
      recent_events: recentEvents.results,
      recent_orders: recentOrders.results,
      recent_users: recentUsers.results,
    });
  } catch (err) {
    console.error('[admin/overview]', err);
    return NextResponse.json({ error: '获取管理数据失败' }, { status: 500 });
  }
}
