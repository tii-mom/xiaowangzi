import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { queryBufPayOrder } from '@/lib/bufpay';
import { finalizePaidOrder } from '@/lib/payment-finalizer';
import { centsToPriceYuan } from '@/lib/plans';

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

    if (order.status === 'paid') {
      return NextResponse.json({
        status: 'paid',
        order_id: order.order_id,
        plan: order.plan,
        tokens_amount: order.tokens_amount,
        amount_cents: order.amount_cents,
      });
    }

    const dbAoid = (order.bufpay_aoid as string) ?? '';
    const effectiveAoid = aoid ?? dbAoid;

    if (effectiveAoid) {
      try {
        const bufpayResult = await queryBufPayOrder(effectiveAoid);

        if (bufpayResult.status === 'success' || bufpayResult.status === 'payed') {
          const priceYuan = centsToPriceYuan(Number(order.amount_cents));
          const finalizeResult = await finalizePaidOrder({
            order_id: (order.order_id as string) ?? '',
            aoid: effectiveAoid,
            order_uid: String(order.user_id),
            price: priceYuan,
            pay_price: priceYuan,
          });

          if (finalizeResult.status === 'ok' || finalizeResult.status === 'already_finalized') {
            const refreshed = await db.query(
              'SELECT * FROM payment_orders WHERE order_id = ?',
              [order.order_id],
            );
            const refreshedOrder = refreshed.results[0] as Record<string, unknown> | undefined;
            return NextResponse.json({
              status: refreshedOrder?.status === 'paid' ? 'paid' : 'pending',
              order_id: order.order_id,
              plan: refreshedOrder?.plan ?? order.plan,
              tokens_amount: refreshedOrder?.tokens_amount ?? order.tokens_amount,
              amount_cents: refreshedOrder?.amount_cents ?? order.amount_cents,
            });
          }
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
      status: order.status,
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
