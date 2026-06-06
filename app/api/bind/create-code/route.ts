import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDb } from '@/lib/db';
import { generateBindCode } from '@/lib/bind';
import { getPaymentUser, PaymentAuthError } from '@/lib/payment-user';
import { ensureUserPrimaryAgentProfile } from '@/lib/agent-profile';

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

    // 1. 确保用户的 Primary Profile 存在并获取 ID
    await ensureUserPrimaryAgentProfile(user.id);
    const profileRes = await db.query(
      "SELECT id FROM agent_profiles WHERE user_id = ? AND is_primary = 1 AND status = 'active' LIMIT 1",
      [user.id]
    );
    const profileId = profileRes.results[0]?.id as number | undefined;
    if (!profileId) {
      return NextResponse.json({ error: '用户 Agent Profile 初始化失败' }, { status: 500 });
    }

    // 2. 撤销旧的 pending 绑定码
    const pendingCodes = await db.query(
      "SELECT id, code FROM bind_codes WHERE user_id = ? AND status = 'pending'",
      [user.id]
    );

    for (const codeRow of pendingCodes.results) {
      const oldCode = codeRow.code as string;
      const oldId = codeRow.id as number;
      await db.execute(
        "UPDATE bind_codes SET status = 'revoked', updated_at = datetime('now') WHERE id = ?",
        [oldId]
      );
      await writeSystemEvent('bind_code.revoked', {
        user_id: user.id,
        agent_profile_id: profileId,
        code_preview: `**${oldCode.slice(-2)}`,
        code_hash: crypto.createHash('sha256').update(oldCode).digest('hex').slice(0, 16)
      });
    }

    // 3. 生成新绑定码 (默认 10 分钟过期)
    const code = generateBindCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await db.execute(
      "INSERT INTO bind_codes (code, user_id, agent_profile_id, status, expires_at, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))",
      [code, user.id, profileId, expiresAt]
    );

    await writeSystemEvent('bind_code.created', {
      user_id: user.id,
      agent_profile_id: profileId,
      code_preview: `**${code.slice(-2)}`,
      code_hash: crypto.createHash('sha256').update(code).digest('hex').slice(0, 16),
      expires_at: expiresAt
    });

    return NextResponse.json({
      code,
      status: 'pending',
      expires_at: expiresAt,
      instructions: `请在小王子微信中发送绑定码 ${code} 完成绑定`
    });
  } catch (err) {
    console.error('[bind/create-code]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '生成绑定码失败' },
      { status: 500 },
    );
  }
}
