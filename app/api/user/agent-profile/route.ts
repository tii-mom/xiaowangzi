import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get('auth_token')?.value;
    if (!cookie) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const db = getDb();
    const sessions = await db.query(
      "SELECT user_id FROM auth_sessions WHERE token = ? AND expires_at > datetime('now')",
      [cookie]
    );

    if (sessions.results.length === 0) {
      return NextResponse.json({ error: '登录会话已过期' }, { status: 401 });
    }

    const userId = sessions.results[0].user_id as number;

    const profiles = await db.query(
      "SELECT id, display_name, status, is_primary FROM agent_profiles WHERE user_id = ? AND is_primary = 1 AND status = 'active' LIMIT 1",
      [userId]
    );

    if (profiles.results.length === 0) {
      return NextResponse.json({ error: 'Agent Profile 未初始化' }, { status: 404 });
    }

    const profile = profiles.results[0];
    const profileId = profile.id as number;

    const coreDocs = await db.query(
      "SELECT id, version, title, status, updated_at FROM agent_core_documents WHERE agent_profile_id = ? AND status = 'active' ORDER BY version DESC LIMIT 1",
      [profileId]
    );

    const coreDocument = coreDocs.results[0] ?? null;

    return NextResponse.json({
      profile: {
        id: profile.id,
        display_name: profile.display_name,
        status: profile.status,
        is_primary: Boolean(profile.is_primary),
      },
      core_document: coreDocument ? {
        id: coreDocument.id,
        version: coreDocument.version,
        title: coreDocument.title,
        status: coreDocument.status,
        updated_at: coreDocument.updated_at,
      } : null,
    });
  } catch (err) {
    console.error('[api/user/agent-profile] Error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
