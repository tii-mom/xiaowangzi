/**
 * Agent Runtime Context 测试
 *
 * 运行: npx tsx scripts/test-agent-context.ts
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
  console.log('Agent Context 测试\n');
  process.env.DATABASE_ADAPTER = 'mock';

  const { getDb } = await import('../lib/db');
  const { ensureUserPrimaryAgentProfile } = await import('../lib/agent-profile');
  const { buildCompleteAgentRuntimeContext } = await import('../lib/agent-context');
  const db = getDb();

  const userId = 94001;
  await db.execute("INSERT INTO users (id, token_balance, status) VALUES (?, 50000, 'active')", [userId]);
  await ensureUserPrimaryAgentProfile(userId);

  const profileRows = await db.query<{ id: number }>(
    "SELECT id FROM agent_profiles WHERE user_id = ? AND is_primary = 1 AND status = 'active' LIMIT 1",
    [userId],
  );
  const profileId = profileRows.results[0]?.id;
  assert(typeof profileId === 'number', 'Primary Agent Profile 已创建');

  const docRows = await db.query<{ content: string }>(
    "SELECT content FROM agent_core_documents WHERE agent_profile_id = ? AND status = 'active' LIMIT 1",
    [profileId],
  );
  const coreDoc = docRows.results[0]?.content ?? '';
  assert(coreDoc.includes('[记忆策略]'), '默认核心文档包含记忆策略');
  assert(coreDoc.includes('[工具使用]'), '默认核心文档包含工具使用');
  assert(coreDoc.includes('[学习与进化]'), '默认核心文档包含学习与进化');

  await db.execute(
    `INSERT INTO agent_memories
      (user_id, agent_profile_id, memory_type, content, source, confidence, status)
     VALUES (?, ?, 'preference', '用户喜欢直接短答，不喜欢小作文。', 'test', 0.9, 'active')`,
    [userId, profileId],
  );

  const context = await buildCompleteAgentRuntimeContext({
    userId,
    channel: 'hermes',
    message: '现在几点？',
  });
  assert(context.systemPrompt.includes('[稳定记忆]'), '上下文包含稳定记忆段');
  assert(context.systemPrompt.includes('用户喜欢直接短答'), '上下文注入用户记忆');
  assert(context.systemPrompt.includes('[运行时上下文]'), '上下文包含运行时信息');
  assert(context.systemPrompt.includes('当前渠道：hermes'), '上下文包含渠道');
  assert(context.systemPrompt.includes('短问题默认 1-3 句'), '上下文包含短答约束');
  assert(!context.searchDecision.shouldSearch, '时间问题不触发搜索');

  const searchContext = await buildCompleteAgentRuntimeContext({
    userId,
    channel: 'hermes',
    message: '今天成都天气怎么样？',
  });
  assert(searchContext.searchDecision.shouldSearch, '天气问题触发搜索决策');
  assert(searchContext.systemPrompt.includes('[受控联网搜索]'), '搜索问题包含搜索上下文');

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
