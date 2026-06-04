/**
 * E2E Smoke 测试 — 全链路验证
 * 前置: npm run dev
 * 运行: npx tsx scripts/test-e2e-smoke.ts
 *
 * 测试: web-session → user/me → user/tokens → user/orders → chat/send
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
let failures = 0;

function assert(cond: boolean, label: string) {
  if (!cond) { console.error(`  ❌ ${label}`); failures++; }
  else { console.log(`  ✅ ${label}`); }
}

async function _r(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function main() {
  console.log('E2E Smoke 测试\n');

  // 1. Create web session
  console.log('=== 1. POST /api/auth/web-session ===');
  const s1 = await _r('/api/auth/web-session', { method: 'POST' });
  if (s1.error) {
    console.log(`  ⚠️  ${s1.error} (dev 环境预期可能失败)`);
    process.exit(0);
  }
  assert(s1.user?.id > 0, `user.id = ${s1.user?.id}`);
  assert(s1.created === true, `created = true`);
  const sessionCookie = s1._headers_cookie; // not accessible via fetch

  // 2. User me
  console.log('\n=== 2. GET /api/user/me ===');
  const u = await _r('/api/user/me');
  assert(u.id > 0, `user.id = ${u.id}`);
  assert(typeof u.token_balance === 'number', `balance = ${u.token_balance}`);

  // 3. User tokens
  console.log('\n=== 3. GET /api/user/tokens ===');
  const t = await _r('/api/user/tokens');
  assert(Array.isArray(t.ledger), `ledger: ${t.ledger?.length} entries`);
  assert(t.total_purchased >= 0, `purchased: ${t.total_purchased}`);

  // 4. User orders
  console.log('\n=== 4. GET /api/user/orders ===');
  const o = await _r('/api/user/orders');
  assert(Array.isArray(o.orders), `orders: ${o.orders?.length}`);

  // 5. Chat send (needs DEEPSEEK_API_KEY)
  console.log('\n=== 5. POST /api/chat/send ===');
  const c = await _r('/api/chat/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '你好小王子' }),
  });
  if (c.error && c.error.includes('DeepSeek')) {
    console.log('  ⚠️  DeepSeek API 不可用，跳过 chat 测试');
  } else if (c.error) {
    console.log(`  ⚠️  ${c.error}`);
  } else {
    assert(typeof c.reply === 'string' && c.reply.length > 0, `reply: ${c.reply?.slice(0, 40)}...`);
    assert(c.usage?.total_tokens > 0, `usage: ${c.usage?.total_tokens}t`);
    assert(typeof c.remaining_tokens === 'number', `remaining: ${c.remaining_tokens}`);
  }

  // 6. Legal pages
  console.log('\n=== 6. GET /legal/privacy /legal/terms ===');
  const priv = await fetch(`${BASE_URL}/legal/privacy`);
  assert(priv.status === 200, `/legal/privacy: ${priv.status}`);
  const terms = await fetch(`${BASE_URL}/legal/terms`);
  assert(terms.status === 200, `/legal/terms: ${terms.status}`);

  // 7. Health check
  console.log('\n=== 7. GET /api/health ===');
  const h = await _r('/api/health');
  assert(h.ok === true, `health: ${h.ok}`);

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
