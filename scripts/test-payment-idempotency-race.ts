/**
 * E2E Concurrency Race and Idempotency Test for Payment Callback
 *
 * Runs natively on Node.js without external dependencies like tsx/ts-node.
 * Uses wrangler CLI to execute queries on the remote D1 production database.
 */
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const BASE_URL = process.env.BASE_URL ?? 'https://wan.lat';
const BUFPAY_APP_SECRET = process.env.BUFPAY_APP_SECRET ?? '';

let failures = 0;

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`  ❌ ${label}`);
    failures++;
  } else {
    console.log(`  ✅ ${label}`);
  }
}

function md5Sign(...parts: string[]): string {
  return crypto.createHash('md5').update(parts.join(''), 'utf8').digest('hex').toLowerCase();
}

function d1Execute(sql: string): any {
  // Execute via wrangler CLI
  const cmd = `npx wrangler d1 execute xiaowangzi-production --remote --env production --json --command "${sql.replace(/"/g, '\\"')}"`;
  const stdout = execSync(cmd, { encoding: 'utf8' });
  const data = JSON.parse(stdout);
  return data[0];
}

async function request(pathStr: string, init: RequestInit & { cookie?: string } = {}) {
  const { cookie, ...rest } = init;
  const headers = new Headers(rest.headers ?? {});
  if (cookie) headers.set('Cookie', cookie);
  if (!headers.get('Content-Type') && rest.method === 'POST') {
    headers.set('Content-Type', rest.body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json');
  }

  const res = await fetch(`${BASE_URL}${pathStr}`, { ...rest, headers, redirect: 'manual' });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}

async function main() {
  console.log('=== Payment Idempotency Race Test (Native Node) ===\n');
  console.log(`BASE_URL: ${BASE_URL}`);

  if (!BUFPAY_APP_SECRET || BUFPAY_APP_SECRET === 'test_secret') {
    console.error('❌ Error: BUFPAY_APP_SECRET env is required.');
    process.exit(1);
  }

  // 1. Web session login
  console.log('=== 1. Login ===');
  const s1 = await request('/api/auth/web-session', { method: 'POST' });
  assert(s1.status === 200, `Login status: ${s1.status}`);
  const s1Body = s1.body as Record<string, unknown>;
  const userId = s1Body.user ? (s1Body.user as Record<string, unknown>).id as number : 0;
  const initialBalance = s1Body.user ? (s1Body.user as Record<string, unknown>).token_balance as number : 0;
  assert(userId > 0, `User ID: ${userId}, Initial Balance: ${initialBalance}`);
  const setCookie = s1.headers.get('set-cookie') ?? '';
  const authCookie = setCookie.split(';')[0].trim();

  // 2. Insert fresh pending order using wrangler CLI
  console.log('\n=== 2. Creating pending order in D1 ===');
  const ts = Date.now();
  const orderId = `wxz_race_test_${ts}`;
  const aoid = `aoid_race_${ts}`;
  const planId = 'monthly';
  const priceYuan = '29.00';
  const amountCents = 2900;
  const tokensAmount = 100000;

  d1Execute(
    `INSERT INTO payment_orders (user_id, order_id, bufpay_aoid, plan, tokens_amount, amount_cents, pay_type, status) VALUES (${userId}, '${orderId}', '${aoid}', '${planId}', ${tokensAmount}, ${amountCents}, 'wechat', 'pending');`
  );
  console.log(`  Inserted order: ${orderId}`);

  // 3. Prepare parameters for concurrent notifies
  console.log('\n=== 3. Sending 10 concurrent notify requests ===');
  const correctSign = md5Sign(aoid, orderId, String(userId), priceYuan, priceYuan, BUFPAY_APP_SECRET);
  const notifyBody = new URLSearchParams({
    aoid,
    order_id: orderId,
    order_uid: String(userId),
    price: priceYuan,
    pay_price: priceYuan,
    sign: correctSign,
  });

  const promises = Array.from({ length: 10 }).map((_, index) => {
    return fetch(`${BASE_URL}/api/pay/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: notifyBody.toString(),
    }).then(async (res) => {
      const text = await res.text();
      return { index, status: res.status, body: text };
    });
  });

  const responses = await Promise.all(promises);
  console.log('  Responses received:');
  for (const r of responses) {
    console.log(`    Request #${r.index + 1}: status = ${r.status}, body = ${r.body.trim()}`);
  }

  // 4. Verify DB state integrity
  console.log('\n=== 4. Verifying DB state ===');
  
  // 4.1 Order status
  const orders = d1Execute(`SELECT status FROM payment_orders WHERE order_id = '${orderId}';`);
  const finalOrderStatus = orders.results[0]?.status as string;
  assert(finalOrderStatus === 'paid', `Order status should be paid, got: ${finalOrderStatus}`);

  // 4.2 Token Ledger purchase count
  const ledgers = d1Execute(
    `SELECT COUNT(*) as count FROM token_ledger WHERE source_id = '${orderId}' AND source = 'bufpay' AND type = 'purchase';`
  );
  const ledgerCount = ledgers.results[0]?.count as number;
  assert(ledgerCount === 1, `Ledger purchase entries count should be exactly 1, got: ${ledgerCount}`);

  // 4.3 Users token balance should increase exactly once
  const um = await request('/api/user/me', { cookie: authCookie });
  const finalBalance = (um.body as Record<string, unknown>).token_balance as number;
  const expectedBalance = initialBalance + tokensAmount;
  assert(finalBalance === expectedBalance, `Balance should increase once to ${expectedBalance}, got: ${finalBalance}`);

  // 4.4 Compare token_ledger sum vs users.token_balance
  const sumLedgers = d1Execute(
    `SELECT SUM(delta_tokens) as sum FROM token_ledger WHERE user_id = ${userId};`
  );
  const ledgerSum = sumLedgers.results[0]?.sum as number;
  assert(ledgerSum === finalBalance, `Users token_balance (${finalBalance}) matches ledger sum (${ledgerSum})`);

  // 5. Replay notify again (11th time)
  console.log('\n=== 5. Replaying notify (11th time) ===');
  const nRep = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: notifyBody.toString(),
  });
  assert(nRep.status === 200, `Replay status: ${nRep.status}`);
  const nRepText = await nRep.text();
  assert(nRepText === 'ok', `Replay body: ${nRepText}`);

  // Check balance again
  const umRep = await request('/api/user/me', { cookie: authCookie });
  const balanceAfterReplay = (umRep.body as Record<string, unknown>).token_balance as number;
  assert(balanceAfterReplay === expectedBalance, `Balance after replay remains unchanged: ${balanceAfterReplay} (expected: ${expectedBalance})`);

  console.log(`\n=== Result: ${failures === 0 ? 'ALL PASSED ✅' : `${failures} FAILURES ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
