import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { processUserChatTurn } from '@/lib/chat-turn';

const MIN_CHAT_TOKEN_BALANCE = parseInt(process.env.CHAT_MIN_TOKEN_BALANCE ?? '10000', 10);

function maskExternalId(id: string | null): string | null {
  if (!id) return null;
  if (id.length <= 6) return '***';
  return `${id.slice(0, 4)}***${id.slice(-3)}`;
}

function getBridgeSecret(): string {
  return getEnv('DREAMER_BRIDGE_SECRET', getEnv('HERMES_WEBHOOK_SECRET'));
}

function verifySignature(req: NextRequest, rawBody: string): boolean {
  const secret = getBridgeSecret();
  if (!secret) return process.env.NODE_ENV !== 'production';

  const timestamp = req.headers.get('x-dreamer-bridge-timestamp') ?? '';
  const nonce = req.headers.get('x-dreamer-bridge-nonce') ?? '';
  const signature = req.headers.get('x-dreamer-bridge-signature') ?? '';
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
      await writeSystemEvent('clawbot.ingest.unauthorized', {
        user_agent: req.headers.get('user-agent') ?? 'unknown',
      });
      return NextResponse.json({ ok: false, error: 'signature rejected' }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as {
      provider?: string;
      providerUserId?: string;
      content?: string;
      messageId?: string;
      contextToken?: string;
      rawPayload?: unknown;
    };

    const providerUserId = String(body.providerUserId ?? '').trim();
    const content = String(body.content ?? '').trim();
    const messageId = String(body.messageId || `clawbot_${Date.now().toString(36)}`);
    if (!providerUserId || !content) {
      return NextResponse.json({ ok: false, error: 'providerUserId_and_content_required' }, { status: 400 });
    }

    const db = getDb();
    const bindingRes = await db.query<{ agent_profile_id: number }>(
      `SELECT agent_profile_id
       FROM agent_bindings
       WHERE channel = 'wechat'
         AND external_id = ?
         AND status = 'active'
       LIMIT 1`,
      [providerUserId],
    );

    const binding = bindingRes.results[0];
    if (!binding) {
      await writeSystemEvent('clawbot.ingest.not_bound', {
        provider_user_id: maskExternalId(providerUserId),
        message_id: messageId,
      });
      return NextResponse.json({
        ok: true,
        action: 'not_bound',
        reply: '请先在网页打开微信绑定页，按页面提示扫码完成绑定。',
      });
    }

    const profileRes = await db.query<{ user_id: number }>(
      "SELECT user_id FROM agent_profiles WHERE id = ? AND status = 'active' LIMIT 1",
      [binding.agent_profile_id],
    );
    const userId = profileRes.results[0]?.user_id;
    if (typeof userId !== 'number') {
      await writeSystemEvent('clawbot.ingest.profile_not_active', {
        agent_profile_id: binding.agent_profile_id,
        provider_user_id: maskExternalId(providerUserId),
        message_id: messageId,
      });
      return NextResponse.json({ ok: false, error: 'profile_not_active' }, { status: 404 });
    }

    const userRes = await db.query<{ token_balance: number }>(
      "SELECT token_balance FROM users WHERE id = ? AND status = 'active' LIMIT 1",
      [userId],
    );
    const tokenBalance = userRes.results[0]?.token_balance;
    if (typeof tokenBalance !== 'number') {
      await writeSystemEvent('clawbot.ingest.user_not_active', {
        user_id: userId,
        provider_user_id: maskExternalId(providerUserId),
        message_id: messageId,
      });
      return NextResponse.json({ ok: false, error: 'user_not_active' }, { status: 404 });
    }

    const result = await processUserChatTurn({
      userId,
      tokenBalance,
      message: content,
      minTokenBalance: MIN_CHAT_TOKEN_BALANCE,
      channel: 'hermes',
      externalMessageId: messageId,
      threadId: `hermes_${messageId}`,
      chatCompletion: process.env.CLAWBOT_INGEST_MOCK_REPLY
        ? async () => ({
            content: process.env.CLAWBOT_INGEST_MOCK_REPLY ?? 'mock reply',
            usage: { prompt_tokens: 40, completion_tokens: 12, total_tokens: 52 },
          })
        : undefined,
    });

    if (result.status === 'ok' || result.status === 'already_processed') {
      return NextResponse.json({
        ok: true,
        action: result.status === 'already_processed' ? 'duplicate' : 'chat_reply',
        reply: result.reply ?? '这条消息已经处理过了。',
        tokens_charged: result.usage?.total_tokens ?? 0,
        remaining_balance: result.remainingTokens ?? tokenBalance,
        thread_id: result.threadId ?? null,
      });
    }

    if (result.status === 'insufficient_tokens') {
      return NextResponse.json({
        ok: true,
        action: 'insufficient_tokens',
        reply: result.message ?? '这次小星球能量不足，请先充值后继续',
        remaining_balance: result.remainingTokens ?? tokenBalance,
      });
    }

    await writeSystemEvent('clawbot.ingest.chat_failed', {
      user_id: userId,
      provider_user_id: maskExternalId(providerUserId),
      message_id: messageId,
      message: result.message ?? '',
    });
    return NextResponse.json({ ok: false, error: result.message ?? 'chat_failed' }, { status: 500 });
  } catch (err) {
    console.error('[bot/clawbot/ingest]', err);
    return NextResponse.json({ ok: false, error: 'ingest_failed' }, { status: 500 });
  }
}
