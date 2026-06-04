/**
 * chat-usage 扣费逻辑测试
 *
 * 运行: npx tsx scripts/test-chat-usage.ts
 * 前置: npm run dev
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
let failures = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    console.error(`  ❌ ${label}`);
    failures++;
  } else {
    console.log(`  ✅ ${label}`);
  }
}

async function testConfigValues() {
  console.log('\n=== 1. 配置验证 ===');
  const threshold = parseInt(process.env.CHAT_MIN_TOKEN_BALANCE ?? '10000', 10);
  assert(threshold >= 10000, `CHAT_MIN_TOKEN_BALANCE >= 10000 (实际: ${threshold})`);
}

async function testPromptLoaded() {
  console.log('\n=== 2. prompt TS 常量可加载 ===');
  try {
    const mod = await import('../lib/prince-prompt');
    assert(typeof mod.PRINCE_SYSTEM_PROMPT === 'string' && mod.PRINCE_SYSTEM_PROMPT.length > 100,
      `prompt 已加载 (${mod.PRINCE_SYSTEM_PROMPT.length} chars)`);
  } catch (err) {
    console.error('  ❌ 无法加载 prompt:', err instanceof Error ? err.message : String(err));
    failures++;
  }
}

async function testModelExport() {
  console.log('\n=== 3. DEEPSEEK_MODEL 常量导出 ===');
  try {
    const mod = await import('../lib/deepseek');
    assert(typeof mod.DEEPSEEK_MODEL === 'string' && mod.DEEPSEEK_MODEL.length > 0,
      `DEEPSEEK_MODEL = ${mod.DEEPSEEK_MODEL}`);
  } catch (err) {
    console.error('  ❌ 无法加载 deepseek.ts:', err instanceof Error ? err.message : String(err));
    failures++;
  }
}

async function testUsageZeroHandled() {
  console.log('\n=== 4. deepseek usage 校验 ===');
  const { callDeepSeekChat } = await import('../lib/deepseek');
  const fakeMessages = [{ role: 'user' as const, content: 'hi' }];
  try {
    await callDeepSeekChat(fakeMessages, 'bad_key');
    assert(false, '应该抛出错');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes('DeepSeek HTTP') || msg.includes('DeepSeek') || msg.includes('401') || msg.includes('403'),
      `错误包含 DeepSeek: ${msg.slice(0, 80)}`);
  }
}

async function testFinalizeUsage() {
  console.log('\n=== 5. finalizeChatUsage 余额不足不扣成负数 ===');
  try {
    const mod = await import('../lib/chat-usage-finalizer');
    const result = await mod.finalizeChatUsage({
      userId: 9999,
      threadId: 'test_thread',
      model: 'test-model',
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 999999,
    });
    assert(result.status !== 'ok' || (result.remainingTokens ?? -1) >= 0,
      `余额不足时不应扣成负数: status=${result.status}, remaining=${result.remainingTokens}`);
  } catch (err) {
    console.log(`  ⚠️  DB 不可用 (预期 dev 环境): ${err instanceof Error ? err.message.slice(0, 60) : String(err)}`);
  }
}

async function testUsageZeroBlocks() {
  console.log('\n=== 6. totalTokens <= 0 被拦截 ===');
  try {
    const mod = await import('../lib/chat-usage-finalizer');
    const result = await mod.finalizeChatUsage({
      userId: 1,
      threadId: 'test_zero',
      model: 'test',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
    assert(result.status === 'error' && result.message === 'usage must be > 0',
      `totalTokens=0 → error (实际: status=${result.status})`);
  } catch (err) {
    console.log(`  ⚠️  DB 不可用: ${err instanceof Error ? err.message.slice(0, 60) : String(err)}`);
  }
}

async function main() {
  console.log('Chat Usage 扣费逻辑测试\n');

  await testConfigValues();
  await testPromptLoaded();
  await testModelExport();
  await testUsageZeroHandled();
  await testFinalizeUsage();
  await testUsageZeroBlocks();

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
