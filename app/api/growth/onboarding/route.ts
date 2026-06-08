import { NextRequest, NextResponse } from 'next/server';
import { createGrowthOnboarding } from '@/lib/growth';
import { authCookieOptions, getOrCreateWebSession } from '@/lib/web-session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const changeTarget = stringField(body.change_target ?? body.changeTarget ?? body.target);
    const antiVision = stringField(body.anti_vision ?? body.antiVision);
    const dailyLever = stringField(body.daily_lever ?? body.dailyLever);
    const sourceShareSlug = stringField(body.share_artifact_id ?? body.source_share_slug, false);

    if (changeTarget.length < 2 || antiVision.length < 2 || dailyLever.length < 2) {
      return NextResponse.json(
        { error: '请完整填写想改变的事、反愿景和今日最小行动' },
        { status: 400 },
      );
    }

    const session = await getOrCreateWebSession(req);
    const today = await createGrowthOnboarding({
      userId: session.user.id,
      changeTarget,
      antiVision,
      dailyLever,
      sourceShareSlug,
    });

    const response = NextResponse.json({
      ok: true,
      user: session.user,
      session_created: session.created,
      evolution_map: today,
    });

    if (session.authToken) {
      response.cookies.set('auth_token', session.authToken, authCookieOptions());
    }
    return response;
  } catch (err) {
    console.error('[growth/onboarding]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '生成进化地图失败' },
      { status: 500 },
    );
  }
}

function stringField(value: unknown, required = true): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return required ? text : text || '';
}
