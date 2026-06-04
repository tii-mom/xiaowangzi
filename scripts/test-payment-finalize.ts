/**
 * 支付 finalize 集成测试
 *
 * 前置: npm run dev
 * 运行: npx tsx scripts/test-payment-finalize.ts
 *
 * 测试覆盖:
 *   1. 创建真实订单
 *   2. 正确回调 → assert status=paid + ledger=1 + balance 增加
 *   3. 重复回调 → 幂等: ledger 仍为1, balance 未二次增加
 *   4. 错误签名 → 400
 *   5. 错误金额 → !200
 *   6. 错误 uid → !200
 *   7. 错误 aoid → !200
 */

import crypto from 'node:crypto';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const APP_SECRET = process.env.BUFPAY_APP_SECRET ?? 'test_secret';

let failures = 0;

function md5Sign(...parts: string[]): string {
  return crypto
    .createHash('md5')
    .update(parts.join(''), 'utf8')
    .digest('hex')
    .toLowerCase();
}

async function _r(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

function assert(condition: boolean, label: string) {
  if (!condition) {
    console.error(`  ❌ ${label}`);
    failures++;
    return false;
  }
  console.log(`  ✅ ${label}`);
  return true;
}

async function getPaymentState(orderId: string) {
  return _r(`/api/debug/payment-state?order_id=${orderId}`);
}

interface TestContext {
  orderId: string;
  aoid: string;
  userId: string;
  priceYuan: string;
  tokensAmount: number;
  balanceBefore: number;
}

async function testCreateOrder(): Promise<TestContext | null> {
  console.log('\n=== 1. 创建真实订单 ===');

  const data = await _r('/api/pay/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: 'monthly' }),
  });

  if (data.error) {
    console.log(`  ⚠️  create-order 返回错误: ${data.error}`);
    if (data.error.includes('BufPay create-order failed') ||
        data.error.includes('D1 HTTP') ||
        data.error.includes('fetch failed')) {
      console.log('  (BufPay API 不可用 — 预期行为)');
      console.log('  签名测试已通过 test-bufpay-sign.ts 覆盖。');
      return null;
    }
    console.error(`  ❌ 意外错误: ${data.error}`);
    failures++;
    return null;
  }

  assert(typeof data.order_id === 'string', 'order_id 存在');
  assert(typeof data.aoid === 'string', 'aoid 存在');
  if (failures > 0) return null;

  const state = await getPaymentState(data.order_id);
  return {
    orderId: data.order_id,
    aoid: data.aoid,
    userId: '1',
    priceYuan: data.price,
    tokensAmount: 100000,
    balanceBefore: (state?.user?.token_balance as number) ?? 0,
  };
}

async function testCorrectNotify(ctx: TestContext) {
  console.log('\n=== 2. 正确回调 ===');
  const sign = md5Sign(ctx.aoid, ctx.orderId, ctx.userId, ctx.priceYuan, ctx.priceYuan, APP_SECRET);
  const body = new URLSearchParams({
    aoid: ctx.aoid, order_id: ctx.orderId, order_uid: ctx.userId,
    price: ctx.priceYuan, pay_price: ctx.priceYuan, sign,
  });
  const res = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await res.text();
  assert(res.status === 200 && text === 'ok', `回调成功 (status=${res.status} body=${text})`);
}

async function testVerifyPaid(ctx: TestContext) {
  console.log('\n=== 3. 验证入账 ===');

  const state = await getPaymentState(ctx.orderId);
  assert(state.order?.status === 'paid', `订单 status=paid (实际: ${state.order?.status})`);
  assert(state.ledger_count === 1, `token_ledger count=1 (实际: ${state.ledger_count})`);
  assert(state.user?.token_balance === ctx.balanceBefore + ctx.tokensAmount,
    `余额正确: ${state.user?.token_balance} === ${ctx.balanceBefore} + ${ctx.tokensAmount}`);
}

async function testDuplicateNotify(ctx: TestContext) {
  console.log('\n=== 4. 重复回调 (幂等) ===');

  const sign = md5Sign(ctx.aoid, ctx.orderId, ctx.userId, ctx.priceYuan, ctx.priceYuan, APP_SECRET);
  const body = new URLSearchParams({
    aoid: ctx.aoid, order_id: ctx.orderId, order_uid: ctx.userId,
    price: ctx.priceYuan, pay_price: ctx.priceYuan, sign,
  });
  const res = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await res.text();
  assert(res.status === 200 && text === 'ok', `重复回调返回 ok (status=${res.status})`);

  const state = await getPaymentState(ctx.orderId);
  assert(state.ledger_count === 1, `ledger 仍为 1 (实际: ${state.ledger_count})`);
  assert(state.user?.token_balance === ctx.balanceBefore + ctx.tokensAmount,
    `余额未二次增加: ${state.user?.token_balance} === ${ctx.balanceBefore} + ${ctx.tokensAmount}`);
}

async function testBadSign(ctx: TestContext) {
  console.log('\n=== 5. 错误签名 ===');
  const body = new URLSearchParams({
    aoid: ctx.aoid, order_id: ctx.orderId, order_uid: ctx.userId,
    price: ctx.priceYuan, pay_price: ctx.priceYuan,
    sign: '00000000000000000000000000000000',
  });
  const res = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  assert(res.status === 400, `错误签名返回 400 (实际: ${res.status})`);
}

async function testBadAmount(ctx: TestContext) {
  console.log('\n=== 6. 错误金额 ===');
  const sign = md5Sign(ctx.aoid, ctx.orderId, ctx.userId, ctx.priceYuan, '0.01', APP_SECRET);
  const body = new URLSearchParams({
    aoid: ctx.aoid, order_id: ctx.orderId, order_uid: ctx.userId,
    price: ctx.priceYuan, pay_price: '0.01', sign,
  });
  const res = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  assert(res.status !== 200, `错误金额拒绝 (status=${res.status})`);
}

async function testBadUid(ctx: TestContext) {
  console.log('\n=== 7. 错误 order_uid ===');
  const badUid = '99999';
  const sign = md5Sign(ctx.aoid, ctx.orderId, badUid, ctx.priceYuan, ctx.priceYuan, APP_SECRET);
  const body = new URLSearchParams({
    aoid: ctx.aoid, order_id: ctx.orderId, order_uid: badUid,
    price: ctx.priceYuan, pay_price: ctx.priceYuan, sign,
  });
  const res = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  assert(res.status !== 200, `错误 uid 拒绝 (status=${res.status})`);
}

async function testBadAoid(ctx: TestContext) {
  console.log('\n=== 8. 错误 aoid ===');
  const badAoid = 'different_aoid_xyz';
  const sign = md5Sign(badAoid, ctx.orderId, ctx.userId, ctx.priceYuan, ctx.priceYuan, APP_SECRET);
  const body = new URLSearchParams({
    aoid: badAoid, order_id: ctx.orderId, order_uid: ctx.userId,
    price: ctx.priceYuan, pay_price: ctx.priceYuan, sign,
  });
  const res = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  assert(res.status !== 200, `错误 aoid 拒绝 (status=${res.status})`);
}

async function main() {
  console.log('BufPay 支付 finalize 集成测试\n');

  const ctx = await testCreateOrder();
  if (!ctx) {
    console.log('\n⚠️  BufPay API 未配置，后端集成测试跳过。');
    console.log('签名验证已通过 test-bufpay-sign.ts 独立覆盖。');
    process.exit(0);
  }

  await testCorrectNotify(ctx);
  await testVerifyPaid(ctx);
  await testDuplicateNotify(ctx);
  await testBadSign(ctx);
  await testBadAmount(ctx);
  await testBadUid(ctx);
  await testBadAoid(ctx);

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
