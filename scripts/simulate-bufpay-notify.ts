/**
 * 模拟 BufPay 支付回调通知
 *
 * 运行前先 npm run dev 启动本地服务，然后:
 *   npx tsx scripts/simulate-bufpay-notify.ts
 */

import crypto from 'node:crypto';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const APP_SECRET = process.env.BUFPAY_APP_SECRET ?? 'test_secret';
const ORDER_ID = process.argv[2] ?? 'wxz_test';
const USER_ID = process.argv[3] ?? 'demo-user';
const PRICE = process.argv[4] ?? '29.00';

function md5Sign(...parts: string[]): string {
  return crypto
    .createHash('md5')
    .update(parts.join(''), 'utf8')
    .digest('hex')
    .toLowerCase();
}

async function simulateNotify() {
  const aoid = `sim_${Date.now().toString(36)}`;

  const sign = md5Sign(aoid, ORDER_ID, USER_ID, PRICE, PRICE, APP_SECRET);

  const body = new URLSearchParams({
    aoid,
    order_id: ORDER_ID,
    order_uid: USER_ID,
    price: PRICE,
    pay_price: PRICE,
    sign,
  });

  console.log(`模拟回调通知:`);
  console.log(`  URL: ${BASE_URL}/api/pay/notify`);
  console.log(`  order_id: ${ORDER_ID}`);
  console.log(`  aoid: ${aoid}`);
  console.log(`  price: ${PRICE}`);
  console.log(`  sign: ${sign}`);
  console.log('');

  try {
    const res = await fetch(`${BASE_URL}/api/pay/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const text = await res.text();
    console.log(`  响应状态: ${res.status}`);
    console.log(`  响应体: ${text}`);
  } catch (err) {
    console.error('  请求失败:', err instanceof Error ? err.message : String(err));
  }

  console.log('');

  // 测试错误签名
  console.log('测试错误签名:');
  const badSign = '00000000000000000000000000000000';
  const badBody = new URLSearchParams({
    aoid,
    order_id: ORDER_ID,
    order_uid: USER_ID,
    price: PRICE,
    pay_price: PRICE,
    sign: badSign,
  });

  try {
    const res = await fetch(`${BASE_URL}/api/pay/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: badBody.toString(),
    });

    const text = await res.text();
    console.log(`  响应状态: ${res.status} (应为 400)`);
    console.log(`  响应体: ${text}`);
  } catch (err) {
    console.error('  请求失败:', err instanceof Error ? err.message : String(err));
  }

  console.log('');

  // 测试重复回调（幂等）
  console.log('测试重复回调:');
  try {
    const res = await fetch(`${BASE_URL}/api/pay/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const text = await res.text();
    console.log(`  响应状态: ${res.status} (应为 200, 幂等通过)`);
    console.log(`  响应体: ${text}`);
  } catch (err) {
    console.error('  请求失败:', err instanceof Error ? err.message : String(err));
  }
}

simulateNotify();
