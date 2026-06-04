import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireEnv } from '@/lib/env';
import { PLANS, planIdToLabel, centsToPriceYuan } from '@/lib/plans';
import { createBufPayOrder } from '@/lib/bufpay';

function generateOrderId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `wxz_${ts}_${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const { plan: planId } = await req.json();

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

    const userId = req.headers.get('x-user-id') ?? 'demo-user';
    const db = getDb();

    const existing = await db.query(
      'SELECT id FROM users WHERE id = ? OR hermes_user_id = ? OR wechat_external_id = ?',
      [userId, userId, userId],
    );
    let dbUserId: number;
    if (existing.results.length === 0) {
      const insert = await db.execute(
        'INSERT INTO users (id, token_balance, status) VALUES (?, 0, ?)',
        [userId, 'active'],
      );
      dbUserId = (insert.meta?.last_row_id ?? 1) as number;
    } else {
      dbUserId = existing.results[0].id as number;
    }

    const orderId = generateOrderId();
    const priceYuan = centsToPriceYuan(plan.amount_cents);

    await db.execute(
      `INSERT INTO payment_orders
       (user_id, order_id, plan, tokens_amount, amount_cents, pay_type, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [dbUserId, orderId, planId, plan.tokens_amount, plan.amount_cents, plan.pay_type],
    );

    const aid = requireEnv('BUFPAY_AID');
    const appSecret = requireEnv('BUFPAY_APP_SECRET');
    const notifyUrl = requireEnv('BUFPAY_NOTIFY_URL');
    const returnUrl = process.env.BUFPAY_RETURN_URL ?? '';

    const bufpayResult = await createBufPayOrder(
      aid,
      {
        name: plan.name,
        pay_type: plan.pay_type,
        price: priceYuan,
        order_id: orderId,
        order_uid: String(dbUserId),
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '创建订单失败' },
      { status: 500 },
    );
  }
}
