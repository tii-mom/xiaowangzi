import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAgentManager } from '@/lib/agent-manager';

function validateWebhookSecret(req: NextRequest): boolean {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const secret = process.env.HERMES_WEBHOOK_SECRET;

  if (!secret || secret.trim() === '') {
    if (nodeEnv === 'production') {
      return false;
    }
    console.warn('[webhook/hermes] HERMES_WEBHOOK_SECRET not set — accepting all requests in dev');
    return true;
  }

  const headerSecret = req.headers.get('x-hermes-secret');
  if (headerSecret && headerSecret === secret) return true;

  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (token === secret) return true;
  }

  return false;
}

async function writeSystemEvent(type: string, payload: Record<string, unknown>) {
  try {
    const db = getDb();
    await db.execute('INSERT INTO system_events (type, payload) VALUES (?, ?)', [type, JSON.stringify(payload)]);
  } catch { /* best-effort */ }
}

export async function POST(req: NextRequest) {
  try {
    if (!validateWebhookSecret(req)) {
      console.error('[webhook/hermes] secret validation failed');
      return new NextResponse('forbidden', { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    console.log('[webhook/hermes] received');

    const message = body.message ?? body.text ?? body.content ?? '';
    const hermesUserId = body.user_id ?? body.from_user ?? body.sender ?? '';

    if (!hermesUserId) {
      console.error('[webhook/hermes] missing user_id');
      return NextResponse.json({ error: 'missing user_id' }, { status: 400 });
    }

    const db = getDb();
    const normalizedMessage = String(message).trim().toUpperCase();
    const bindMatch = normalizedMessage.match(/^[A-F0-9]{8}$/);

    if (bindMatch) {
      const code = bindMatch[0];
      const codes = await db.query(
        "SELECT * FROM bind_codes WHERE code = ? AND status = 'pending' AND expires_at > datetime('now')",
        [code],
      );

      if (codes.results.length > 0) {
        const bindCode = codes.results[0] as Record<string, unknown>;
        const userId = bindCode.user_id as number;

        const updateResult = await db.execute(
          "UPDATE bind_codes SET status = 'used', hermes_user_id = ? WHERE id = ? AND status = 'pending'",
          [hermesUserId, bindCode.id],
        );

        if ((updateResult.meta?.changes ?? 0) === 0) {
          await writeSystemEvent('bind.already_used', { code });
          console.log(`[webhook/hermes] bind code already used: ${code}`);
          return NextResponse.json({ ok: true });
        }

        const existingUsers = await db.query(
          'SELECT hermes_user_id FROM users WHERE id = ?', [userId],
        );
        const currentHermesId = (existingUsers.results[0]?.hermes_user_id as string) ?? null;

        if (currentHermesId) {
          if (currentHermesId === hermesUserId) {
            await writeSystemEvent('bind.already_bound_same', { user_id: userId, hermes_user_id: hermesUserId });
            return NextResponse.json({ ok: true });
          }
          await writeSystemEvent('bind.conflict', { user_id: userId, existing: currentHermesId, attempted: hermesUserId });
          console.error(`[webhook/hermes] bind conflict: user=${userId} existing=${currentHermesId} attempted=${hermesUserId}`);
          return NextResponse.json({ ok: true });
        }

        await db.execute(
          'UPDATE users SET hermes_user_id = ?, updated_at = datetime(\'now\') WHERE id = ?',
          [hermesUserId, userId],
        );

        try {
          await getAgentManager().createUserAgent(userId);
        } catch (agentErr) {
          console.error('[webhook/hermes] agent creation failed:', agentErr);
        }

        await writeSystemEvent('bind.success', { user_id: userId, hermes_user_id: hermesUserId });
        console.log(`[webhook/hermes] bind success: user=${userId}`);
      } else {
        await writeSystemEvent('bind.invalid_code', { code });
        console.log(`[webhook/hermes] invalid/expired code`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[webhook/hermes]', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
