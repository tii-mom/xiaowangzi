/**
 * Growth 分享卡与 onboarding API 测试
 *
 * 运行: npx tsx scripts/test-growth-share.ts
 */

import { NextRequest } from 'next/server';

let failures = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    console.error(`  ❌ ${label}`);
    failures++;
  } else {
    console.log(`  ✅ ${label}`);
  }
}

async function main() {
  process.env.DATABASE_ADAPTER = 'mock';
  process.env.NEXT_PUBLIC_APP_URL = 'http://local';
  console.log('Growth Share 测试\n');

  const { getDb } = await import('../lib/db');
  const {
    createGrowthOnboarding,
    createGrowthShareArtifact,
    getPublicShareArtifact,
  } = await import('../lib/growth');
  const onboardingRoute = await import('../app/api/growth/onboarding/route');
  const db = getDb();

  const userId = 97001;
  await db.execute(
    "INSERT INTO users (id, token_balance, status) VALUES (?, 50000, 'active')",
    [userId],
  );
  await createGrowthOnboarding({
    userId,
    changeTarget: '我想保护公开目标，不暴露 wxid_private_123456',
    antiVision: '我继续拖延',
    dailyLever: '写下 1 个动作并完成它',
  });

  const artifact = await createGrowthShareArtifact({
    userId,
    progressNote: '完成了<script>alert(1)</script> wxid_private_123456 order_secret_abc 13800138000',
  });
  assert(artifact.slug.startsWith('z27-'), '生成 z27 share slug');
  assert(!artifact.progress_note.includes('<script'), '分享进步不包含 HTML/script');
  assert(!artifact.progress_note.includes('wxid_private'), '分享进步隐藏微信 ID');
  assert(!artifact.progress_note.includes('order_secret'), '分享进步隐藏订单样式 ID');
  assert(!artifact.progress_note.includes('13800138000'), '分享进步隐藏长数字');
  assert(!artifact.goal_theme.includes('wxid_private'), '目标主题隐藏微信 ID');

  const publicArtifact = await getPublicShareArtifact(artifact.slug, { incrementView: true });
  assert(publicArtifact?.slug === artifact.slug, '公开 slug 可读取');
  const afterView = await db.query<{ view_count: number }>(
    'SELECT view_count FROM share_artifacts WHERE slug = ?',
    [artifact.slug],
  );
  assert(afterView.results[0]?.view_count === 1, '公开页 view_count +1');

  const req = new NextRequest('http://local/api/growth/onboarding', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      change_target: '我也想开始一个 7 天改变',
      anti_vision: '我不想继续原地打转',
      daily_lever: '今天整理桌面 5 分钟',
      share_artifact_id: artifact.slug,
    }),
  });
  const res = await onboardingRoute.POST(req);
  const json = await res.json() as Record<string, unknown>;
  assert(res.status === 200, `onboarding API status=200 (${res.status})`);
  assert(json.session_created === true, '无 cookie onboarding 自动创建 Web Session');
  assert(Boolean(res.headers.get('set-cookie')?.includes('auth_token=')), 'onboarding 返回 auth_token cookie');

  const afterStart = await db.query<{ start_count: number }>(
    'SELECT start_count FROM share_artifacts WHERE slug = ?',
    [artifact.slug],
  );
  assert(afterStart.results[0]?.start_count === 1, '来源分享卡 start_count +1');

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
