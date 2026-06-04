import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'xiaowangzi',
    time: new Date().toISOString(),
    version: '0.1.0',
  });
}
