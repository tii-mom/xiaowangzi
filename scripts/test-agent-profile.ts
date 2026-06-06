/**
 * E2E Agent Profile and Core Document Integration Test
 * 
 * 运行方法:
 * BASE_URL=http://localhost:3000 D1_DATABASE=xiaowangzi-staging npx tsx scripts/test-agent-profile.ts
 */

import { execSync } from 'node:child_process';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const D1_DATABASE = process.env.D1_DATABASE ?? 'xiaowangzi-staging';
const WRANGLER_ENV = process.env.WRANGLER_ENV ?? '';
const ALLOW_PRODUCTION_AGENT_TEST = process.env.ALLOW_PRODUCTION_AGENT_TEST ?? '';

// 生产安全阻断检查
const isWanLatProduction = BASE_URL.includes('wan.lat') && !BASE_URL.includes('pay-staging.wan.lat');
const isD1Production = D1_DATABASE === 'xiaowangzi-production';
const isProduction = isWanLatProduction || isD1Production || WRANGLER_ENV === 'production';

console.log('=== Agent Profile and Core Document Test ===');
console.log(`BASE_URL: ${BASE_URL}`);
console.log(`D1_DATABASE: ${D1_DATABASE}`);
console.log(`Production Mode: ${isProduction ? 'YES ⚠️' : 'NO'}`);

if (isProduction && ALLOW_PRODUCTION_AGENT_TEST !== 'YES_I_UNDERSTAND') {
  console.error('\n❌ ERROR: 检测到生产环境，但未设置 ALLOW_PRODUCTION_AGENT_TEST="YES_I_UNDERSTAND"');
  console.error('中断执行以防止写入测试数据。');
  process.exit(1);
}

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`  ❌ FAIL: ${label}`);
    failures++;
  } else {
    console.log(`  ✅ PASS: ${label}`);
  }
}

function d1Execute(sql: string): any {
  const envFlag = WRANGLER_ENV ? `--env ${WRANGLER_ENV}` : '';
  const cmd = `npx wrangler d1 execute ${D1_DATABASE} --remote ${envFlag} --json --command "${sql.replace(/"/g, '\\"')}"`;
  const stdout = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const data = JSON.parse(stdout);
  return data[0];
}

async function verifyUserAgentStructure(cookieToken: string, label: string) {
  console.log(`\n--- 验证用户 [${label}] 的 Agent 关系链与外键关系 ---`);

  // 1. 调用 GET /api/user/agent-profile
  const res = await fetch(`${BASE_URL}/api/user/agent-profile`, {
    headers: { 'Cookie': cookieToken }
  });
  assert(res.status === 200, `GET /api/user/agent-profile status = ${res.status}`);

  const body = await res.json() as any;
  const profileId = body?.profile?.id;
  assert(profileId > 0, `获取 profileId = ${profileId}`);

  // 从 D1 直接验证外键关系
  console.log(`从 D1 读取 profileId = ${profileId} 的关联数据进行强一致外键校对`);

  // 查 profiles
  const profileRows = d1Execute(`SELECT * FROM agent_profiles WHERE id = ${profileId};`);
  const profileObj = profileRows?.results?.[0];
  assert(profileObj !== undefined, `D1 中存在该 profile id: ${profileId}`);
  assert(profileObj.is_primary === 1, `is_primary 应为 1`);

  const userId = profileObj.user_id;

  // 查 core doc
  const docRows = d1Execute(`SELECT * FROM agent_core_documents WHERE agent_profile_id = ${profileId} AND status = 'active';`);
  const docObj = docRows?.results?.[0];
  assert(docObj !== undefined, `D1 中存在关联的 active core document`);
  console.log(`  [外键验证] agent_core_documents.agent_profile_id (${docObj.agent_profile_id}) === profileId (${profileId})`);
  assert(docObj.agent_profile_id === profileId, `Core document 关联外键一致`);
  assert(docObj.content_hash !== null && docObj.content_hash.length === 64, `content_hash 计算注入成功: ${docObj.content_hash}`);

  // 查 bindings
  const bindingRows = d1Execute(`SELECT * FROM agent_bindings WHERE agent_profile_id = ${profileId} AND channel = 'web' AND status = 'active';`);
  const bindingObj = bindingRows?.results?.[0];
  assert(bindingObj !== undefined, `D1 中存在关联的 active web channel binding`);
  console.log(`  [外键验证] agent_bindings.agent_profile_id (${bindingObj.agent_profile_id}) === profileId (${profileId})`);
  assert(bindingObj.agent_profile_id === profileId, `Web binding 关联外键一致`);

  // 验证幂等性：重复登录不创建额外行
  const res3 = await fetch(`${BASE_URL}/api/auth/web-session`, {
    method: 'POST',
    headers: { 'Cookie': cookieToken }
  });
  assert(res3.status === 200, `重入登录接口 status = ${res3.status}`);

  const profilesCount = d1Execute(`SELECT COUNT(*) as count FROM agent_profiles WHERE user_id = ${userId};`);
  assert(profilesCount?.results?.[0]?.count === 1, `agent_profiles 物理行数应保持为 1`);

  const docsCount = d1Execute(`SELECT COUNT(*) as count FROM agent_core_documents WHERE agent_profile_id = ${profileId};`);
  assert(docsCount?.results?.[0]?.count === 1, `agent_core_documents 物理行数应保持为 1`);

  const bindingsCount = d1Execute(`SELECT COUNT(*) as count FROM agent_bindings WHERE agent_profile_id = ${profileId};`);
  assert(bindingsCount?.results?.[0]?.count === 1, `agent_bindings 物理行数应保持为 1`);
}

async function main() {
  // 1. 创建用户 A
  console.log('\n1. 模拟用户 A 登录/会话初始化');
  const resA = await fetch(`${BASE_URL}/api/auth/web-session`, { method: 'POST' });
  assert(resA.status === 200, `web-session A status = 200`);
  const bodyA = await resA.json() as any;
  const setCookieA = resA.headers.get('set-cookie') ?? '';
  const tokenA = setCookieA.split(';')[0].trim();

  await verifyUserAgentStructure(tokenA, 'User_A');

  // 2. 创建用户 B
  console.log('\n2. 模拟用户 B 登录/会话初始化 (多用户外键非巧合比对)');
  const resB = await fetch(`${BASE_URL}/api/auth/web-session`, { method: 'POST' });
  assert(resB.status === 200, `web-session B status = 200`);
  const setCookieB = resB.headers.get('set-cookie') ?? '';
  const tokenB = setCookieB.split(';')[0].trim();

  await verifyUserAgentStructure(tokenB, 'User_B');

  // 3. 并发防重与幂等测试
  console.log('\n3. 模拟并发请求登录会话校验 (并发 ensure 幂等性)');
  const resC = await fetch(`${BASE_URL}/api/auth/web-session`, { method: 'POST' });
  assert(resC.status === 200, `web-session C status = 200`);
  const bodyC = await resC.json() as any;
  const userIdC = bodyC?.user?.id;
  const setCookieC = resC.headers.get('set-cookie') ?? '';
  const tokenC = setCookieC.split(';')[0].trim();

  // 同时并发发起 5 次带 Cookie 的 web-session 登录
  console.log(`  并发发起 5 次登录，触发 ensureUserPrimaryAgentProfile...`);
  const promises = Array.from({ length: 5 }).map(() =>
    fetch(`${BASE_URL}/api/auth/web-session`, {
      method: 'POST',
      headers: { 'Cookie': tokenC }
    })
  );
  const results = await Promise.all(promises);
  const allSuccessful = results.every(r => r.status === 200);
  assert(allSuccessful, `所有并发登录请求均应成功返回 200`);

  // 核实 D1 物理表内行数是否保持唯一
  const profileRowsC = d1Execute(`SELECT COUNT(*) as count FROM agent_profiles WHERE user_id = ${userIdC};`);
  assert(profileRowsC?.results?.[0]?.count === 1, `[并发测试] agent_profiles 物理行数保持为 1`);

  const checkProfileC = d1Execute(`SELECT id FROM agent_profiles WHERE user_id = ${userIdC} AND is_primary = 1 AND status = 'active';`);
  const profileIdC = checkProfileC?.results?.[0]?.id;

  const docsRowsC = d1Execute(`SELECT COUNT(*) as count FROM agent_core_documents WHERE agent_profile_id = ${profileIdC};`);
  assert(docsRowsC?.results?.[0]?.count === 1, `[并发测试] agent_core_documents 物理行数保持为 1`);

  const bindingsRowsC = d1Execute(`SELECT COUNT(*) as count FROM agent_bindings WHERE agent_profile_id = ${profileIdC} AND channel = 'web' AND status = 'active';`);
  assert(bindingsRowsC?.results?.[0]?.count === 1, `[并发测试] agent_bindings 物理行数保持为 1`);

  console.log(`\n=== 测试结果: ${failures === 0 ? 'ALL PASSED ✅' : `${failures} FAILURES ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('测试运行异常:', e);
  process.exit(1);
});
