/**
 * E2E Smoke 测试 — 真实 HTTP Cookie Jar 全链路验证
 *
 * 前置: npm run dev
 * 运行: npx tsx scripts/test-e2e-smoke.ts
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const HAS_DEEPSEEK_KEY = Boolean(process.env.DEEPSEEK_API_KEY);
const HAS_ADMIN_TOKEN = Boolean(process.env.ADMIN_TOKEN);
let failures = 0;

function assert(cond: boolean, label: string) {
  if (!cond) { console.error(`  ❌ ${label}`); failures++; }
  else { console.log(`  ✅ ${label}`); }
}

let cookieHeader = '';

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  if (cookieHeader) headers.set('Cookie', cookieHeader);
  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers, redirect: 'manual' });

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const parts = setCookie.split(',');
    for (const p of parts) {
      const first = p.split(';')[0].trim();
      if (first.startsWith('auth_token=')) {
        cookieHeader = first;
      }
    }
  }

  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }

  return { status: res.status, body: body as Record<string, unknown> };
}

async function main() {
  console.log('E2E Smoke 测试\n');

  let userId = 0;
  let initialBalance = 0;

  // ---- 1. web-session ----
  console.log('=== 1. POST /api/auth/web-session ===');
  const s1 = await request('/api/auth/web-session', { method: 'POST' });
  assert(s1.status === 200, `status = ${s1.status}`);
  if (s1.status !== 200) {
    console.error(`  body: ${JSON.stringify(s1.body).slice(0, 200)}`);
    process.exit(1);
  }
  const s1Body = s1.body as Record<string, unknown>;
  assert((s1Body.user as Record<string, unknown>)?.id > 0, `user.id = ${(s1Body.user as Record<string, unknown>)?.id}`);
  assert((s1Body.user as Record<string, unknown>)?.token_balance >= 0, `token_balance = ${(s1Body.user as Record<string, unknown>)?.token_balance}`);
  assert(cookieHeader.startsWith('auth_token='), `cookie: ${cookieHeader.slice(0, 30)}...`);
  userId = (s1Body.user as Record<string, unknown>).id as number;
  initialBalance = (s1Body.user as Record<string, unknown>).token_balance as number;

  // ---- 2. user/me ----
  console.log('\n=== 2. GET /api/user/me ===');
  const u = await request('/api/user/me');
  assert(u.status === 200, `status = ${u.status}`);
  const uBody = u.body as Record<string, unknown>;
  assert(uBody.id === userId, `id match: ${uBody.id} === ${userId}`);
  if (typeof uBody.token_balance === 'number' && uBody.token_balance >= 0) {
    console.log(`  ✅ token_balance = ${uBody.token_balance}${uBody.token_balance !== initialBalance ? ' (MockAdapter 跨路由不共享)' : ''}`);
  } else {
    assert(false, `token_balance invalid: ${uBody.token_balance}`);
  }

  // ---- 3. user/tokens ----
  console.log('\n=== 3. GET /api/user/tokens ===');
  const t = await request('/api/user/tokens');
  assert(t.status === 200, `status = ${t.status}`);
  const tBody = t.body as Record<string, unknown>;
  assert(typeof tBody.token_balance === 'number', `balance: ${tBody.token_balance}`);
  assert(Array.isArray(tBody.ledger), `ledger entries: ${(tBody.ledger as unknown[])?.length}`);
  assert((tBody.total_purchased as number) >= 0, `total_purchased: ${tBody.total_purchased}`);

  // ---- 4. user/orders ----
  console.log('\n=== 4. GET /api/user/orders ===');
  const o = await request('/api/user/orders');
  assert(o.status === 200, `status = ${o.status}`);
  assert(Array.isArray((o.body as Record<string, unknown>).orders), 'orders is array');

  // ---- 5. health ----
  console.log('\n=== 5. GET /api/health ===');
  const h = await request('/api/health');
  assert(h.status === 200, `status = ${h.status}`);
  assert((h.body as Record<string, unknown>).ok === true, 'ok = true');

  // ---- 6. legal pages ----
  console.log('\n=== 6. GET /legal/privacy /legal/terms ===');
  const priv = await fetch(`${BASE_URL}/legal/privacy`);
  assert(priv.status === 200, `/legal/privacy: ${priv.status}`);
  const terms = await fetch(`${BASE_URL}/legal/terms`);
  assert(terms.status === 200, `/legal/terms: ${terms.status}`);

  // ---- 7. chat/send (needs DEEPSEEK_API_KEY) ----
  console.log('\n=== 7. POST /api/chat/send ===');
  if (!HAS_DEEPSEEK_KEY) {
    console.log('  ⏭️  SKIP: DEEPSEEK_API_KEY 未配置');
  } else {
    const c = await request('/api/chat/send', {
      method: 'POST',
      body: JSON.stringify({ message: '你好小王子' }),
    });
    if (c.status === 402) {
      console.log(`  ⚠️  402 Token 余额不足 (balance: ${initialBalance})`);
    } else {
      assert(c.status === 200, `status = ${c.status}`);
      const cBody = c.body as Record<string, unknown>;
      assert(typeof cBody.reply === 'string' && (cBody.reply as string).length > 0,
        `reply: ${(cBody.reply as string)?.slice(0, 40)}`);
      assert((cBody.usage as Record<string, unknown>)?.total_tokens > 0,
        `usage.total_tokens > 0`);
      assert(typeof cBody.remaining_tokens === 'number',
        `remaining: ${cBody.remaining_tokens}`);
    }
  }

  // ---- 8. admin overview ----
  console.log('\n=== 8. GET /api/admin/overview ===');
  if (!HAS_ADMIN_TOKEN) {
    console.log('  ⏭️  SKIP: ADMIN_TOKEN 未配置');
  } else {
    const a = await request('/api/admin/overview', {
      headers: { 'x-admin-token': process.env.ADMIN_TOKEN ?? '' },
    });
    assert(a.status === 200, `status = ${a.status}`);
    assert(typeof (a.body as Record<string, unknown>).users_count === 'number',
      `users_count: ${(a.body as Record<string, unknown>).users_count}`);
  }

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('测试异常:', e); process.exit(1); });
