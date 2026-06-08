import { NextRequest, NextResponse } from 'next/server';
import { createGrowthShareArtifact, getPublicShareArtifact } from '@/lib/growth';
import { getPaymentUser, PaymentAuthError } from '@/lib/payment-user';

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug')?.trim();
    if (!slug) {
      return NextResponse.json({ error: 'slug required' }, { status: 400 });
    }

    const artifact = await getPublicShareArtifact(slug, { incrementView: true });
    if (!artifact) {
      return NextResponse.json({ error: 'share card not found' }, { status: 404 });
    }

    return NextResponse.json({
      artifact: {
        slug: artifact.slug,
        title: artifact.title,
        goal_theme: artifact.goal_theme,
        day_number: artifact.day_number,
        today_action: artifact.today_action,
        progress_note: artifact.progress_note,
        public_summary: artifact.public_summary,
      },
    });
  } catch (err) {
    console.error('[share/growth-card:GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '读取分享卡失败' },
      { status: 500 },
    );
  }
}

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

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const artifact = await createGrowthShareArtifact({
      userId: user.id,
      progressNote: typeof body.progress_note === 'string' ? body.progress_note : null,
    });
    const appUrl = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
    const publicUrl = `${appUrl.replace(/\/$/, '')}/s/${artifact.slug}`;

    return NextResponse.json({
      ok: true,
      artifact: {
        slug: artifact.slug,
        title: artifact.title,
        goal_theme: artifact.goal_theme,
        day_number: artifact.day_number,
        today_action: artifact.today_action,
        progress_note: artifact.progress_note,
        public_summary: artifact.public_summary,
      },
      public_url: publicUrl,
    });
  } catch (err) {
    console.error('[share/growth-card]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '生成分享卡失败' },
      { status: 500 },
    );
  }
}
