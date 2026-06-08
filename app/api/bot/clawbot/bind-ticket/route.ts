import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateClawbotBindTicket } from '@/lib/bind';
import { getEnv } from '@/lib/env';
import { getPaymentUser, PaymentAuthError } from '@/lib/payment-user';
import { ensureUserPrimaryAgentProfile } from '@/lib/agent-profile';

function getClawbotBindBaseUrl(): string {
  return getEnv('CLAWBOT_BIND_BASE_URL', 'https://wechat.tai.lat/xms/wechat/bind').replace(/\/$/, '');
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

    const db = getDb();
    await ensureUserPrimaryAgentProfile(user.id);

    const profileRes = await db.query<{ id: number }>(
      "SELECT id FROM agent_profiles WHERE user_id = ? AND is_primary = 1 AND status = 'active' LIMIT 1",
      [user.id],
    );
    const profileId = profileRes.results[0]?.id;
    if (!profileId) {
      return NextResponse.json({ error: '用户 Agent Profile 初始化失败' }, { status: 500 });
    }

    await db.execute(
      "UPDATE bind_codes SET status = 'revoked', updated_at = datetime('now') WHERE user_id = ? AND status = 'pending'",
      [user.id],
    );

    const ticket = generateClawbotBindTicket();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await db.execute(
      `INSERT INTO bind_codes
       (code, user_id, agent_profile_id, channel, status, expires_at, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, 'wechat', 'pending', ?, ?, datetime('now'), datetime('now'))`,
      [
        ticket,
        user.id,
        profileId,
        expiresAt,
        JSON.stringify({ provider: 'clawbot', type: 'scan_ticket' }),
      ],
    );

    const bindUrl = new URL(getClawbotBindBaseUrl());
    bindUrl.searchParams.set('ticket', ticket);

    return NextResponse.json({
      ticket,
      status: 'pending',
      expires_at: expiresAt,
      bind_url: bindUrl.toString(),
      provider: 'clawbot',
    });
  } catch (err) {
    console.error('[bot/clawbot/bind-ticket]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '创建 Clawbot 绑定 ticket 失败' },
      { status: 500 },
    );
  }
}
