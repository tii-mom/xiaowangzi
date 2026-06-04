import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireEnv } from '@/lib/env';
import { PLANS, centsToPriceYuan } from '@/lib/plans';
import { createBufPayOrder } from '@/lib/bufpay';
import { getPaymentUser, PaymentAuthError } from '@/lib/payment-user';

function generateOrderId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `wxz_${ts}_${rand}`;
}

export async function POST(req: NextRequest) {
  let orderId: string | null = null;

  try {
    const body = await req.json() as { plan?: string };
    const planId = body.plan;

    if (!planId || !PLANS[planId]) {
      return NextResponse.json(
        { error: `无效的套餐: ${planId}` },
        { status: 400 },
      );
    }

    const plan = PLANS[planId];
    if (plan.amount_cents === 0) {
      return NextResponse.json(
        { error: '免费套餐无需支付，请直接绑定即可激活' },
        { status: 400 },
      );
    }

    let user;
    try {
      user = await getPaymentUser(req);
    } catch (err) {
      if (err instanceof PaymentAuthError) {
        return NextResponse.json(
          { error: err.message },
          { status: err.status },
        );
      }
      throw err;
    }

    const aid = requireEnv('BUFPAY_AID');
    const appSecret = requireEnv('BUFPAY_APP_SECRET');
    const notifyUrl = requireEnv('BUFPAY_NOTIFY_URL');
    const returnUrl = process.env.BUFPAY_RETURN_URL ?? '';

    const db = getDb();
    const priceYuan = centsToPriceYuan(plan.amount_cents);
    orderId = generateOrderId();

    await db.execute(
      `INSERT INTO payment_orders
       (user_id, order_id, plan, tokens_amount, amount_cents, pay_type, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [user.id, orderId, planId, plan.tokens_amount, plan.amount_cents, plan.pay_type],
    );

    const bufpayResult = await createBufPayOrder(
      aid,
      {
        name: plan.name,
        pay_type: plan.pay_type,
        price: priceYuan,
        order_id: orderId,
        order_uid: String(user.id),
        notify_url: notifyUrl,
        return_url: returnUrl,
      },
      appSecret,
    );

    await db.execute(
      'UPDATE payment_orders SET bufpay_aoid = ? WHERE order_id = ?',
      [bufpayResult.aoid, orderId],
    );

    return NextResponse.json({
      order_id: orderId,
      aoid: bufpayResult.aoid,
      pay_type: bufpayResult.pay_type,
      price: bufpayResult.price,
      qr_price: bufpayResult.qr_price,
      qr: bufpayResult.qr,
      qr_img: bufpayResult.qr_img,
      expires_in: bufpayResult.expires_in,
      plan: planId,
      plan_name: plan.name,
    });
  } catch (err) {
    console.error('[create-order]', err);

    if (orderId) {
      try {
        const db = getDb();
        await db.execute(
          "UPDATE payment_orders SET status = 'failed' WHERE order_id = ? AND status = 'pending'",
          [orderId],
        );
        await db.execute(
          "INSERT INTO system_events (type, payload) VALUES ('payment.create_failed', ?)",
          [JSON.stringify({ order_id: orderId, error: err instanceof Error ? err.message : String(err) })],
        );
      } catch (logErr) {
        console.error('[create-order] failed to log failure:', logErr);
      }
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : '创建订单失败' },
      { status: 500 },
    );
  }
}
