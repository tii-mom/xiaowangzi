import { NextRequest, NextResponse } from 'next/server';
import { getGrowthToday } from '@/lib/growth';
import { getPaymentUser, PaymentAuthError } from '@/lib/payment-user';

export async function GET(req: NextRequest) {
  try {
    let user;
    try {
      user = await getPaymentUser(req);
    } catch (err) {
      if (err instanceof PaymentAuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    const today = await getGrowthToday(user.id);
    return NextResponse.json(today);
  } catch (err) {
    console.error('[growth/today]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '获取成长旅程失败' },
      { status: 500 },
    );
  }
}
