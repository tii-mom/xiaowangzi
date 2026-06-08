/**
 * Clawbot message ingest contract test.
 *
 * Run: npx tsx scripts/test-clawbot-ingest.ts
 */

import crypto from 'node:crypto';

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    console.error(`  ❌ ${label}`);
    failures++;
  } else {
    console.log(`  ✅ ${label}`);
  }
}

function sign(secret: string, rawBody: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(8).toString('hex');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${nonce}.${rawBody}`, 'utf8')
    .digest('hex');
  return { timestamp, nonce, signature };
}

function signedRequest(body: Record<string, unknown>, secret: string) {
  const rawBody = JSON.stringify(body);
  const signed = sign(secret, rawBody);
  return new Request('http://local/api/bot/clawbot/ingest', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-dreamer-bridge-timestamp': signed.timestamp,
      'x-dreamer-bridge-nonce': signed.nonce,
      'x-dreamer-bridge-signature': signed.signature,
    },
    body: rawBody,
  });
}

async function main() {
  process.env.DREAMER_BRIDGE_SECRET = 'test_bridge_secret';
  process.env.CLAWBOT_INGEST_MOCK_REPLY = '我在微信里听见你了。';

  console.log('Clawbot 普通消息 ingest 测试\n');

  const { getDb } = await import('../lib/db');
  const { ensureUserPrimaryAgentProfile } = await import('../lib/agent-profile');
  const ingestRoute = await import('../app/api/bot/clawbot/ingest/route');
  const db = getDb();

  console.log('=== 1. 未绑定微信提示扫码 ===');
  const unboundRes = await ingestRoute.POST(signedRequest({
    provider: 'clawbot',
    providerUserId: 'wxid_unbound_test',
    content: '你好',
    messageId: 'wx_unbound_1',
  }, process.env.DREAMER_BRIDGE_SECRET!) as any);
  const unboundJson = await unboundRes.json() as any;
  assert(unboundRes.status === 200, `未绑定返回 200 (${unboundRes.status})`);
  assert(unboundJson.action === 'not_bound', `未绑定 action=not_bound (${unboundJson.action})`);
  assert(String(unboundJson.reply).includes('扫码'), '未绑定提示网页扫码');

  console.log('\n=== 2. 已绑定微信进入共享聊天服务 ===');
  const userId = 94001;
  const initialBalance = 50000;
  const providerUserId = 'wxid_bound_ingest';
  await db.execute(
    "INSERT INTO users (id, token_balance, status) VALUES (?, ?, 'active')",
    [userId, initialBalance],
  );
  await ensureUserPrimaryAgentProfile(userId);

  const profileRows = await db.query<{ id: number }>(
    "SELECT id FROM agent_profiles WHERE user_id = ? AND is_primary = 1 AND status = 'active' LIMIT 1",
    [userId],
  );
  const profileId = profileRows.results[0]?.id;
  await db.execute(
    "INSERT INTO agent_bindings (agent_profile_id, channel, external_id, status) VALUES (?, 'wechat', ?, 'active')",
    [profileId, providerUserId],
  );

  const messageId = `wx_ingest_${Date.now().toString(36)}`;
  const okRes = await ingestRoute.POST(signedRequest({
    provider: 'clawbot',
    providerUserId,
    content: '我从微信来找你',
    messageId,
  }, process.env.DREAMER_BRIDGE_SECRET!) as any);
  const okJson = await okRes.json() as any;
  assert(okRes.status === 200, `已绑定返回 200 (${okRes.status})`);
  assert(okJson.action === 'chat_reply', `已绑定 action=chat_reply (${okJson.action})`);
  assert(typeof okJson.reply === 'string' && okJson.reply.length > 0, '返回微信 reply');

  const convRows = await db.query(
    "SELECT channel, external_message_id FROM conversations WHERE user_id = ? AND role = 'user' ORDER BY id DESC LIMIT 1",
    [userId],
  );
  assert(convRows.results[0]?.channel === 'hermes', 'conversation channel=hermes');
  assert(convRows.results[0]?.external_message_id === messageId, 'conversation external_message_id 写入');

  const userRows = await db.query<{ token_balance: number }>('SELECT token_balance FROM users WHERE id = ?', [userId]);
  assert(userRows.results[0]?.token_balance < initialBalance, '用户 token 已扣减');

  console.log('\n=== 3. 签名错误拒绝 ===');
  const badRes = await ingestRoute.POST(signedRequest({
    provider: 'clawbot',
    providerUserId,
    content: '签名错误',
    messageId: 'wx_bad_sig',
  }, 'wrong_secret') as any);
  assert(badRes.status === 401, `签名错误返回 401 (${badRes.status})`);

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
