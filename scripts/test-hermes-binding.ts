/**
 * E2E Hermes WeChat Binding Productionization Test
 * 
 * 运行方法:
 * BASE_URL=http://localhost:3000 D1_DATABASE=xiaowangzi-staging HERMES_WEBHOOK_SECRET=your_secret npx tsx scripts/test-hermes-binding.ts
 */

import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const D1_DATABASE = process.env.D1_DATABASE ?? 'xiaowangzi-staging';
const HERMES_WEBHOOK_SECRET = process.env.HERMES_WEBHOOK_SECRET ?? '';
const WRANGLER_ENV = process.env.WRANGLER_ENV ?? '';
const ALLOW_PRODUCTION_HERMES_BIND_TEST = process.env.ALLOW_PRODUCTION_HERMES_BIND_TEST ?? '';

// 生产安全阻断检查
const isWanLatProduction = BASE_URL.includes('wan.lat') && !BASE_URL.includes('pay-staging.wan.lat');
const isD1Production = D1_DATABASE === 'xiaowangzi-production';
const isProduction = isWanLatProduction || isD1Production || WRANGLER_ENV === 'production';

console.log('=== Hermes WeChat Binding Productionization Test ===');
console.log(`BASE_URL: ${BASE_URL}`);
console.log(`D1_DATABASE: ${D1_DATABASE}`);
console.log(`Production Mode: ${isProduction ? 'YES ⚠️' : 'NO'}`);

if (isProduction && ALLOW_PRODUCTION_HERMES_BIND_TEST !== 'YES_I_UNDERSTAND') {
  console.error('\n❌ ERROR: 检测到生产环境，但未设置 ALLOW_PRODUCTION_HERMES_BIND_TEST="YES_I_UNDERSTAND"');
  console.error('中断执行以防止写入测试数据。');
  process.exit(1);
}

if (!HERMES_WEBHOOK_SECRET) {
  console.error('\n❌ ERROR: 未提供 HERMES_WEBHOOK_SECRET 环境变量');
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

function maskWechatId(id: string): string {
  if (id.length <= 6) return '***';
  return `${id.slice(0, 4)}***${id.slice(-3)}`;
}

async function createWebSession(): Promise<{ userId: number; cookieToken: string }> {
  const res = await fetch(`${BASE_URL}/api/auth/web-session`, { method: 'POST' });
  if (res.status !== 200) {
    throw new Error(`创建 Session 失败: ${res.status}`);
  }
  const body = await res.json() as any;
  const setCookie = res.headers.get('set-cookie') ?? '';
  const cookieToken = setCookie.split(';')[0].trim();
  return { userId: body.user.id, cookieToken };
}

async function main() {
  const webhookUrl = `${BASE_URL}/api/webhook/hermes`;
  const runId = crypto.randomBytes(4).toString('hex');
  const wxid_A = `wxid_a_${runId}`;
  const wxid_B = `wxid_b_${runId}`;
  const wxid_C = `wxid_c_${runId}`;
  const wxid_concurrent_1 = `wxid_cc1_${runId}`;
  const wxid_concurrent_2 = `wxid_cc2_${runId}`;

  // 1. 初始化用户 A
  console.log('\n1. 模拟用户 A 登录并生成绑定码');
  const userA = await createWebSession();
  assert(userA.userId > 0, `用户 A 创建成功, ID: ${userA.userId}`);

  // 1.1 生成第一个绑定码 A1
  const resA1 = await fetch(`${BASE_URL}/api/bind/create-code`, {
    method: 'POST',
    headers: { 'Cookie': userA.cookieToken }
  });
  assert(resA1.status === 200, `创建绑定码 A1 返回 200`);
  const bodyA1 = await resA1.json() as any;
  const codeA1 = bodyA1.code;
  assert(typeof codeA1 === 'string' && codeA1.length === 8, `获取绑定码 A1: ${codeA1.slice(0, 2)}******`);

  // 1.2 连续生成第二个绑定码 A2 (验证 A1 撤销逻辑)
  const resA2 = await fetch(`${BASE_URL}/api/bind/create-code`, {
    method: 'POST',
    headers: { 'Cookie': userA.cookieToken }
  });
  assert(resA2.status === 200, `创建绑定码 A2 返回 200`);
  const bodyA2 = await resA2.json() as any;
  const codeA2 = bodyA2.code;
  assert(codeA2 !== codeA1, `绑定码 A2 与 A1 不同`);

  // 1.3 数据库校验 A1 状态已变更为 revoked
  const d1A1Row = d1Execute(`SELECT status FROM bind_codes WHERE code = '${codeA1}';`);
  const statusA1 = d1A1Row?.results?.[0]?.status;
  assert(statusA1 === 'revoked', `D1 校验 A1 状态为 revoked`);

  // 2. 鉴权与类型校验测试
  console.log('\n2. 验证 /api/webhook/hermes 鉴权与类型校验');
  
  // 2.1 鉴权失败测试
  const mockMsgId1 = `msg_test_${crypto.randomBytes(6).toString('hex')}`;
  const resAuthFail = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hermes-secret': 'invalid_secret_test'
    },
    body: JSON.stringify({
      type: 'message',
      message_id: mockMsgId1,
      hermes_user_id: wxid_A,
      text: codeA2,
      timestamp: Date.now()
    })
  });
  assert(resAuthFail.status === 401, `携带错误 x-hermes-secret 应返回 401, 实际: ${resAuthFail.status}`);

  // 2.2 非 message 类型消息忽略测试
  const mockMsgIdNonMsg = `msg_test_${crypto.randomBytes(6).toString('hex')}`;
  const resNonMsg = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hermes-secret': HERMES_WEBHOOK_SECRET
    },
    body: JSON.stringify({
      type: 'event_subscribe',
      message_id: mockMsgIdNonMsg,
      hermes_user_id: wxid_A,
      text: codeA2,
      timestamp: Date.now()
    })
  });
  assert(resNonMsg.status === 200, `非 message 类型应返回 200`);
  const bodyNonMsg = await resNonMsg.json() as any;
  assert(bodyNonMsg.action === 'ignored', `非 message 类型应被忽略: action === 'ignored'`);

  // 3. 被撤销绑定码绑定失败测试
  console.log('\n3. 验证已撤销的绑定码 A1 无法绑定');
  const mockMsgId2 = `msg_test_${crypto.randomBytes(6).toString('hex')}`;
  const resBindRevoked = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hermes-secret': HERMES_WEBHOOK_SECRET
    },
    body: JSON.stringify({
      type: 'message',
      message_id: mockMsgId2,
      hermes_user_id: wxid_A,
      text: codeA1,
      timestamp: Date.now()
    })
  });
  assert(resBindRevoked.status === 200, `使用 A1 请求 Webhook 应返回 200`);
  const bodyBindRevoked = await resBindRevoked.json() as any;
  assert(bodyBindRevoked.action === 'bind_code_unavailable', `绑定码无效响应, action: ${bodyBindRevoked.action}`);

  // 4. 有效绑定码绑定成功测试
  console.log('\n4. 验证有效绑定码 A2 绑定成功');
  const mockMsgId3 = `msg_test_${crypto.randomBytes(6).toString('hex')}`;
  const resBindSuccess = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hermes-secret': HERMES_WEBHOOK_SECRET
    },
    body: JSON.stringify({
      type: 'message',
      message_id: mockMsgId3,
      hermes_user_id: wxid_A,
      text: codeA2,
      timestamp: Date.now()
    })
  });
  assert(resBindSuccess.status === 200, `使用 A2 绑定成功, 状态码 200`);
  const bodyBindSuccess = await resBindSuccess.json() as any;
  assert(bodyBindSuccess.action === 'bind_success', `绑定成功 action = bind_success`);

  // 4.1 确认 hermes_messages.text_preview 不包含完整 bind code
  const d1MsgRow = d1Execute(`SELECT text_preview FROM hermes_messages WHERE message_id = '${mockMsgId3}';`);
  const textPreviewVal = d1MsgRow?.results?.[0]?.text_preview;
  assert(textPreviewVal !== codeA2, `D1 校验 text_preview 不包含完整 code. 实际值为: ${textPreviewVal}`);
  assert(textPreviewVal === `**${codeA2.slice(-2)}`, `D1 校验 text_preview 格式符合 '**后两位': ${textPreviewVal}`);

  // 4.2 查询 Web 绑定状态，确认状态为 bound，微信号脱敏
  const resStatusA = await fetch(`${BASE_URL}/api/bind/status`, {
    headers: { 'Cookie': userA.cookieToken }
  });
  assert(resStatusA.status === 200, `查询绑定状态返回 200`);
  const bodyStatusA = await resStatusA.json() as any;
  assert(bodyStatusA.status === 'bound', `状态已变为 bound`);
  assert(bodyStatusA.masked_external_id === maskWechatId(wxid_A), `微信号脱敏匹配: ${bodyStatusA.masked_external_id}`);

  // 5. 消息幂等与去重测试
  console.log('\n5. 验证消息去重与幂等处理');
  
  // 5.1 重复发送相同 message_id
  const resIdempotence = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hermes-secret': HERMES_WEBHOOK_SECRET
    },
    body: JSON.stringify({
      type: 'message',
      message_id: mockMsgId3, // 相同的 message_id
      hermes_user_id: wxid_A,
      text: codeA2,
      timestamp: Date.now()
    })
  });
  assert(resIdempotence.status === 200, `重复 message_id 响应返回 200`);
  const bodyIdempotence = await resIdempotence.json() as any;
  assert(bodyIdempotence.action === 'duplicate', `重复消息拦截, action = duplicate`);

  // 5.2 相同绑定码，不同 message_id 重复绑定 (绑定码已被消费)
  const mockMsgId4 = `msg_test_${crypto.randomBytes(6).toString('hex')}`;
  const resReplayCode = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hermes-secret': HERMES_WEBHOOK_SECRET
    },
    body: JSON.stringify({
      type: 'message',
      message_id: mockMsgId4,
      hermes_user_id: wxid_A,
      text: codeA2, // 已消费的 A2
      timestamp: Date.now()
    })
  });
  assert(resReplayCode.status === 200, `已消费的 A2 重新绑定响应返回 200`);
  const bodyReplayCode = await resReplayCode.json() as any;
  assert(bodyReplayCode.action === 'bind_code_unavailable', `绑定码失效拦截, action = bind_code_unavailable`);

  // 6. 并发消费同一 bind code 冲突测试
  console.log('\n6. 验证并发消费同一个 bind code 冲突防护 (不返回 500)');
  const userC = await createWebSession();
  assert(userC.userId > 0, `用户 C 创建成功, ID: ${userC.userId}`);

  // 6.1 用户 C 生成绑定码 C1
  const resC1 = await fetch(`${BASE_URL}/api/bind/create-code`, {
    method: 'POST',
    headers: { 'Cookie': userC.cookieToken }
  });
  const bodyC1 = await resC1.json() as any;
  const codeC1 = bodyC1.code;
  assert(typeof codeC1 === 'string', `获取绑定码 C1: ${codeC1.slice(0, 2)}******`);

  // 6.2 并发用两个不同 message_id 消费同一个 C1 码
  const concurrentMsgId1 = `msg_test_${crypto.randomBytes(6).toString('hex')}`;
  const concurrentMsgId2 = `msg_test_${crypto.randomBytes(6).toString('hex')}`;

  const req1 = fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hermes-secret': HERMES_WEBHOOK_SECRET
    },
    body: JSON.stringify({
      type: 'message',
      message_id: concurrentMsgId1,
      hermes_user_id: wxid_concurrent_1,
      text: codeC1,
      timestamp: Date.now()
    })
  });

  const req2 = fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hermes-secret': HERMES_WEBHOOK_SECRET
    },
    body: JSON.stringify({
      type: 'message',
      message_id: concurrentMsgId2,
      hermes_user_id: wxid_concurrent_2,
      text: codeC1,
      timestamp: Date.now()
    })
  });

  const [res1, res2] = await Promise.all([req1, req2]);
  assert(res1.status === 200 && res2.status === 200, `并发绑定请求均应返回 200, 实际: ${res1.status} 和 ${res2.status}`);

  const body1 = await res1.json() as any;
  const body2 = await res2.json() as any;

  console.log(`  并发响应1: action=${body1.action}, 并发响应2: action=${body2.action}`);

  const actions = [body1.action, body2.action];
  const successCount = actions.filter(a => a === 'bind_success').length;
  const unavailableCount = actions.filter(a => a === 'bind_code_unavailable').length;
  const conflictCount = actions.filter(a => a === 'bind_conflict').length;

  assert(successCount === 1, `并发绑定中恰好有 1 个成功`);
  assert(unavailableCount + conflictCount === 1, `并发绑定中另 1 个被判定为失效(bind_code_unavailable)或冲突(bind_conflict)`);

  // 6.3 物理校验 D1：用户 C (profile) 的 wechat bindings 数量仍为 1
  const profileResC = d1Execute(`SELECT id FROM agent_profiles WHERE user_id = ${userC.userId} AND status = 'active' LIMIT 1;`);
  const profileIdC = profileResC?.results?.[0]?.id;
  const bindingWechatC = d1Execute(`SELECT COUNT(*) as count FROM agent_bindings WHERE agent_profile_id = ${profileIdC} AND channel = 'wechat' AND status = 'active';`);
  assert(bindingWechatC?.results?.[0]?.count === 1, `并发处理后，用户 C wechat bindings 数量物理上依然为 1`);

  // 7. 微信号冲突防重测试 (微信 ID 只能绑定一个 Profile)
  console.log('\n7. 验证微信号唯一性冲突防范 (一微多户拦截)');
  const userB = await createWebSession();
  assert(userB.userId > 0 && userB.userId !== userA.userId, `用户 B 创建成功, ID: ${userB.userId}`);

  // 7.1 用户 B 生成绑定码 B1
  const resB1 = await fetch(`${BASE_URL}/api/bind/create-code`, {
    method: 'POST',
    headers: { 'Cookie': userB.cookieToken }
  });
  const bodyB1 = await resB1.json() as any;
  const codeB1 = bodyB1.code;
  assert(typeof codeB1 === 'string', `获取绑定码 B1: ${codeB1.slice(0, 2)}******`);

  // 7.2 尝试将用户 B 的绑定码 B1 绑定到已与用户 A 绑定的 wxid_A 微信上
  const mockMsgId5 = `msg_test_${crypto.randomBytes(6).toString('hex')}`;
  const resConflictWechat = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hermes-secret': HERMES_WEBHOOK_SECRET
    },
    body: JSON.stringify({
      type: 'message',
      message_id: mockMsgId5,
      hermes_user_id: wxid_A, // 冲突微信号
      text: codeB1,
      timestamp: Date.now()
    })
  });
  assert(resConflictWechat.status === 200, `一微多户绑定冲突返回 200`);
  const bodyConflictWechat = await resConflictWechat.json() as any;
  assert(bodyConflictWechat.action === 'bind_conflict', `微信号冲突拦截成功, action = bind_conflict`);

  // 8. 用户重复绑定微信号拦截测试 (一户多微拦截)
  console.log('\n8. 验证用户重复绑定拦截 (一户多微拦截)');
  
  // 8.1 已绑定的用户 A 重新生成绑定码 A3
  const resA3 = await fetch(`${BASE_URL}/api/bind/create-code`, {
    method: 'POST',
    headers: { 'Cookie': userA.cookieToken }
  });
  const bodyA3 = await resA3.json() as any;
  const codeA3 = bodyA3.code;

  // 8.2 尝试将已绑定的用户 A 绑定到新微信 wxid_C 上
  const mockMsgId6 = `msg_test_${crypto.randomBytes(6).toString('hex')}`;
  const resConflictProfile = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hermes-secret': HERMES_WEBHOOK_SECRET
    },
    body: JSON.stringify({
      type: 'message',
      message_id: mockMsgId6,
      hermes_user_id: wxid_C,
      text: codeA3,
      timestamp: Date.now()
    })
  });
  assert(resConflictProfile.status === 200, `一户多微冲突绑定返回 200`);
  const bodyConflictProfile = await resConflictProfile.json() as any;
  assert(bodyConflictProfile.action === 'bind_conflict', `用户重复绑定微信拦截成功, action = bind_conflict`);

  // 9. 用户 B 绑定到干净微信号成功测试
  console.log('\n9. 验证用户 B 绑定到干净微信号');
  const mockMsgId7 = `msg_test_${crypto.randomBytes(6).toString('hex')}`;
  const resBindB = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hermes-secret': HERMES_WEBHOOK_SECRET
    },
    body: JSON.stringify({
      type: 'message',
      message_id: mockMsgId7,
      hermes_user_id: wxid_B, // 干净的微信号
      text: codeB1,
      timestamp: Date.now()
    })
  });
  assert(resBindB.status === 200, `用户 B 绑定返回 200`);
  const bodyBindB = await resBindB.json() as any;
  assert(bodyBindB.action === 'bind_success', `用户 B 绑定成功 action = bind_success`);

  // 10. 物理校验 D1
  console.log('\n10. 物理一致性与行数校验 (D1 Checks)');
  
  // 查 A
  const profileResA = d1Execute(`SELECT id FROM agent_profiles WHERE user_id = ${userA.userId} AND status = 'active' LIMIT 1;`);
  const profileIdA = profileResA?.results?.[0]?.id;
  const bindingRowsA = d1Execute(`SELECT COUNT(*) as count FROM agent_bindings WHERE agent_profile_id = ${profileIdA} AND channel = 'web' AND status = 'active';`);
  assert(bindingRowsA?.results?.[0]?.count === 1, `用户 A web bindings 行数为 1`);
  const bindingWechatA = d1Execute(`SELECT COUNT(*) as count FROM agent_bindings WHERE agent_profile_id = ${profileIdA} AND channel = 'wechat' AND status = 'active';`);
  assert(bindingWechatA?.results?.[0]?.count === 1, `用户 A wechat bindings 行数为 1`);

  // 查 B
  const profileResB = d1Execute(`SELECT id FROM agent_profiles WHERE user_id = ${userB.userId} AND status = 'active' LIMIT 1;`);
  const profileIdB = profileResB?.results?.[0]?.id;
  const bindingWechatB = d1Execute(`SELECT COUNT(*) as count FROM agent_bindings WHERE agent_profile_id = ${profileIdB} AND channel = 'wechat' AND status = 'active';`);
  assert(bindingWechatB?.results?.[0]?.count === 1, `用户 B wechat bindings 行数为 1`);

  console.log(`\n=== 测试结果: ${failures === 0 ? 'ALL PASSED ✅' : `${failures} FAILURES ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('测试运行异常:', e);
  process.exit(1);
});
