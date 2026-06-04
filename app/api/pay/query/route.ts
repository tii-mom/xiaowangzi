import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { queryBufPayOrder } from '@/lib/bufpay';
import { requireEnv } from '@/lib/env';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const aoid = url.searchParams.get('aoid');
    const orderId = url.searchParams.get('order_id');

    if (!aoid && !orderId) {
      return NextResponse.json(
        { error: '需要 aoid 或 order_id 参数' },
        { status: 400 },
      );
    }

    const db = getDb();

    let order: Record<string, unknown> | undefined;
    if (orderId) {
      const result = await db.query(
        'SELECT * FROM payment_orders WHERE order_id = ?',
        [orderId],
      );
      order = result.results[0] as Record<string, unknown> | undefined;
    } else if (aoid) {
      const result = await db.query(
        'SELECT * FROM payment_orders WHERE bufpay_aoid = ?',
        [aoid],
      );
      order = result.results[0] as Record<string, unknown> | undefined;
    }

    if (!order) {
      return NextResponse.json({ status: 'not_exist' });
    }

    const localStatus = order.status as string;

    if (localStatus === 'paid') {
      return NextResponse.json({
        status: 'paid',
        order_id: order.order_id,
        plan: order.plan,
        tokens_amount: order.tokens_amount,
        amount_cents: order.amount_cents,
      });
    }

    const dbAoid = (order.bufpay_aoid as string) ?? '';
    if (dbAoid) {
      try {
        const bufpayResult = await queryBufPayOrder(dbAoid);

        if (bufpayResult.status === 'success' || bufpayResult.status === 'payed') {
          return NextResponse.json({
            status: 'paid',
            raw_bufpay_status: bufpayResult.status,
            order_id: order.order_id,
          });
        }
        return NextResponse.json({
          status: 'pending',
          raw_bufpay_status: bufpayResult.status,
          order_id: order.order_id,
        });
      } catch {
        // BufPay query failed, fall through to local status
      }
    }

    return NextResponse.json({
      status: localStatus,
      order_id: order.order_id,
      plan: order.plan,
    });
  } catch (err) {
    console.error('[query]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '查询失败' },
      { status: 500 },
    );
  }
}
