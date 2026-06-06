import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getPaymentUser, PaymentAuthError } from '@/lib/payment-user';

function maskExternalId(id: string | null): string | null {
  if (!id) return null;
  if (id.length <= 6) return '***';
  return `${id.slice(0, 4)}***${id.slice(-3)}`;
}

export async function GET(req: NextRequest) {
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

    // 1. 获取用户的 Primary Profile ID
    const profileRes = await db.query(
      "SELECT id FROM agent_profiles WHERE user_id = ? AND is_primary = 1 AND status = 'active' LIMIT 1",
      [user.id]
    );
    const profileId = profileRes.results[0]?.id as number | undefined;

    if (!profileId) {
      return NextResponse.json({
        status: 'unbound',
        expires_at: null,
        bound_at: null,
        channel: 'wechat',
        masked_external_id: null
      });
    }

    // 2. 检查是否存在活跃的 wechat 绑定
    const bindingRes = await db.query(
      "SELECT external_id, created_at FROM agent_bindings WHERE agent_profile_id = ? AND channel = 'wechat' AND status = 'active' LIMIT 1",
      [profileId]
    );

    if (bindingRes.results.length > 0) {
      const bindingRow = bindingRes.results[0] as Record<string, unknown>;
      return NextResponse.json({
        status: 'bound',
        expires_at: null,
        bound_at: bindingRow.created_at,
        channel: 'wechat',
        masked_external_id: maskExternalId(bindingRow.external_id as string)
      });
    }

    // 3. 查寻最新绑定码
    const codeRes = await db.query(
      "SELECT id, code, status, expires_at, created_at FROM bind_codes WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      [user.id]
    );

    if (codeRes.results.length === 0) {
      return NextResponse.json({
        status: 'unbound',
        expires_at: null,
        bound_at: null,
        channel: 'wechat',
        masked_external_id: null
      });
    }

    const codeRow = codeRes.results[0] as Record<string, unknown>;
    const codeId = codeRow.id as number;
    const expiresAt = codeRow.expires_at as string;
    let status = codeRow.status as string;

    // 4. 自动处理过期时间
    if (status === 'pending' && new Date().toISOString() > expiresAt) {
      await db.execute(
        "UPDATE bind_codes SET status = 'expired', updated_at = datetime('now') WHERE id = ?",
        [codeId]
      );
      status = 'expired';
    }

    return NextResponse.json({
      status: status === 'consumed' ? 'bound' : status, // 'pending' | 'expired' | 'revoked' | 'bound'
      expires_at: expiresAt,
      bound_at: null,
      channel: 'wechat',
      masked_external_id: null
    });
  } catch (err) {
    console.error('[bind/status]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '查询绑定状态失败' },
      { status: 500 },
    );
  }
}
