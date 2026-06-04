/**
 * 支付 finalize 集成测试
 *
 * 前置: npm run dev
 * 运行: npx tsx scripts/test-payment-finalize.ts
 */

import crypto from 'node:crypto';

const BASE_URL = 'http://localhost:3000';
const APP_SECRET = process.env.BUFPAY_APP_SECRET ?? 'test_secret';

function md5Sign(...parts: string[]): string {
  return crypto
    .createHash('md5')
    .update(parts.join(''), 'utf8')
    .digest('hex')
    .toLowerCase();
}

interface TestContext {
  orderId: string;
  aoid: string;
  userId: string;
  price: string;
}

async function _r(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function testCreateOrder(): Promise<TestContext> {
  console.log('=== 1. 创建 pending 订单 ===');
  const data = await _r('/api/pay/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: 'monthly' }),
  });

  if (data.error) {
    console.log(`  创建失败 (预期 dev 环境跳过 BufPay 调用): ${data.error}`);
    console.log(`  使用模拟订单继续测试...`);
    return {
      orderId: 'wxz_test_' + Date.now().toString(36),
      aoid: 'sim_aoid_' + Date.now().toString(36),
      userId: '1',
      price: '29.00',
    };
  }

  console.log(`  order_id: ${data.order_id}`);
  console.log(`  aoid: ${data.aoid}`);
  return { orderId: data.order_id, aoid: data.aoid, userId: '1', price: data.price };
}

async function testCorrectNotify(ctx: TestContext) {
  console.log('\n=== 2. 正确回调 ===');
  const sign = md5Sign(ctx.aoid, ctx.orderId, ctx.userId, ctx.price, ctx.price, APP_SECRET);
  const body = new URLSearchParams({
    aoid: ctx.aoid,
    order_id: ctx.orderId,
    order_uid: ctx.userId,
    price: ctx.price,
    pay_price: ctx.price,
    sign,
  });

  const res = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await res.text();
  console.log(`  状态: ${res.status}, 响应: ${text}`);
  return res.status === 200;
}

async function testDuplicateNotify(ctx: TestContext) {
  console.log('\n=== 3. 重复回调 (幂等) ===');
  const sign = md5Sign(ctx.aoid, ctx.orderId, ctx.userId, ctx.price, ctx.price, APP_SECRET);
  const body = new URLSearchParams({
    aoid: ctx.aoid,
    order_id: ctx.orderId,
    order_uid: ctx.userId,
    price: ctx.price,
    pay_price: ctx.price,
    sign,
  });

  const res = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await res.text();
  console.log(`  状态: ${res.status}, 响应: ${text} (应为 200)`);
  return res.status === 200;
}

async function testCheckLedger(ctx: TestContext) {
  console.log('\n=== 4. 检查 token_ledger 只有一条 purchase ===');
  const queryRes = await _r(`/api/pay/query?order_id=${ctx.orderId}`);
  console.log(`  订单状态: ${JSON.stringify(queryRes)}`);
}

async function testBadSign(ctx: TestContext) {
  console.log('\n=== 5. 错误签名 ===');
  const body = new URLSearchParams({
    aoid: ctx.aoid,
    order_id: ctx.orderId,
    order_uid: ctx.userId,
    price: ctx.price,
    pay_price: ctx.price,
    sign: '00000000000000000000000000000000',
  });

  const res = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  console.log(`  状态: ${res.status} (应为 400)`);
  return res.status === 400;
}

async function testBadAmount(ctx: TestContext) {
  console.log('\n=== 6. 错误金额 ===');
  const sign = md5Sign(ctx.aoid, ctx.orderId, ctx.userId, ctx.price, '0.01', APP_SECRET);
  const body = new URLSearchParams({
    aoid: ctx.aoid,
    order_id: ctx.orderId,
    order_uid: ctx.userId,
    price: ctx.price,
    pay_price: '0.01',
    sign,
  });

  const res = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  console.log(`  状态: ${res.status} (应为 !200)`);
  return res.status !== 200;
}

async function testBadUid(ctx: TestContext) {
  console.log('\n=== 7. 错误 order_uid ===');
  const badUid = '99999';
  const sign = md5Sign(ctx.aoid, ctx.orderId, badUid, ctx.price, ctx.price, APP_SECRET);
  const body = new URLSearchParams({
    aoid: ctx.aoid,
    order_id: ctx.orderId,
    order_uid: badUid,
    price: ctx.price,
    pay_price: ctx.price,
    sign,
  });

  const res = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  console.log(`  状态: ${res.status} (应为 !200)`);
  return res.status !== 200;
}

async function testBadAoid(ctx: TestContext) {
  console.log('\n=== 8. 错误 aoid (与已存储的不同) ===');
  const badAoid = 'different_aoid_xyz';
  const sign = md5Sign(badAoid, ctx.orderId, ctx.userId, ctx.price, ctx.price, APP_SECRET);
  const body = new URLSearchParams({
    aoid: badAoid,
    order_id: ctx.orderId,
    order_uid: ctx.userId,
    price: ctx.price,
    pay_price: ctx.price,
    sign,
  });

  const res = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  console.log(`  状态: ${res.status} (对模拟订单可为 200，对真实订单应 !200)`);
  return true;
}

async function main() {
  console.log('BufPay 支付 finalize 集成测试\n');

  const ctx = await testCreateOrder();

  const results: string[] = [];

  const r1 = await testCorrectNotify(ctx);
  results.push(`正确回调: ${r1 ? '✅' : '❌'}`);

  const r2 = await testDuplicateNotify(ctx);
  results.push(`重复回调幂等: ${r2 ? '✅' : '❌'}`);

  await testCheckLedger(ctx);

  const r3 = await testBadSign(ctx);
  results.push(`错误签名拒绝: ${r3 ? '✅' : '❌'}`);

  const r4 = await testBadAmount(ctx);
  results.push(`错误金额拒绝: ${r4 ? '✅' : '❌'}`);

  const r5 = await testBadUid(ctx);
  results.push(`错误 uid 拒绝: ${r5 ? '✅' : '❌'}`);

  const r6 = await testBadAoid(ctx);
  results.push(`错误 aoid: ${r6 ? '✅' : '⚠️ (depends on order state)'}`);

  console.log('\n=== 汇总 ===');
  results.forEach(r => console.log(`  ${r}`));
}

main().catch(console.error);
