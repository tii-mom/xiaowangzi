import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';

function maskExternalId(id: string | null): string | null {
  if (!id) return null;
  if (id.length <= 6) return '***';
  return `${id.slice(0, 4)}***${id.slice(-3)}`;
}

function validateWebhookSecret(req: NextRequest): boolean {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const secret = getEnv('HERMES_WEBHOOK_SECRET');

  if (!secret || secret.trim() === '') {
    if (nodeEnv === 'production') {
      return false;
    }
    console.warn('[webhook/hermes] HERMES_WEBHOOK_SECRET not set — accepting all requests in dev');
    return true;
  }

  const headerSecret = req.headers.get('x-hermes-secret');
  if (headerSecret && headerSecret === secret) return true;

  return false;
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
    // 1. 鉴权校验
    if (!validateWebhookSecret(req)) {
      console.error('[webhook/hermes] secret validation failed');
      await writeSystemEvent('hermes.webhook.unauthorized', {
        ip: req.headers.get('x-real-ip') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      });
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const messageId = String(body.message_id ?? '');
    const hermesUserId = String(body.hermes_user_id ?? '');
    const text = String(body.text ?? '').trim();

    // 2. 报文必填校验
    if (!messageId || !hermesUserId || !text) {
      console.error('[webhook/hermes] missing required fields');
      return NextResponse.json({ error: 'missing message_id, hermes_user_id, or text' }, { status: 400 });
    }

    const db = getDb();
    const textPreview = text.slice(0, 20);

    // 3. 消息去重，保证幂等性
    const insertMessage = await db.execute(
      "INSERT OR IGNORE INTO hermes_messages (message_id, hermes_user_id, message_type, text_preview, status) VALUES (?, ?, 'text', ?, 'received')",
      [messageId, hermesUserId, textPreview]
    );

    if ((insertMessage.meta?.changes ?? 0) === 0) {
      await writeSystemEvent('hermes.message.duplicate', {
        message_id: messageId,
        hermes_user_id: maskExternalId(hermesUserId)
      });
      return NextResponse.json({
        ok: true,
        action: 'duplicate',
        reply: '该消息已处理'
      });
    }

    const normalizedCode = text.toUpperCase();
    const isCodeFormat = /^[A-F0-9]{8}$/.test(normalizedCode);

    if (!isCodeFormat) {
      // 非绑定码格式，由于本 PR 只处理绑定消息，忽略并返回 not_found
      await db.execute(
        "UPDATE hermes_messages SET status = 'ignored', action = 'bind_code_not_found', processed_at = datetime('now') WHERE message_id = ?",
        [messageId]
      );
      await writeSystemEvent('hermes.bind_code.not_found', {
        message_id: messageId,
        hermes_user_id: maskExternalId(hermesUserId)
      });
      return NextResponse.json({
        ok: false,
        action: 'bind_code_not_found',
        reply: '绑定码未找到，请确认输入是否正确。'
      });
    }

    // 4. 查找绑定码记录
    const codes = await db.query(
      "SELECT * FROM bind_codes WHERE code = ?",
      [normalizedCode]
    );

    if (codes.results.length === 0) {
      await db.execute(
        "UPDATE hermes_messages SET status = 'ignored', action = 'bind_code_not_found', processed_at = datetime('now') WHERE message_id = ?",
        [messageId]
      );
      await writeSystemEvent('hermes.bind_code.not_found', {
        message_id: messageId,
        code_preview: `**${normalizedCode.slice(-2)}`,
        hermes_user_id: maskExternalId(hermesUserId)
      });
      return NextResponse.json({
        ok: false,
        action: 'bind_code_not_found',
        reply: '绑定码不存在，请登录网页重新生成。'
      });
    }

    const bindCodeRow = codes.results[0] as Record<string, unknown>;
    const codeId = bindCodeRow.id as number;
    const userId = bindCodeRow.user_id as number;
    const profileId = bindCodeRow.agent_profile_id as number;
    let status = bindCodeRow.status as string;
    const expiresAt = bindCodeRow.expires_at as string;

    // 5. 校验绑定码状态与过期
    if (status === 'pending' && new Date().toISOString() > expiresAt) {
      await db.execute(
        "UPDATE bind_codes SET status = 'expired', updated_at = datetime('now') WHERE id = ?",
        [codeId]
      );
      status = 'expired';
    }

    if (status === 'expired') {
      await db.execute(
        "UPDATE hermes_messages SET status = 'failed', action = 'bind_code_expired', processed_at = datetime('now') WHERE message_id = ?",
        [messageId]
      );
      await writeSystemEvent('hermes.bind_code.expired', {
        message_id: messageId,
        code_preview: `**${normalizedCode.slice(-2)}`,
        hermes_user_id: maskExternalId(hermesUserId)
      });
      return NextResponse.json({
        ok: false,
        action: 'bind_code_expired',
        reply: '该绑定码已过期，请在网页重新生成。'
      });
    }

    if (status === 'consumed' || status === 'revoked') {
      await db.execute(
        "UPDATE hermes_messages SET status = 'failed', action = 'bind_code_unavailable', processed_at = datetime('now') WHERE message_id = ?",
        [messageId]
      );
      await writeSystemEvent('hermes.bind_code.unavailable', {
        message_id: messageId,
        code_preview: `**${normalizedCode.slice(-2)}`,
        status: status,
        hermes_user_id: maskExternalId(hermesUserId)
      });
      return NextResponse.json({
        ok: false,
        action: 'bind_code_unavailable',
        reply: '该绑定码已失效或已被使用，请重新生成。'
      });
    }

    // 6. 冲突防重校验 (WeChat 双重一对一绑定校验)
    
    // Conflict A: 检查此 hermes_user_id 是否已绑定其他 profile
    const existingBindingForWeChat = await db.query(
      "SELECT id, agent_profile_id FROM agent_bindings WHERE external_id = ? AND channel = 'wechat' AND status = 'active' LIMIT 1",
      [hermesUserId]
    );

    if (existingBindingForWeChat.results.length > 0) {
      const conflictBinding = existingBindingForWeChat.results[0] as Record<string, unknown>;
      await db.execute(
        "UPDATE hermes_messages SET status = 'failed', action = 'bind_conflict', processed_at = datetime('now') WHERE message_id = ?",
        [messageId]
      );
      await writeSystemEvent('hermes.bind_code.conflict', {
        message_id: messageId,
        code_preview: `**${normalizedCode.slice(-2)}`,
        hermes_user_id: maskExternalId(hermesUserId),
        conflict_profile_id: conflictBinding.agent_profile_id
      });
      return NextResponse.json({
        ok: false,
        action: 'bind_conflict',
        reply: '该微信已绑定其他账号，如需换绑请先在对应账号解绑。'
      });
    }

    // Conflict B: 检查当前 agent_profile 是否已绑定了活跃的 wechat 绑定
    const existingBindingForProfile = await db.query(
      "SELECT id, external_id FROM agent_bindings WHERE agent_profile_id = ? AND channel = 'wechat' AND status = 'active' LIMIT 1",
      [profileId]
    );

    if (existingBindingForProfile.results.length > 0) {
      const conflictBinding = existingBindingForProfile.results[0] as Record<string, unknown>;
      await db.execute(
        "UPDATE hermes_messages SET status = 'failed', action = 'bind_conflict', processed_at = datetime('now') WHERE message_id = ?",
        [messageId]
      );
      await writeSystemEvent('hermes.bind_code.conflict', {
        message_id: messageId,
        code_preview: `**${normalizedCode.slice(-2)}`,
        hermes_user_id: maskExternalId(hermesUserId),
        agent_profile_id: profileId,
        existing_external_id: maskExternalId(conflictBinding.external_id as string)
      });
      return NextResponse.json({
        ok: false,
        action: 'bind_conflict',
        reply: '你的账号已绑定了微信，无法重复绑定多个微信。'
      });
    }

    // 7. 写入绑定关系 (事务性写入)
    try {
      await db.batch([
        {
          sql: "INSERT INTO agent_bindings (agent_profile_id, channel, external_id, status, created_at, updated_at) VALUES (?, 'wechat', ?, 'active', datetime('now'), datetime('now'))",
          params: [profileId, hermesUserId]
        },
        {
          sql: "UPDATE bind_codes SET status = 'consumed', consumed_at = datetime('now'), hermes_user_id = ?, updated_at = datetime('now') WHERE id = ?",
          params: [hermesUserId, codeId]
        },
        {
          sql: "UPDATE hermes_messages SET status = 'processed', action = 'bind_success', processed_at = datetime('now') WHERE message_id = ?",
          params: [messageId]
        }
      ]);

      await writeSystemEvent('hermes.bind_code.consumed', {
        message_id: messageId,
        code_preview: `**${normalizedCode.slice(-2)}`,
        hermes_user_id: maskExternalId(hermesUserId),
        user_id: userId,
        agent_profile_id: profileId
      });

      await writeSystemEvent('hermes.binding.created', {
        hermes_user_id: maskExternalId(hermesUserId),
        agent_profile_id: profileId,
        channel: 'wechat'
      });

      console.log(`[webhook/hermes] Successfully bound user ${userId} to WeChat ${maskExternalId(hermesUserId)}`);

      return NextResponse.json({
        ok: true,
        action: 'bind_success',
        reply: '绑定成功，你现在可以回到网页查看状态。'
      });
    } catch (dbErr) {
      const dbErrMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      await db.execute(
        "UPDATE hermes_messages SET status = 'failed', action = 'db_error', processed_at = datetime('now') WHERE message_id = ?",
        [messageId]
      );
      throw dbErr;
    }
  } catch (err) {
    console.error('[webhook/hermes]', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
