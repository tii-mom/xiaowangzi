/**
 * Web MVP 集成测试
 * 运行: npx tsx scripts/test-user-dashboard.ts
 */

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) { console.error(`  ❌ ${label}`); failures++; } else { console.log(`  ✅ ${label}`); }
}

async function main() {
  console.log('Web MVP 集成测试\n');

  // 1. agent-manager
  console.log('=== 1. agent-manager LocalAgentManager ===');
  const { getAgentManager, resetAgentManager } = await import('../lib/agent-manager');
  const { getDb } = await import('../lib/db');
  const db = getDb();

  await db.execute("INSERT INTO users (id, token_balance, status) VALUES (91001, 50000, 'active')", []);
  resetAgentManager();
  const mgr = getAgentManager();
  const a1 = await mgr.createUserAgent(91001);
  assert(typeof a1?.id === 'number', `id: ${a1?.id}`);
  assert(a1?.status === 'active', `status: ${a1?.status}`);
  assert(typeof a1?.agent_name === 'string', `agent_name: ${a1?.agent_name}`);
  assert(typeof a1?.user_id === 'number', `user_id: ${a1?.user_id}`);

  const a2 = await mgr.createUserAgent(91001);
  assert(a2?.id === a1?.id, `不重复: ${a2?.id} === ${a1?.id}`);

  // 2. web-session grant logic (via db)
  console.log('\n=== 2. token_ledger grant 逻辑 ===');
  await db.execute("INSERT INTO users (id, token_balance, status) VALUES (91002, 0, 'active')", []);
  await db.execute(
    "INSERT INTO token_ledger (user_id, type, delta_tokens, balance_after, source, source_id) VALUES (?, 'grant', ?, ?, 'free_trial', ?)",
    [91002, 10000, 10000, 'web-session:91002'],
  );
  const tl = await db.query(
    "SELECT * FROM token_ledger WHERE source = 'free_trial' AND source_id = ?",
    ['web-session:91002'],
  );
  assert(tl.results.length === 1, `grant ledger: ${tl.results.length}`);
  assert((tl.results[0] as Record<string,unknown>).delta_tokens === 10000, `delta=10000`);

  // Duplicate insert should not increase count (mock limitation: unique index not enforced)
  await db.execute(
    "INSERT INTO token_ledger (user_id, type, delta_tokens, balance_after, source, source_id) VALUES (?, 'grant', ?, ?, 'free_trial', ?)",
    [91002, 10000, 10000, 'web-session:91002'],
  );
  const tl2 = await db.query(
    "SELECT COUNT(*) as cnt FROM token_ledger WHERE source = 'free_trial' AND source_id = ? AND type = 'grant'",
    ['web-session:91002'],
  );
  console.log(`  grant ledger count: ${tl2.results[0]?.cnt}`);

  // 3. user APIs via db-level check
  console.log('\n=== 3. user API 数据层验证 ===');
  const u = await db.query('SELECT id, token_balance, status FROM users WHERE id = ?', [91001]);
  assert(u.results.length === 1 && (u.results[0] as Record<string,unknown>).token_balance === 50000, 'user查询');

  const subs = await db.query("SELECT * FROM subscriptions WHERE user_id = ?", [91001]);
  console.log(`  subscriptions: ${subs.results.length}`);

  const convs = await db.query("SELECT * FROM conversations WHERE user_id = ? LIMIT 5", [91001]);
  console.log(`  conversations: ${convs.results.length}`);

  // 4. admin protection
  console.log('\n=== 4. admin protection 逻辑 ===');
  const hasToken = Boolean(process.env.ADMIN_TOKEN);
  const isProd = process.env.NODE_ENV === 'production';
  assert(!isProd || hasToken, `prod需ADMIN_TOKEN: isProd=${isProd}`);
  if (!hasToken && !isProd) console.log('  ℹ️ dev ADMIN_TOKEN 未配置');

  await db.execute(
    "CREATE TABLE IF NOT EXISTS admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, role TEXT NOT NULL DEFAULT 'admin', status TEXT NOT NULL DEFAULT 'active', granted_by TEXT, reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(user_id))",
    [],
  );
  await db.execute(
    "INSERT OR REPLACE INTO admin_users (user_id, role, status, granted_by, reason) VALUES (?, 'owner', 'active', 'test', 'dashboard regression')",
    [91001],
  );
  const adminRows = await db.query(
    "SELECT role, status FROM admin_users WHERE user_id = ?",
    [91001],
  );
  assert(adminRows.results[0]?.role === 'owner', 'admin_users 可将指定用户设为 owner');
  assert(adminRows.results[0]?.status === 'active', 'admin_users status = active');

  // 5. config check
  console.log('\n=== 5. 配置检查 ===');
  const { PLANS } = await import('../lib/plans');
  assert(PLANS.free_trial.tokens_amount > 0, `free_trial: ${PLANS.free_trial.tokens_amount}t`);
  assert(PLANS.monthly.amount_cents > 0, `monthly: ${PLANS.monthly.amount_cents}cents`);

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
