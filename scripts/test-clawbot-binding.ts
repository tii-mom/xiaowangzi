/**
 * Clawbot ticket binding contract test.
 *
 * Run: npx tsx scripts/test-clawbot-binding.ts
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

async function main() {
  process.env.CLAWBOT_WEBHOOK_SECRET = 'test_clawbot_secret';
  process.env.CLAWBOT_BIND_BASE_URL = 'https://wechat.tai.lat/xms/wechat/bind';

  console.log('Clawbot 绑定 ticket 测试\n');

  const { getDb } = await import('../lib/db');
  const { ensureUserPrimaryAgentProfile } = await import('../lib/agent-profile');
  const ticketRoute = await import('../app/api/bot/clawbot/bind-ticket/route');
  const callbackRoute = await import('../app/api/bot/clawbot/bind-callback/route');
  const db = getDb();

  const userId = 1;
  await db.execute(
    "INSERT INTO users (id, token_balance, status) VALUES (?, 50000, 'active')",
    [userId],
  );
  await ensureUserPrimaryAgentProfile(userId);

  const ticketReq = {
    method: 'POST',
    cookies: { get: () => undefined },
    headers: new Headers(),
  };
  const ticketRes = await ticketRoute.POST(ticketReq as any);
  assert(ticketRes.status === 200, `bind-ticket status 200 (${ticketRes.status})`);
  const ticketBody = await ticketRes.json() as any;
  assert(String(ticketBody.ticket).startsWith('claw_'), 'ticket 使用 claw_ 前缀');
  assert(String(ticketBody.bind_url).includes('/xms/wechat/bind?ticket='), 'bind_url 指向 Clawbot 绑定页');

  const callbackBody = JSON.stringify({
    ticket: ticketBody.ticket,
    providerUserId: 'provider_user_abc123456',
    nickname: '测试用户',
    avatarUrl: null,
    source: 'clawbot_gateway',
  });
  const signed = sign(process.env.CLAWBOT_WEBHOOK_SECRET!, callbackBody);
  const callbackReq = new Request('http://local/api/bot/clawbot/bind-callback', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-clawbot-timestamp': signed.timestamp,
      'x-clawbot-nonce': signed.nonce,
      'x-clawbot-signature': signed.signature,
    },
    body: callbackBody,
  });

  const callbackRes = await callbackRoute.POST(callbackReq as any);
  assert(callbackRes.status === 200, `bind-callback status 200 (${callbackRes.status})`);
  const callbackJson = await callbackRes.json() as any;
  assert(callbackJson.action === 'bind_success', `action = bind_success (${callbackJson.action})`);

  const ticketRows = await db.query(
    'SELECT status, hermes_user_id FROM bind_codes WHERE code = ?',
    [ticketBody.ticket],
  );
  assert(ticketRows.results[0]?.status === 'consumed', 'ticket 被消费');
  assert(ticketRows.results[0]?.hermes_user_id === 'provider_user_abc123456', 'ticket 记录 providerUserId');

  const bindingRows = await db.query(
    "SELECT external_id, channel FROM agent_bindings WHERE external_id = ? AND status = 'active'",
    ['provider_user_abc123456'],
  );
  assert(bindingRows.results.length === 1, '写入 active agent_binding');
  assert(bindingRows.results[0]?.channel === 'wechat', 'binding channel = wechat');

  const replayReq = new Request('http://local/api/bot/clawbot/bind-callback', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-clawbot-timestamp': signed.timestamp,
      'x-clawbot-nonce': signed.nonce,
      'x-clawbot-signature': signed.signature,
    },
    body: callbackBody,
  });
  const replayRes = await callbackRoute.POST(replayReq as any);
  assert(replayRes.status === 409, `重复 callback 返回 409 (${replayRes.status})`);

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
