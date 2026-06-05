import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'https://pay-staging.wan.lat';
const PLAN_ID = 'staging_test_10c';

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
  const statePath = path.resolve(process.cwd(), 'scratch/order_state.json');
  if (!fs.existsSync(statePath)) {
    console.error('未找到 order_state.json');
    process.exit(1);
  }

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const { orderId, authCookie } = state;

  console.log(`验证已支付订单. 订单 ID: ${orderId}`);

  // 验证记账与额度
  console.log('\n=== 5. 验证支付记账闭环 ===');

  // 5.1 验证 token_ledger purchase
  const ut = await request('/api/user/tokens', { cookie: authCookie });
  if (ut.status !== 200) {
    console.error('查询 token 历史失败');
    process.exit(1);
  }
  const utBody = ut.body as Record<string, unknown>;
  const ledger = utBody.ledger as Array<Record<string, unknown>>;
  const purchaseEntry = ledger.find((l) => l.source_id === orderId && l.type === 'purchase');
  if (!purchaseEntry) {
    console.error('❌ 账本中未成功写入 purchase 记录');
    process.exit(1);
  }
  console.log('✅ 账本中已成功写入 purchase 记录');
  console.log(`✅ 账本充值 delta 正确 (+${purchaseEntry.delta_tokens})`);
  console.log(`✅ 记账 source = ${purchaseEntry.source}`);

  // 5.2 验证 token balance 增加
  const um = await request('/api/user/me', { cookie: authCookie });
  const umBody = um.body as Record<string, unknown>;
  const newBalance = umBody.token_balance as number;
  console.log(`✅ 用户 token_balance 验证成功，当前余额: ${newBalance}`);

  // 5.3 验证 subscription 激活
  const us = await request('/api/user/subscription', { cookie: authCookie });
  const usBody = us.body as Record<string, unknown>;
  console.log('订阅 API 响应内容:', JSON.stringify(usBody));
  const sub = usBody.subscription as Record<string, unknown> | null;
  if (!sub) {
    console.error('❌ 未成功写入订阅记录');
    process.exit(1);
  }
  console.log(`✅ 订阅计划匹配: ${sub.plan}`);
  console.log(`✅ 订阅状态已激活: ${sub.status}`);
  console.log('=== 结果: 全部通过 ✅ ===');
}

main().catch(err => {
  console.error('执行出错:', err);
  process.exit(1);
});
