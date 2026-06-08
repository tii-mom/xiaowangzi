import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { processUserChatTurn } from '@/lib/chat-turn';

const MIN_CHAT_TOKEN_BALANCE = parseInt(process.env.CHAT_MIN_TOKEN_BALANCE ?? '10000', 10);

function maskExternalId(id: string | null): string | null {
  if (!id) return null;
  if (id.length <= 6) return '***';
  return `${id.slice(0, 4)}***${id.slice(-3)}`;
}

function getSafeTextPreview(text: string): string {
  const trimmed = text.trim();
  const normalized = trimmed.toUpperCase();
  const isCodeFormat = /^[A-Z0-9]{8}$/.test(normalized);
  if (isCodeFormat) {
    return `**${normalized.slice(-2)}`;
  }
  const preview = text.slice(0, 20);
  return preview.replace(/[A-Za-z0-9]{8}/g, (match) => {
    return `**${match.toUpperCase().slice(-2)}`;
  });
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

async function handleHermesChatMessage(params: {
  messageId: string;
  hermesUserId: string;
  text: string;
}) {
  const db = getDb();
  const bindingRes = await db.query<{
    agent_profile_id: number;
    user_id: number;
  }>(
    `SELECT b.agent_profile_id, p.user_id
     FROM agent_bindings b
     JOIN agent_profiles p ON p.id = b.agent_profile_id
     WHERE b.external_id = ?
       AND b.channel = 'wechat'
       AND b.status = 'active'
       AND p.status = 'active'
     LIMIT 1`,
    [params.hermesUserId],
  );

  const binding = bindingRes.results[0];
  if (!binding) {
    await db.execute(
      "UPDATE hermes_messages SET status = 'ignored', action = 'not_bound', processed_at = datetime('now') WHERE message_id = ?",
      [params.messageId],
    );
    await writeSystemEvent('hermes.chat.not_bound', {
      message_id: params.messageId,
      hermes_user_id: maskExternalId(params.hermesUserId),
    });
    return NextResponse.json({
      ok: false,
      action: 'not_bound',
      reply: '请先在网页打开微信绑定页，按页面提示扫码完成绑定。',
    });
  }

  const userRes = await db.query<{ token_balance: number }>(
    "SELECT token_balance FROM users WHERE id = ? AND status = 'active' LIMIT 1",
    [binding.user_id],
  );
  const tokenBalance = userRes.results[0]?.token_balance;
  if (typeof tokenBalance !== 'number') {
    await db.execute(
      "UPDATE hermes_messages SET status = 'failed', action = 'user_not_active', processed_at = datetime('now') WHERE message_id = ?",
      [params.messageId],
    );
    await writeSystemEvent('hermes.chat.user_not_active', {
      message_id: params.messageId,
      user_id: binding.user_id,
      hermes_user_id: maskExternalId(params.hermesUserId),
    });
    return NextResponse.json({
      ok: false,
      action: 'user_not_active',
      reply: '账号状态不可用，请回到网页检查账号状态。',
    });
  }

  const result = await processUserChatTurn({
    userId: binding.user_id,
    tokenBalance,
    message: params.text,
    minTokenBalance: MIN_CHAT_TOKEN_BALANCE,
    channel: 'hermes',
    externalMessageId: params.messageId,
    threadId: `hermes_${params.messageId}`,
  });

  if (result.status === 'ok' || result.status === 'already_processed') {
    await db.execute(
      "UPDATE hermes_messages SET status = 'processed', action = 'chat_reply', processed_at = datetime('now') WHERE message_id = ?",
      [params.messageId],
    );
    return NextResponse.json({
      ok: true,
      action: 'chat_reply',
      reply: result.reply ?? '这条消息已经处理过了。',
      tokens_charged: result.usage?.total_tokens ?? 0,
      remaining_balance: result.remainingTokens ?? tokenBalance,
      thread_id: result.threadId ?? null,
    });
  }

  const action = result.status === 'insufficient_tokens' ? 'insufficient_tokens' : 'chat_failed';
  await db.execute(
    "UPDATE hermes_messages SET status = 'failed', action = ?, processed_at = datetime('now') WHERE message_id = ?",
    [action, params.messageId],
  );
  await writeSystemEvent(`hermes.chat.${action}`, {
    message_id: params.messageId,
    user_id: binding.user_id,
    hermes_user_id: maskExternalId(params.hermesUserId),
    message: result.message ?? '',
  });

  return NextResponse.json({
    ok: false,
    action,
    reply: result.message ?? '消息处理失败，请稍后再试。',
    remaining_balance: result.remainingTokens ?? tokenBalance,
  }, { status: result.status === 'insufficient_tokens' ? 402 : 500 });
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

    // 2. 校验 webhook body type
    if (body.type !== 'message') {
      return NextResponse.json({
        ok: true,
        action: 'ignored',
        reply: '忽略非 message 类型消息。'
      });
    }

    const messageId = String(body.message_id ?? '');
    const hermesUserId = String(body.hermes_user_id ?? '');
    const text = String(body.text ?? '').trim();

    // 3. 报文必填校验
    if (!messageId || !hermesUserId || !text) {
      console.error('[webhook/hermes] missing required fields');
      return NextResponse.json({ error: 'missing message_id, hermes_user_id, or text' }, { status: 400 });
    }

    const db = getDb();
    const textPreview = getSafeTextPreview(text);

    // 4. 消息去重，保证幂等性
    const insertMessage = await db.execute(
      "INSERT OR IGNORE INTO hermes_messages (message_id, hermes_user_id, message_type, text_preview, status) VALUES (?, ?, 'text', ?, 'received')",
      [messageId, hermesUserId, textPreview]
    );

    if ((insertMessage.meta?.changes ?? 0) === 0) {
      const existingReply = await db.query<{ thread_id: string; content: string; token_balance: number }>(
        `SELECT c.thread_id, a.content, u.token_balance
         FROM conversations c
         JOIN conversations a ON a.thread_id = c.thread_id AND a.role = 'assistant'
         JOIN agent_profiles p ON p.id = c.agent_profile_id
         JOIN users u ON u.id = p.user_id
         WHERE c.channel = 'hermes'
           AND c.external_message_id = ?
           AND c.role = 'user'
         ORDER BY a.created_at DESC
         LIMIT 1`,
        [messageId],
      );
      await writeSystemEvent('hermes.message.duplicate', {
        message_id: messageId,
        hermes_user_id: maskExternalId(hermesUserId)
      });
      return NextResponse.json({
        ok: true,
        action: 'duplicate',
        reply: existingReply.results[0]?.content ?? '该消息已处理',
        remaining_balance: existingReply.results[0]?.token_balance,
        thread_id: existingReply.results[0]?.thread_id ?? null,
      });
    }

    return handleHermesChatMessage({
      messageId,
      hermesUserId,
      text,
    });
  } catch (err) {
    console.error('[webhook/hermes]', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
