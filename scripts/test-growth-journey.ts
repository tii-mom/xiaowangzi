/**
 * Growth Journey 服务测试
 *
 * 运行: npx tsx scripts/test-growth-journey.ts
 */

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
  console.log('Growth Journey 测试\n');

  const { getDb } = await import('../lib/db');
  const {
    createGrowthOnboarding,
    formatGrowthContextForPrompt,
    submitGrowthReflection,
  } = await import('../lib/growth');
  const db = getDb();

  const userId = 96001;
  await db.execute(
    "INSERT INTO users (id, token_balance, status) VALUES (?, 50000, 'active')",
    [userId],
  );

  const created = await createGrowthOnboarding({
    userId,
    changeTarget: '我想停止拖延，把作品持续做出来',
    antiVision: '一年后我还是只收藏方法，没有完成任何项目',
    dailyLever: '打开文档写 200 字，不求完美',
  });
  assert(created.has_goal, 'onboarding 创建 active growth goal');
  assert(created.goal?.title.includes('我想停止拖延'), '目标 title 来自用户真实目标');
  assert(created.practice?.day_number === 1, '首个 daily practice day_number=1');
  assert(created.practice?.daily_lever.includes('200 字'), '今日微行动写入');

  const goalMemories = await db.query(
    "SELECT content, memory_type FROM agent_memories WHERE user_id = ? AND source = 'growth_onboarding'",
    [userId],
  );
  assert(goalMemories.results.length === 1, 'onboarding 写入 goal memory');
  assert(goalMemories.results[0]?.memory_type === 'goal', 'memory_type=goal');

  const reflected = await submitGrowthReflection({
    userId,
    completedText: '我写了 230 字，并把标题改清楚了',
    tacitInsight: '开始前最难，开始后阻力会变小',
    nextAdjustment: '明天先打开文档，再看手机',
  });
  assert(reflected.practice?.status === 'completed', '提交复盘后今日行动 completed');
  assert(reflected.streak_count === 1, 'streak_count=1');
  assert(reflected.latest_reflection?.tacit_insight.includes('阻力会变小'), '保存默会洞察');

  const reflectionMemories = await db.query(
    "SELECT content FROM agent_memories WHERE user_id = ? AND source = 'growth_reflection'",
    [userId],
  );
  assert(reflectionMemories.results.length === 1, '复盘写入 summary memory');

  const promptContext = await formatGrowthContextForPrompt(userId);
  assert(promptContext.includes('[成长旅程]'), 'prompt 包含成长旅程段');
  assert(promptContext.includes('我想停止拖延'), 'prompt 注入 active goal');
  assert(promptContext.includes('阻力会变小'), 'prompt 注入最近复盘');
  assert(promptContext.includes('普通事实问题不要强行成长化'), 'prompt 约束不强行成长化');

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
