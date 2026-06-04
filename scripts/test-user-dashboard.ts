/**
 * 用户 Dashboard / Admin API + agent-manager 测试
 *
 * 运行: npx tsx scripts/test-user-dashboard.ts
 */

let failures = 0;

function assert(condition: boolean, label: string) {
  if (!condition) { console.error(`  ❌ ${label}`); failures++; }
  else { console.log(`  ✅ ${label}`); }
}

async function testAgentManager() {
  console.log('\n=== agent-manager 不重复创建 ===');
  const { getAgentManager, resetAgentManager } = await import('../lib/agent-manager');
  const { getDb } = await import('../lib/db');
  const db = getDb();

  await db.execute(
    "INSERT INTO users (id, token_balance, status) VALUES (91001, 50000, 'active')", []
  );

  resetAgentManager();
  const mgr = getAgentManager();
  
  const a1 = await mgr.createUserAgent(91001);
  assert(typeof a1?.id === 'number' && a1.status === 'active',
    `agent1: id=${a1?.id} status=${a1?.status}`);

  const a2 = await mgr.createUserAgent(91001);
  assert(a2?.id === a1?.id, `不重复创建: ${a2?.id} === ${a1?.id}`);

  const lookup = await mgr.getUserAgent(91001);
  assert(lookup?.id === a1?.id, `可查询: ${lookup?.id}`);
}

async function testAdminConfig() {
  console.log('\n=== admin 环境变量检查 ===');
  const hasToken = Boolean(process.env.ADMIN_TOKEN);
  const isProd = process.env.NODE_ENV === 'production';
  assert(!isProd || hasToken, `production 需 ADMIN_TOKEN: isProd=${isProd} hasToken=${hasToken}`);
  if (!hasToken && !isProd) {
    console.log('  ℹ️  dev 环境 ADMIN_TOKEN 未配置 (允许)');
  }
}

async function testAgentManagerConfig() {
  console.log('\n=== agent-manager 配置检查 ===');
  const { getAgentManager, resetAgentManager } = await import('../lib/agent-manager');
  resetAgentManager();
  const mgr = getAgentManager();
  assert(typeof mgr.createUserAgent === 'function', 'createUserAgent 可用');
  assert(typeof mgr.getUserAgent === 'function', 'getUserAgent 可用');
  assert(typeof mgr.resetUserAgent === 'function', 'resetUserAgent 可用');
}

async function main() {
  console.log('User Dashboard / Admin 测试\n');
  await testAgentManagerConfig();
  await testAgentManager();
  await testAdminConfig();
  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
