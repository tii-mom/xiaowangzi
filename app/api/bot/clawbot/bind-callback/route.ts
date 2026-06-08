import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';

function maskExternalId(id: string | null): string | null {
  if (!id) return null;
  if (id.length <= 6) return '***';
  return `${id.slice(0, 4)}***${id.slice(-3)}`;
}

function getClawbotSecret(): string {
  return getEnv('CLAWBOT_WEBHOOK_SECRET', getEnv('HERMES_WEBHOOK_SECRET'));
}

function verifySignature(req: NextRequest, rawBody: string): boolean {
  const secret = getClawbotSecret();
  if (!secret) return process.env.NODE_ENV !== 'production';

  const timestamp = req.headers.get('x-clawbot-timestamp') ?? '';
  const nonce = req.headers.get('x-clawbot-nonce') ?? '';
  const signature = req.headers.get('x-clawbot-signature') ?? '';
  if (!timestamp || !nonce || !signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${nonce}.${rawBody}`, 'utf8')
    .digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

async function writeSystemEvent(type: string, payload: Record<string, unknown>) {
  try {
    const db = getDb();
    await db.execute('INSERT INTO system_events (type, payload) VALUES (?, ?)', [
      type,
      JSON.stringify(payload),
    ]);
  } catch {
    // Best effort
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifySignature(req, rawBody)) {
      await writeSystemEvent('clawbot.bind_callback.unauthorized', {
        user_agent: req.headers.get('user-agent') ?? 'unknown',
      });
      return NextResponse.json({ ok: false, error: 'signature rejected' }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as {
      ticket?: string;
      providerUserId?: string;
      nickname?: string | null;
      avatarUrl?: string | null;
      source?: string;
    };
    const ticket = String(body.ticket ?? '').trim();
    const providerUserId = String(body.providerUserId ?? '').trim();
    if (!ticket || !providerUserId) {
      return NextResponse.json({ ok: false, error: 'ticket_and_providerUserId_required' }, { status: 400 });
    }

    const db = getDb();
    const ticketRows = await db.query<{
      id: number;
      user_id: number;
      agent_profile_id: number;
      status: string;
      expires_at: string;
    }>(
      "SELECT id, user_id, agent_profile_id, status, expires_at FROM bind_codes WHERE code = ? LIMIT 1",
      [ticket],
    );

    const ticketRow = ticketRows.results[0];
    if (!ticketRow) {
      return NextResponse.json({ ok: false, error: 'ticket_not_found' }, { status: 404 });
    }

    if (ticketRow.status !== 'pending') {
      return NextResponse.json({ ok: false, error: 'ticket_unavailable' }, { status: 409 });
    }

    if (new Date().toISOString() > ticketRow.expires_at) {
      await db.execute(
        "UPDATE bind_codes SET status = 'expired', updated_at = datetime('now') WHERE id = ?",
        [ticketRow.id],
      );
      return NextResponse.json({ ok: false, error: 'ticket_expired' }, { status: 410 });
    }

    const existingExternal = await db.query(
      "SELECT agent_profile_id FROM agent_bindings WHERE channel = 'wechat' AND external_id = ? AND status = 'active' LIMIT 1",
      [providerUserId],
    );
    if (existingExternal.results.length > 0) {
      return NextResponse.json({ ok: false, error: 'wechat_already_bound' }, { status: 409 });
    }

    const existingProfile = await db.query(
      "SELECT external_id FROM agent_bindings WHERE channel = 'wechat' AND agent_profile_id = ? AND status = 'active' LIMIT 1",
      [ticketRow.agent_profile_id],
    );
    if (existingProfile.results.length > 0) {
      return NextResponse.json({ ok: false, error: 'profile_already_bound' }, { status: 409 });
    }

    await db.batch([
      {
        sql: `INSERT INTO agent_bindings
              (agent_profile_id, channel, external_id, status, metadata_json, created_at, updated_at)
              VALUES (?, 'wechat', ?, 'active', ?, datetime('now'), datetime('now'))`,
        params: [
          ticketRow.agent_profile_id,
          providerUserId,
          JSON.stringify({
            provider: 'clawbot',
            nickname: body.nickname ?? null,
            avatarUrl: body.avatarUrl ?? null,
            source: body.source ?? 'clawbot_gateway',
          }),
        ],
      },
      {
        sql: "UPDATE bind_codes SET status = 'consumed', hermes_user_id = ?, consumed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'pending'",
        params: [providerUserId, ticketRow.id],
      },
    ]);

    await writeSystemEvent('clawbot.binding.created', {
      user_id: ticketRow.user_id,
      agent_profile_id: ticketRow.agent_profile_id,
      provider_user_id: maskExternalId(providerUserId),
    });

    return NextResponse.json({
      ok: true,
      action: 'bind_success',
      status: 'bound',
      masked_external_id: maskExternalId(providerUserId),
    });
  } catch (err) {
    console.error('[bot/clawbot/bind-callback]', err);
    return NextResponse.json({ ok: false, error: 'bind_callback_failed' }, { status: 500 });
  }
}
