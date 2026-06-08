import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getPaymentUser, PaymentAuthError } from '@/lib/payment-user';
import { processUserChatTurn } from '@/lib/chat-turn';

const MIN_CHAT_TOKEN_BALANCE = parseInt(process.env.CHAT_MIN_TOKEN_BALANCE ?? '10000', 10);

export async function POST(req: NextRequest) {
  let userId: number | undefined;
  let threadId: string | undefined;

  try {
    const body = await req.json() as { message?: string };
    if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    }

    let user;
    try {
      user = await getPaymentUser(req);
      userId = user.id;
    } catch (err) {
      if (err instanceof PaymentAuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    const result = await processUserChatTurn({
      userId: user.id,
      tokenBalance: user.token_balance,
      message: body.message,
      minTokenBalance: MIN_CHAT_TOKEN_BALANCE,
      channel: 'web',
    });
    threadId = result.threadId;

    if (
      result.status !== 'ok' &&
      result.status !== 'already_processed' &&
      result.status !== 'tool_unavailable'
    ) {
      const db = getDb();
      await insertSystemEvent(db, 'chat.send_failed', {
        user_id: user.id,
        thread_id: threadId,
        reason: result.status,
        message: result.message ?? '',
        stage: 'process_chat_turn',
      });

      const status = result.status === 'insufficient_tokens' ? 402 : 500;
      return NextResponse.json(
        { error: result.message ?? '这次小星球能量不足，请先充值后继续' },
        { status },
      );
    }

    return NextResponse.json({
      reply: result.reply,
      usage: result.usage,
      remaining_tokens: result.remainingTokens ?? 0,
      thread_id: threadId,
    });
  } catch (err) {
    console.error('[chat/send]', err);
    const db = getDb();
    await insertSystemEvent(db, 'chat.send_exception', {
      user_id: userId ?? null,
      thread_id: threadId ?? null,
      error: err instanceof Error ? err.message : String(err),
      stage: 'unknown',
    }).catch(() => {});

    return NextResponse.json(
      { error: err instanceof Error ? err.message : '对话失败' },
      { status: 500 },
    );
  }
}

async function insertSystemEvent(
  db: ReturnType<typeof getDb>,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await db.execute(
      'INSERT INTO system_events (type, payload) VALUES (?, ?)',
      [type, JSON.stringify(payload)],
    );
  } catch {
    // best-effort
  }
}
