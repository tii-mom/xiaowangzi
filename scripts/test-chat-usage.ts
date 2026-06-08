/**
 * chat-usage 扣费逻辑测试 — 精确断言余额/账本
 *
 * 运行: npx tsx scripts/test-chat-usage.ts
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

async function runTests() {
  console.log('Chat Usage 扣费逻辑测试\n');

  const { finalizeChatUsage } = await import('../lib/chat-usage-finalizer');
  const { getDb: dbGetter } = await import('../lib/db');
  const db = dbGetter();

  const uid1 = 91001;
  const uid2 = 91002;
  const uid3 = 91003;
  const initialBalance = 50000;
  const useTokens = 1234;
  const thread1 = `t1_${Date.now().toString(36)}`;

  // ---- 准备 ----
  await db.execute('INSERT INTO users (id, token_balance, status) VALUES (?, ?, ?)', [uid1, initialBalance, 'active']);
  await db.execute('INSERT INTO users (id, token_balance, status) VALUES (?, ?, ?)', [uid2, 100, 'active']);
  await db.execute('INSERT INTO users (id, token_balance, status) VALUES (?, ?, ?)', [uid3, initialBalance, 'active']);

  // ---- 1. zero ----
  console.log('=== 1. totalTokens=0 → error ===');
  const r0 = await finalizeChatUsage({
    userId: uid1, threadId: `zero_${Date.now()}`, model: 'test',
    inputTokens: 0, outputTokens: 0, totalTokens: 0,
  });
  assert(r0.status === 'error', `status=error (${r0.status})`);

  // ---- 2. 正常扣费 + 精确余额 ----
  console.log('\n=== 2. 正常扣费 (1234 tokens) ===');
  const r1 = await finalizeChatUsage({
    userId: uid1, threadId: thread1, model: 'deepseek-v4-flash',
    inputTokens: 400, outputTokens: 834, totalTokens: useTokens,
  });
  assert(r1.status === 'ok', `status=ok (${r1.status})`);
  assert(r1.remainingTokens === initialBalance - useTokens,
    `remainingTokens=${initialBalance - useTokens} (${r1.remainingTokens})`);

  const u1 = await db.query('SELECT token_balance FROM users WHERE id = ?', [uid1]);
  assert((u1.results[0]?.token_balance as number) === initialBalance - useTokens,
    `users.token_balance=${initialBalance - useTokens}`);

  const l1 = await db.query(
    "SELECT * FROM token_ledger WHERE source = 'deepseek' AND source_id = ? AND type = 'usage'",
    [thread1],
  );
  assert(l1.results.length === 1, `ledger count=1`);
  const r = l1.results[0] as Record<string, unknown>;
  assert(r.delta_tokens === -useTokens, `delta_tokens=${-useTokens} (${r.delta_tokens})`);
  assert(r.balance_after === initialBalance - useTokens,
    `balance_after=${initialBalance - useTokens} (${r.balance_after})`);

  // ---- 3. 重复幂等 ----
  console.log('\n=== 3. 重复 threadId 幂等 ===');
  const r2 = await finalizeChatUsage({
    userId: uid1, threadId: thread1, model: 'deepseek-v4-flash',
    inputTokens: 1, outputTokens: 1, totalTokens: 500,
  });
  assert(r2.status === 'already_processed', `already_processed (${r2.status})`);
  assert((u1.results[0]?.token_balance as number) === initialBalance - useTokens,
    `余额未变 = ${initialBalance - useTokens}`);
  const l2 = await db.query(
    "SELECT COUNT(*) as cnt FROM token_ledger WHERE source = 'deepseek' AND source_id = ? AND type = 'usage'",
    [thread1],
  );
  assert((l2.results[0]?.cnt as number) === 1, `ledger 仍为 1`);

  // ---- 4. 余额不足 (ledger 回滚) ----
  console.log('\n=== 4. 余额不足 → insufficient_tokens + ledger 回滚 ===');
  const poorThread = `poor_${Date.now().toString(36)}`;
  const r3 = await finalizeChatUsage({
    userId: uid2, threadId: poorThread, model: 'deepseek-v4-flash',
    inputTokens: 400, outputTokens: 834, totalTokens: useTokens,
  });
  assert(r3.status === 'insufficient_tokens', `insufficient_tokens (${r3.status})`);

  const u2 = await db.query('SELECT token_balance FROM users WHERE id = ?', [uid2]);
  assert((u2.results[0]?.token_balance as number) === 100,
    `余额不变 = 100 (${u2.results[0]?.token_balance})`);

  const lp = await db.query(
    "SELECT id FROM token_ledger WHERE source = 'deepseek' AND source_id = ? AND type = 'usage'",
    [poorThread],
  );
  assert(lp.results.length === 0,
    `失败 ledger 已删除 count=0 (${lp.results.length})`);

  // ---- 5. 最终一致性 ----
  console.log('\n=== 5. 最终一致性 ===');
  const lu = await db.query(
    "SELECT id FROM token_ledger WHERE source = 'deepseek' AND source_id = ? AND type = 'usage'",
    [thread1],
  );
  assert(lu.results.length === 1, `成功 ledger 仍存在 count=1`);
  const finalU1 = await db.query('SELECT token_balance FROM users WHERE id = ?', [uid1]);
  assert((finalU1.results[0]?.token_balance as number) === initialBalance - useTokens,
    `final balance = ${initialBalance - useTokens}`);

  // ---- 6. Agent Core Document prompt assembly ----
  console.log('\n=== 6. Agent Core Document 装配 ===');
  const {
    DEFAULT_CORE_DOC_CONTENT,
    buildAgentSystemContext,
    ensureUserPrimaryAgentProfile,
  } = await import('../lib/agent-profile');
  await ensureUserPrimaryAgentProfile(uid3);
  const ctx = await buildAgentSystemContext(uid3);
  assert(ctx.combinedPrompt.includes(DEFAULT_CORE_DOC_CONTENT), 'combinedPrompt 包含默认 Core Document');
  assert(ctx.combinedPrompt.includes('陪伴用户的温柔小王子'), 'combinedPrompt 包含 persona summary');

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

runTests().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
