/**
 * BufPay Staging 支付联调测试
 *
 * 在 Cloudflare remote staging 上验证完整支付闭环:
 * 1. 创建订单
 * 2. 模拟 BufPay 回调 (真实签名)
 * 3. 验证 D1 数据
 * 4. 幂等 / 错误签名 / 金额不匹配测试
 */
import crypto from 'node:crypto';

const BASE_URL = process.env.BASE_URL ?? 'https://xiaowangzi.348421501.workers.dev';
const BUFPAY_APP_SECRET = process.env.BUFPAY_APP_SECRET ?? '';
let failures = 0;

function assert(cond: boolean, label: string) {
  if (!cond) { console.error(`  ❌ ${label}`); failures++; }
  else { console.log(`  ✅ ${label}`); }
}

function md5Sign(...parts: string[]): string {
  return crypto.createHash('md5').update(parts.join(''), 'utf8').digest('hex').toLowerCase();
}

async function request(path: string, init: RequestInit & { cookie?: string } = {}) {
  const { cookie, ...rest } = init;
  const headers = new Headers(rest.headers ?? {});
  if (cookie) headers.set('Cookie', cookie);
  if (!headers.get('Content-Type') && rest.method === 'POST') {
    headers.set('Content-Type', rest.body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json');
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...rest, headers, redirect: 'manual' });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body: body as Record<string, unknown>, headers: res.headers };
}

async function main() {
  console.log('BufPay Staging 支付联调测试\n');

  // ---- 1. 登录获取 session ----
  console.log('=== 1. 登录 ===');
  const s1 = await request('/api/auth/web-session', { method: 'POST' });
  assert(s1.status === 200, `web-session status: ${s1.status}`);
  const s1Body = s1.body as Record<string, unknown>;
  const userId = s1Body.user ? (s1Body.user as Record<string, unknown>).id as number : 0;
  const initialBalance = s1Body.user ? (s1Body.user as Record<string, unknown>).token_balance as number : 0;
  assert(userId > 0, `user.id = ${userId}`);
  const setCookie = s1.headers.get('set-cookie') ?? '';
  const authCookie = setCookie.split(';')[0].trim();
  assert(authCookie.startsWith('auth_token='), `cookie: ${authCookie.slice(0, 30)}...`);

  // ---- 2. 创建订单 ----
  console.log('\n=== 2. 创建 BufPay 订单 ===');
  if (!BUFPAY_APP_SECRET || BUFPAY_APP_SECRET === 'test_secret') {
    console.log('  ⏭️  SKIP: BUFPAY_APP_SECRET 未配置真实值');
    process.exit(1);
  }
  const planId = 'monthly';
  const co = await request('/api/pay/create-order', {
    method: 'POST',
    cookie: authCookie,
    body: JSON.stringify({ plan: planId }),
  });
  assert(co.status === 200, `create-order status: ${co.status}`);
  if (co.status !== 200) { console.error(`  body: ${JSON.stringify(co.body)}`); process.exit(1); }
  const coBody = co.body as Record<string, unknown>;
  const orderId = coBody.order_id as string;
  const aoid = coBody.aoid as string;
  const price = coBody.price as string;
  assert(typeof orderId === 'string' && orderId.length > 0, `order_id: ${orderId}`);
  assert(typeof aoid === 'string' && aoid.length > 0, `aoid: ${aoid}`);
  assert(typeof price === 'string' && price.length > 0, `price: ${price}`);
  console.log(`  order_id: ${orderId}`);
  console.log(`  aoid: ${aoid}`);
  console.log(`  price: ${price}`);
  console.log(`  plan: ${coBody.plan_name}`);

  // ---- 3. 检查订单在 D1 (通过 API) ----
  console.log('\n=== 3. 检查订单状态 ===');
  const pq = await request(`/api/pay/query?order_id=${orderId}`, { cookie: authCookie });
  assert(pq.status === 200, `query status: ${pq.status}`);
  const pqBody = pq.body as Record<string, unknown>;
  assert(pqBody.status === 'pending', `order status: ${pqBody.status} (expected pending)`);

  // ---- 4. 正确 sign 的 notify ----
  console.log('\n=== 4. BufPay notify (正确签名) ===');
  const correctSign = md5Sign(aoid, orderId, String(userId), price, price, BUFPAY_APP_SECRET);
  const notifyBody = new URLSearchParams({
    aoid, order_id: orderId, order_uid: String(userId), price, pay_price: price, sign: correctSign,
  });
  const n1 = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: notifyBody.toString(),
  });
  assert(n1.status === 200, `correct sign notify: ${n1.status} (expected 200)`);
  const n1Text = await n1.text();
  assert(n1Text === 'ok', `notify response: ${n1Text}`);
  console.log(`  body: ${n1Text}`);

  // ---- 5. 验证订单已 paid ----
  console.log('\n=== 5. 验证订单 paid ===');
  const pq2 = await request(`/api/pay/query?order_id=${orderId}`, { cookie: authCookie });
  assert(pq2.status === 200, `query status: ${pq2.status}`);
  const pq2Body = pq2.body as Record<string, unknown>;
  assert(pq2Body.status === 'paid', `order status: ${pq2Body.status} (expected paid)`);

  // ---- 6. 验证 token_ledger purchase ----
  console.log('\n=== 6. 验证 token_ledger purchase ===');
  const ut = await request('/api/user/tokens', { cookie: authCookie });
  assert(ut.status === 200, `tokens status: ${ut.status}`);
  const utBody = ut.body as Record<string, unknown>;
  const ledger = utBody.ledger as Array<Record<string, unknown>>;
  const purchaseEntry = ledger.find((l) => l.type === 'purchase');
  assert(purchaseEntry !== undefined, 'purchase entry exists in ledger');
  if (purchaseEntry) {
    assert(purchaseEntry.delta_tokens as number > 0, `purchase delta: ${purchaseEntry.delta_tokens}`);
    assert(purchaseEntry.source === 'bufpay', `source: ${purchaseEntry.source}`);
    assert(purchaseEntry.source_id === orderId, `source_id match: ${purchaseEntry.source_id} === ${orderId}`);
  }

  // ---- 7. 验证 token balance 增加 ----
  console.log('\n=== 7. 验证 token balance ===');
  const um = await request('/api/user/me', { cookie: authCookie });
  assert(um.status === 200, `me status: ${um.status}`);
  const umBody = um.body as Record<string, unknown>;
  const newBalance = umBody.token_balance as number;
  assert(newBalance > initialBalance, `balance ${newBalance} > ${initialBalance}`);
  console.log(`  initial: ${initialBalance} → current: ${newBalance} (+${newBalance - initialBalance})`);

  // ---- 8. 幂等重放 ----
  console.log('\n=== 8. 幂等重放 (same notify again) ===');
  const n2 = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: notifyBody.toString(),
  });
  assert(n2.status === 200, `replay notify: ${n2.status} (expected 200, 幂等)`);
  const n2Text = await n2.text();
  assert(n2Text === 'ok', `replay response: ${n2Text}`);
  // 验证 balance 不变
  const um2 = await request('/api/user/me', { cookie: authCookie });
  const um2Body = um2.body as Record<string, unknown>;
  const balanceAfterReplay = um2Body.token_balance as number;
  assert(balanceAfterReplay === newBalance, `balance unchanged after replay: ${balanceAfterReplay} === ${newBalance}`);

  // ---- 9. 错误 sign ----
  console.log('\n=== 9. 错误 sign ===');
  const badBody = new URLSearchParams({
    aoid, order_id: orderId, order_uid: String(userId), price, pay_price: price,
    sign: '00000000000000000000000000000000',
  });
  const n3 = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: badBody.toString(),
  });
  assert(n3.status === 400, `bad sign notify: ${n3.status} (expected 400)`);
  const n3Text = await n3.text();
  assert(n3Text === 'sign error', `bad sign response: ${n3Text}`);

  // ---- 10. 错误金额 ----
  console.log('\n=== 10. 错误金额 ===');
  const wrongBody = new URLSearchParams({
    aoid, order_id: orderId, order_uid: String(userId),
    price: '0.01', pay_price: '0.01',
    sign: md5Sign(aoid, orderId, String(userId), '0.01', '0.01', BUFPAY_APP_SECRET),
  });
  const n4 = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: wrongBody.toString(),
  });
  assert(n4.status === 500, `wrong amount notify: ${n4.status} (expected 500)`);
  const n4Text = await n4.text();
  assert(n4Text === 'amount mismatch', `wrong amount response: ${n4Text}`);

  // ---- 11. subscription 验证 ----
  console.log('\n=== 11. 验证 subscription ===');
  const us = await request('/api/user/subscription', { cookie: authCookie });
  assert(us.status === 200, `subscription status: ${us.status}`);
  const usBody = us.body as Record<string, unknown>;
  const sub = usBody.subscription as Record<string, unknown> | null;
  assert(sub !== null, 'subscription exists');
  if (sub) {
    assert(sub.plan === 'monthly', `plan: ${sub.plan}`);
    assert(sub.status === 'active', `status: ${sub.status}`);
  }

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  console.log(`order_id=${orderId} aoid=${aoid} user_id=${userId}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('测试异常:', e); process.exit(1); });
