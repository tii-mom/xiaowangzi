import { NextRequest, NextResponse } from 'next/server';
import { requireEnv } from '@/lib/env';
import { verifyNotifySign } from '@/lib/bufpay';
import { finalizePaidOrder } from '@/lib/payment-finalizer';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let body: Record<string, string>;

    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    }

    const aoid = body.aoid ?? '';
    const order_id = body.order_id ?? '';
    const order_uid = body.order_uid ?? '';
    const price = body.price ?? '';
    const pay_price = body.pay_price ?? '';
    const sign = body.sign ?? '';

    if (!aoid || !order_id || !price || !sign) {
      return new NextResponse('missing fields', { status: 400 });
    }

    const appSecret = requireEnv('BUFPAY_APP_SECRET');

    const valid = verifyNotifySign(
      { aoid, order_id, order_uid, price, pay_price, sign },
      appSecret,
    );

    if (!valid) {
      return new NextResponse('sign error', { status: 400 });
    }

    const result = await finalizePaidOrder({
      order_id,
      aoid,
      order_uid,
      price,
      pay_price,
      raw_notify_json: JSON.stringify(body),
    });

    if (result.status === 'ok' || result.status === 'already_finalized') {
      return new NextResponse('ok', { status: 200 });
    }

    console.error('[notify] finalize failed:', result);
    return new NextResponse(result.message ?? 'failed', { status: 500 });
  } catch (err) {
    console.error('[notify] error', err);
    return new NextResponse('internal error', { status: 500 });
  }
}
