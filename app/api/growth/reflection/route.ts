import { NextRequest, NextResponse } from 'next/server';
import { submitGrowthReflection } from '@/lib/growth';
import { getPaymentUser, PaymentAuthError } from '@/lib/payment-user';

export async function POST(req: NextRequest) {
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

    const body = await req.json() as Record<string, unknown>;
    const completedText = stringField(body.completed_text ?? body.completedText);
    const tacitInsight = stringField(body.tacit_insight ?? body.tacitInsight);
    const nextAdjustment = stringField(body.next_adjustment ?? body.nextAdjustment);
    if (completedText.length < 2 || tacitInsight.length < 2 || nextAdjustment.length < 2) {
      return NextResponse.json(
        { error: '请写下完成了什么、学到了什么、下一步怎么调' },
        { status: 400 },
      );
    }

    const today = await submitGrowthReflection({
      userId: user.id,
      completedText,
      tacitInsight,
      nextAdjustment,
    });
    return NextResponse.json({ ok: true, ...today });
  } catch (err) {
    console.error('[growth/reflection]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '提交复盘失败' },
      { status: 500 },
    );
  }
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
