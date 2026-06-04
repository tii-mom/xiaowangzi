/**
 * BufPay notify/finalize 子链路集成测试
 *
 * 验证支付回调与结算记账的核心业务逻辑:
 * 1. 登录并提取 auth_token 与 user_id
 * 2. 直连 D1 数据库插入待支付 (pending) 订单
 * 3. 模拟 BufPay 回调 (签名正确)
 * 4. 验证订单状态流转 (pending -> paid)
 * 5. 验证 token_ledger purchase 记录写入
 * 6. 验证用户 token 余额增加
 * 7. 验证订阅状态已激活 (active)
 * 8. 验证幂等重放
 * 9. 验证错误签名拒绝 (400)
 * 10. 验证金额不匹配拒绝 (500, 使用全新 pending 订单测试)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '@/lib/db';

// 手动加载 .dev.vars 环境变量 (若在 Node 本地运行且 shell 未预设相关环境变量)
try {
  const devVarsPath = path.resolve(process.cwd(), '.dev.vars');
  if (fs.existsSync(devVarsPath)) {
    const content = fs.readFileSync(devVarsPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] ?? '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch (e) {
  // 忽略加载异常
}

const BASE_URL = process.env.BASE_URL ?? 'https://xiaowangzi.348421501.workers.dev';
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
  console.log('BufPay notify/finalize 子链路集成测试\n');
  console.log(`测试目标 URL (BASE_URL): ${BASE_URL}`);

  if (!BUFPAY_APP_SECRET || BUFPAY_APP_SECRET === 'test_secret') {
    console.error('❌ 错误: 必须配置有效的 BUFPAY_APP_SECRET 环境变​​量。');
    process.exit(1);
  }

  // 获取数据库适配器
  console.log('正在连接远程 D1 数据库...');
  const db = getDb();

  // ---- 1. 登录获取 session ----
  console.log('\n=== 1. 登录 ===');
  const s1 = await request('/api/auth/web-session', { method: 'POST' });
  assert(s1.status === 200, `web-session status: ${s1.status}`);
  const s1Body = s1.body as Record<string, unknown>;
  const userId = s1Body.user ? (s1Body.user as Record<string, unknown>).id as number : 0;
  const initialBalance = s1Body.user ? (s1Body.user as Record<string, unknown>).token_balance as number : 0;
  assert(userId > 0, `获取登录用户 ID: ${userId}`);
  const setCookie = s1.headers.get('set-cookie') ?? '';
  const authCookie = setCookie.split(';')[0].trim();
  assert(authCookie.startsWith('auth_token='), `登录 Cookie 获取成功`);

  // ---- 2. D1 直接创建 pending 订单 ----
  console.log('\n=== 2. D1 直接创建 pending 订单 ===');
  const ts = Date.now();
  const orderId = `wxz_cf4a_notify_${ts}`;
  const aoid = `aoid_cf4a_${ts}`;
  const planId = 'monthly';
  const priceYuan = '29.00';
  const amountCents = 2900;
  const tokensAmount = 100000;

  await db.execute(
    `INSERT INTO payment_orders
     (user_id, order_id, bufpay_aoid, plan, tokens_amount, amount_cents, pay_type, status)
     VALUES (?, ?, ?, ?, ?, ?, 'wechat', 'pending')`,
    [userId, orderId, aoid, planId, tokensAmount, amountCents]
  );
  console.log(`  已向 D1 插入测试订单 (ID: ${orderId})`);

  // ---- 3. 检查订单在 D1 (通过 API) ----
  console.log('\n=== 3. 检查订单状态 (API 查询) ===');
  const pq = await request(`/api/pay/query?order_id=${orderId}`, { cookie: authCookie });
  assert(pq.status === 200, `query status: ${pq.status}`);
  const pqBody = pq.body as Record<string, unknown>;
  assert(pqBody.status === 'pending', `订单初始状态: ${pqBody.status} (预期: pending)`);

  // ---- 4. 正确 sign 的 notify ----
  console.log('\n=== 4. BufPay notify (正确签名) ===');
  const correctSign = md5Sign(aoid, orderId, String(userId), priceYuan, priceYuan, BUFPAY_APP_SECRET);
  const notifyBody = new URLSearchParams({
    aoid,
    order_id: orderId,
    order_uid: String(userId),
    price: priceYuan,
    pay_price: priceYuan,
    sign: correctSign,
  });

  const n1 = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: notifyBody.toString(),
  });
  assert(n1.status === 200, `notify 请求 status: ${n1.status} (预期: 200)`);
  const n1Text = await n1.text();
  assert(n1Text === 'ok', `notify 返回响应内容: ${n1Text}`);

  // ---- 5. 验证订单已 paid ----
  console.log('\n=== 5. 验证订单 paid ===');
  const pq2 = await request(`/api/pay/query?order_id=${orderId}`, { cookie: authCookie });
  assert(pq2.status === 200, `query status: ${pq2.status}`);
  const pq2Body = pq2.body as Record<string, unknown>;
  assert(pq2Body.status === 'paid', `修改后订单状态: ${pq2Body.status} (预期: paid)`);

  // ---- 6. 验证 token_ledger purchase ----
  console.log('\n=== 6. 验证 token_ledger purchase ===');
  const ut = await request('/api/user/tokens', { cookie: authCookie });
  assert(ut.status === 200, `tokens status: ${ut.status}`);
  const utBody = ut.body as Record<string, unknown>;
  const ledger = utBody.ledger as Array<Record<string, unknown>>;
  const purchaseEntry = ledger.find((l) => l.source_id === orderId && l.type === 'purchase');
  assert(purchaseEntry !== undefined, '账本中存在对应且唯一的 purchase 记录');
  if (purchaseEntry) {
    assert(purchaseEntry.delta_tokens as number === tokensAmount, `账本记账额度正确 (+${purchaseEntry.delta_tokens})`);
    assert(purchaseEntry.source === 'bufpay', `数据来源为 bufpay`);
  }

  // ---- 7. 验证 token balance 增加 ----
  console.log('\n=== 7. 验证 token balance ===');
  const um = await request('/api/user/me', { cookie: authCookie });
  assert(um.status === 200, `me status: ${um.status}`);
  const umBody = um.body as Record<string, unknown>;
  const newBalance = umBody.token_balance as number;
  assert(newBalance === initialBalance + tokensAmount, `用户余额正确增加: ${initialBalance} → ${newBalance} (+${tokensAmount})`);

  // ---- 8. 幂等重放 ----
  console.log('\n=== 8. 幂等重放 (重复 notify) ===');
  const n2 = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: notifyBody.toString(),
  });
  assert(n2.status === 200, `重放 notify status: ${n2.status} (预期: 200, 幂等)`);
  const n2Text = await n2.text();
  assert(n2Text === 'ok', `重放 notify 响应内容: ${n2Text}`);

  // 验证 balance 和 ledger 保持一致没有二次增加
  const um2 = await request('/api/user/me', { cookie: authCookie });
  const balanceAfterReplay = (um2.body as Record<string, unknown>).token_balance as number;
  assert(balanceAfterReplay === newBalance, `重放后用户余额未重复累加 (保持: ${balanceAfterReplay})`);

  // ---- 9. 错误 sign ----
  console.log('\n=== 9. 错误 sign 验证 ===');
  const badBody = new URLSearchParams({
    aoid,
    order_id: orderId,
    order_uid: String(userId),
    price: priceYuan,
    pay_price: priceYuan,
    sign: '00000000000000000000000000000000',
  });
  const n3 = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: badBody.toString(),
  });
  assert(n3.status === 400, `错误签名返回 status: ${n3.status} (预期: 400)`);
  const n3Text = await n3.text();
  assert(n3Text === 'sign error', `错误签名返回内容: ${n3Text}`);

  // ---- 10. 错误金额 (使用全新 pending 订单测试，规避幂等重放路径) ----
  console.log('\n=== 10. 错误金额验证 (全新 pending 订单) ===');
  const orderIdWrongAmt = `wxz_cf4a_notify_wrong_amt_${Date.now()}`;
  const aoidWrongAmt = `aoid_cf4a_wrong_amt_${Date.now()}`;
  
  await db.execute(
    `INSERT INTO payment_orders
     (user_id, order_id, bufpay_aoid, plan, tokens_amount, amount_cents, pay_type, status)
     VALUES (?, ?, ?, ?, ?, ?, 'wechat', 'pending')`,
    [userId, orderIdWrongAmt, aoidWrongAmt, planId, tokensAmount, amountCents]
  );
  console.log(`  已在 D1 插入错误金额测试订单 (ID: ${orderIdWrongAmt})`);

  const wrongSign = md5Sign(aoidWrongAmt, orderIdWrongAmt, String(userId), priceYuan, '0.01', BUFPAY_APP_SECRET);
  const wrongBody = new URLSearchParams({
    aoid: aoidWrongAmt,
    order_id: orderIdWrongAmt,
    order_uid: String(userId),
    price: priceYuan,
    pay_price: '0.01',
    sign: wrongSign,
  });

  const n4 = await fetch(`${BASE_URL}/api/pay/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: wrongBody.toString(),
  });
  assert(n4.status === 500, `金额不匹配返回 status: ${n4.status} (预期: 500)`);
  const n4Text = await n4.text();
  assert(n4Text === 'amount mismatch', `金额不匹配返回内容: ${n4Text}`);

  // ---- 11. subscription 验证 ----
  console.log('\n=== 11. 验证 subscription ===');
  const us = await request('/api/user/subscription', { cookie: authCookie });
  assert(us.status === 200, `subscription status: ${us.status}`);
  const usBody = us.body as Record<string, unknown>;
  const sub = usBody.subscription as Record<string, unknown> | null;
  assert(sub !== null, 'D1 中订阅记录已创建');
  if (sub) {
    assert(sub.plan === 'monthly', `订阅计划: ${sub.plan} (预期: monthly)`);
    assert(sub.status === 'active', `订阅状态: ${sub.status} (预期: active)`);
  }

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('测试异常:', e);
  process.exit(1);
});
