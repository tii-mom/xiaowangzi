import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * Hermes Webhook 回调
 *
 * 接收 Hermes Agent 推送的微信消息事件。
 * 主要处理：用户发送绑定码 → 完成 user ↔ hermes_user_id 绑定。
 *
 * Hermes 原生 webhook 格式未验证，当前实现基于常见 bot 平台假设。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    console.log('[webhook/hermes] received:', JSON.stringify(body).slice(0, 500));

    const eventType = body.event_type ?? body.type ?? 'unknown';
    const message = body.message ?? body.text ?? body.content ?? '';
    const hermesUserId = body.user_id ?? body.from_user ?? body.sender ?? '';

    if (!hermesUserId) {
      console.error('[webhook/hermes] missing user_id in payload');
      return NextResponse.json({ error: 'missing user_id' }, { status: 400 });
    }

    const db = getDb();

    const bindMatch = (message as string).match(/^[A-F0-9]{8}$/);
    if (bindMatch) {
      const code = bindMatch[0];
      const codes = await db.query(
        "SELECT * FROM bind_codes WHERE code = ? AND status = 'pending' AND expires_at > datetime('now')",
        [code],
      );

      if (codes.results.length > 0) {
        const bindCode = codes.results[0] as Record<string, unknown>;

        await db.execute(
          "UPDATE bind_codes SET status = 'used', hermes_user_id = ? WHERE id = ?",
          [hermesUserId, bindCode.id],
        );

        const userId = bindCode.user_id as number;
        await db.execute(
          'UPDATE users SET hermes_user_id = ?, updated_at = datetime(\'now\') WHERE id = ?',
          [hermesUserId, userId],
        );

        await db.execute(
          "INSERT INTO user_agents (user_id, status) VALUES (?, 'pending')",
          [userId],
        );

        await db.execute(
          'INSERT INTO system_events (type, payload) VALUES (?, ?)',
          ['bind.success', JSON.stringify({ user_id: userId, hermes_user_id: hermesUserId, code })]
        );

        console.log(`[webhook/hermes] bind success: user=${userId}, hermes=${hermesUserId}`);
      } else {
        console.log(`[webhook/hermes] invalid/expired bind code: ${code}`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[webhook/hermes]', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
