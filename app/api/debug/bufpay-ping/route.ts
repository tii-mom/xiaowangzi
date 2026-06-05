import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  return handlePing(req);
}

export async function POST(req: NextRequest) {
  return handlePing(req);
}

async function handlePing(req: NextRequest) {
  const appEnv = process.env.APP_ENV;
  const deployEnv = process.env.DEPLOY_ENV;
  const appUrl = process.env.APP_URL ?? '';
  const isWanLatProduction = appUrl === 'https://wan.lat' || appUrl === 'https://www.wan.lat';
  const isProduction = appEnv === 'production' || deployEnv === 'production' || isWanLatProduction;

  // 生产环境返回 403
  if (isProduction) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const method = req.method;
    const contentType = req.headers.get('content-type') ?? '';
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      // 排除包含敏感隐私信息的 header
      if (key !== 'authorization' && key !== 'cookie') {
        headers[key] = value;
      }
    });

    let bodyText = '';
    if (method === 'POST') {
      try {
        bodyText = await req.text();
      } catch {
        bodyText = '(unable to read body)';
      }
    }

    // 记录请求摘要到 system_events
    const db = getDb();
    await db.execute(
      "INSERT INTO system_events (type, payload) VALUES ('debug.bufpay_ping', ?)",
      [
        JSON.stringify({
          method,
          contentType,
          headers,
          body_summary: bodyText.slice(0, 1000),
          client_ip: req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown',
          timestamp: new Date().toISOString(),
        }),
      ],
    );

    return new NextResponse('ok', { status: 200 });
  } catch (err) {
    console.error('[bufpay-ping] error:', err);
    return new NextResponse('internal error', { status: 500 });
  }
}
