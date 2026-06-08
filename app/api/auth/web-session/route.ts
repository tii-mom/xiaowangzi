import { NextRequest, NextResponse } from 'next/server';
import { authCookieOptions, getOrCreateWebSession } from '@/lib/web-session';

export async function POST(req: NextRequest) {
  try {
    const session = await getOrCreateWebSession(req);

    const response = NextResponse.json({
      user: session.user,
      created: session.created,
    });

    if (session.authToken) {
      response.cookies.set('auth_token', session.authToken, authCookieOptions());
    }

    return response;
  } catch (err) {
    console.error('[auth/web-session]', err);
    return NextResponse.json(
      { error: '创建会话失败' },
      { status: 500 },
    );
  }
}
