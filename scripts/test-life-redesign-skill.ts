/**
 * Life Redesign Skill 测试
 *
 * 运行: npx tsx scripts/test-life-redesign-skill.ts
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
  console.log('Life Redesign Skill 测试\n');

  process.env.DATABASE_ADAPTER = 'mock';

  const {
    LIFE_REDESIGN_SKILL_PROMPT,
    buildLifeRedesignGuidance,
    formatLifeRedesignRuntimeHint,
    shouldUseLifeRedesignSkill,
  } = await import('../lib/agent-skills/life-redesign');
  const { getDb } = await import('../lib/db');
  const { ensureUserPrimaryAgentProfile } = await import('../lib/agent-profile');
  const { processUserChatTurn } = await import('../lib/chat-turn');

  assert(shouldUseLifeRedesignSkill('我很迷茫怎么办'), '迷茫问题触发 skill');
  assert(shouldUseLifeRedesignSkill('我想改变但总拖延'), '改变/拖延问题触发 skill');
  assert(!shouldUseLifeRedesignSkill('今天几号'), '普通事实问题不触发 skill');
  assert(!LIFE_REDESIGN_SKILL_PROMPT.includes('你就是 Dan Koe'), '不公开冒充现实作者身份');
  assert(!LIFE_REDESIGN_SKILL_PROMPT.includes('How to fix your entire life in 1 day'), '不复述来源文章标题作为人格设定');

  const guidance = buildLifeRedesignGuidance('我很迷茫怎么办') ?? '';
  assert(guidance.includes('今天'), '指导包含 1 天行动');
  assert(guidance.includes('这一周'), '指导包含 1 周节奏');
  assert(guidance.includes('这个月'), '指导包含 1 个月项目');
  assert(guidance.includes('这一年'), '指导包含 1 年身份迭代');
  assert(guidance.includes('反愿景'), '指导包含反愿景');
  assert(guidance.includes('daily levers'), '指导包含 daily levers');

  const hint = formatLifeRedesignRuntimeHint('我想改变但总拖延');
  assert(hint.includes('本轮已触发'), '运行时提示标记已触发');
  assert(hint.includes('最多 3 个行动点'), '运行时提示约束短答行动点');

  const db = getDb();
  const userId = 95001;
  await db.execute(
    "INSERT INTO users (id, token_balance, status) VALUES (?, 50000, 'active')",
    [userId],
  );
  await ensureUserPrimaryAgentProfile(userId);

  let capturedPrompt = '';
  const result = await processUserChatTurn({
    userId,
    tokenBalance: 50000,
    message: '我很迷茫，想改变但总拖延怎么办？',
    minTokenBalance: 10000,
    channel: 'hermes',
    externalMessageId: `life_${Date.now().toString(36)}`,
    chatCompletion: async (messages) => {
      capturedPrompt = messages[0]?.content ?? '';
      return {
        content: guidance,
        usage: { prompt_tokens: 500, completion_tokens: 80, total_tokens: 580 },
      };
    },
  });
  assert(result.status === 'ok', `聊天服务返回 ok (${result.status})`);
  assert(capturedPrompt.includes('Life Redesign Skill'), '聊天 prompt 包含 Life Redesign Skill');
  assert(capturedPrompt.includes('本轮已触发'), '聊天 prompt 包含触发提示');
  assert(String(result.reply).includes('反愿景'), 'Life Redesign 回复保留核心方法');

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
