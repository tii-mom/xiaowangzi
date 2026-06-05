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
const isProduction = isWanLatProduction || isD1Production;

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

async function main() {
  // 1. 创建全新用户 Session
  console.log('\n1. 模拟全新用户 POST /api/auth/web-session');
  const res1 = await fetch(`${BASE_URL}/api/auth/web-session`, { method: 'POST' });
  assert(res1.status === 200, `web-session status = ${res1.status}`);
  
  const body1 = await res1.json() as any;
  const userId = body1?.user?.id;
  assert(userId > 0, `获取新创建的 user_id = ${userId}`);

  const setCookie = res1.headers.get('set-cookie') ?? '';
  const cookieToken = setCookie.split(';')[0].trim();
  assert(cookieToken.startsWith('auth_token='), `获取 auth_token cookie`);

  // 2. 调用 /api/user/agent-profile 查询接口
  console.log('\n2. 验证 GET /api/user/agent-profile 接口');
  const res2 = await fetch(`${BASE_URL}/api/user/agent-profile`, {
    headers: { 'Cookie': cookieToken }
  });
  assert(res2.status === 200, `/api/user/agent-profile status = ${res2.status}`);

  const body2 = await res2.json() as any;
  const profileId = body2?.profile?.id;
  assert(profileId > 0, `获取 profile_id = ${profileId}`);
  assert(body2.profile.display_name === '小王子', `display_name = ${body2.profile.display_name}`);
  assert(body2.profile.is_primary === true, `is_primary = true`);
  assert(body2.profile.status === 'active', `profile status = ${body2.profile.status}`);

  const coreDocId = body2?.core_document?.id;
  assert(coreDocId > 0, `获取 core_document_id = ${coreDocId}`);
  assert(body2.core_document.version === 1, `core_document version = 1`);
  assert(body2.core_document.status === 'active', `core_document status = active`);
  assert(body2.core_document.content === undefined, `安全验证：接口未返回完整 core document content`);

  // 3. 再次请求登录 (测试 ensure 幂等性)
  console.log('\n3. 重复请求 web-session 验证幂等性');
  const res3 = await fetch(`${BASE_URL}/api/auth/web-session`, {
    method: 'POST',
    headers: { 'Cookie': cookieToken }
  });
  assert(res3.status === 200, `重入登录 status = ${res3.status}`);

  // 4. 从 D1 校验数据是否被重复创建
  console.log('\n4. 从 D1 查询核实物理行数与约束');
  
  const profilesResult = d1Execute(`SELECT COUNT(*) as count FROM agent_profiles WHERE user_id = ${userId};`);
  const profileCount = profilesResult?.results?.[0]?.count ?? 0;
  assert(profileCount === 1, `agent_profiles 行数应为 1，实际: ${profileCount}`);

  const activeProfilesResult = d1Execute(`SELECT COUNT(*) as count FROM agent_profiles WHERE user_id = ${userId} AND is_primary = 1 AND status = 'active';`);
  const activeProfileCount = activeProfilesResult?.results?.[0]?.count ?? 0;
  assert(activeProfileCount === 1, `active primary profile 行数应为 1，实际: ${activeProfileCount}`);

  const docsResult = d1Execute(`SELECT COUNT(*) as count FROM agent_core_documents WHERE agent_profile_id = ${profileId};`);
  const docCount = docsResult?.results?.[0]?.count ?? 0;
  assert(docCount === 1, `agent_core_documents 行数应为 1，实际: ${docCount}`);

  const bindingsResult = d1Execute(`SELECT COUNT(*) as count FROM agent_bindings WHERE agent_profile_id = ${profileId} AND channel = 'web' AND status = 'active';`);
  const bindingCount = bindingsResult?.results?.[0]?.count ?? 0;
  assert(bindingCount === 1, `web channel agent_bindings 行数应为 1，实际: ${bindingCount}`);

  console.log(`\n=== 测试结果: ${failures === 0 ? 'ALL PASSED ✅' : `${failures} FAILURES ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('测试运行异常:', e);
  process.exit(1);
});
