/**
 * BufPay 真实扫码支付联调验证脚本
 *
 * 运行流程:
 * 1. 登录获取 session
 * 2. POST /api/pay/create-order 创建 staging_test_10c 测试订单
 * 3. 将返回的 base64 支付二维码写入本地文件 pay_qr.png，并输出可点击的文件链接
 * 4. 进入轮询状态 (每 3 秒查询一次订单状态，最长等待 5 分钟)
 * 5. 用户用手机扫码支付
 * 6. 自动监听到账并完成记账结算验证
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'https://xiaowangzi.348421501.workers.dev';
const PAY_TYPE = (process.env.PAY_TYPE ?? 'wechat') as 'wechat' | 'alipay';
const PLAN_ID = process.env.PLAN_ID ?? 'staging_test_10c';

let failures = 0;

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`  ❌ ${label}`);
    failures++;
  } else {
    console.log(`  ✅ ${label}`);
  }
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
  console.log('=== BufPay 真实扫码支付联调验证 ===\n');
  console.log(`环境配置:`);
  console.log(`- BASE_URL: ${BASE_URL}`);
  console.log(`- PAY_TYPE: ${PAY_TYPE}`);
  console.log(`- PLAN_ID : ${PLAN_ID}`);

  if (PAY_TYPE !== 'wechat' && PAY_TYPE !== 'alipay') {
    console.error('❌ 错误: PAY_TYPE 必须为 wechat 或 alipay');
    process.exit(1);
  }

  // ---- 1. 登录 ----
  console.log('\n=== 1. 登录 ===');
  const s1 = await request('/api/auth/web-session', { method: 'POST' });
  assert(s1.status === 200, `登录请求状态: ${s1.status}`);
  const s1Body = s1.body as Record<string, unknown>;
  const userId = s1Body.user ? (s1Body.user as Record<string, unknown>).id as number : 0;
  const initialBalance = s1Body.user ? (s1Body.user as Record<string, unknown>).token_balance as number : 0;
  assert(userId > 0, `获取测试用户 ID: ${userId}`);
  const setCookie = s1.headers.get('set-cookie') ?? '';
  const authCookie = setCookie.split(';')[0].trim();
  assert(authCookie.startsWith('auth_token='), `登录会话 Cookie 获取成功`);

  // ---- 2. 创建真实订单 ----
  console.log('\n=== 2. 创建 BufPay 订单 ===');
  const co = await request('/api/pay/create-order', {
    method: 'POST',
    cookie: authCookie,
    body: JSON.stringify({ plan: PLAN_ID, pay_type: PAY_TYPE }),
  });

  assert(co.status === 200, `创单请求状态: ${co.status}`);
  if (co.status !== 200) {
    console.error(`  创单失败，详情: ${JSON.stringify(co.body)}`);
    process.exit(1);
  }

  const coBody = co.body as Record<string, unknown>;
  const orderId = coBody.order_id as string;
  const aoid = coBody.aoid as string;
  const price = coBody.price as string;
  const qrImg = coBody.qr_img as string; // Base64
  const qrUrl = coBody.qr as string; // 支付 URL
  const expires = coBody.expires_in as number;

  assert(typeof orderId === 'string' && orderId.length > 0, `生成系统订单号: ${orderId}`);
  assert(typeof aoid === 'string' && aoid.length > 0, `获取 BufPay 订单号 (aoid)`);
  assert(typeof price === 'string' && price.length > 0, `支付金额: ${price} 元`);
  
  // ---- 3. 二维码本地提取与展示 ----
  console.log('\n=== 3. 提取支付二维码 ===');
  if (qrImg && qrImg.includes('base64,')) {
    const base64Data = qrImg.split('base64,')[1];
    const qrBuffer = Buffer.from(base64Data, 'base64');
    const qrPath = path.resolve(process.cwd(), 'pay_qr.png');
    fs.writeFileSync(qrPath, qrBuffer);
    console.log(`  🎉 支付二维码已保存至本地:`);
    console.log(`  👉 [点击打开二维码图片](file://${qrPath}) 👈`);
  } else {
    console.log(`  ⚠️ 未获取到 Base64 图片，可直接使用支付链接进行测试。`);
  }
  if (qrUrl) {
    console.log(`  👉 原始支付链接: ${qrUrl}`);
  }

  // ---- 4. 等待真实支付扫码 (轮询) ----
  console.log('\n=== 4. 等待用户真实扫码支付 (最长等待 5 分钟) ===');
  console.log('  请在手机上使用微信/支付宝扫码，支付成功后系统将自动监听到账并推进。');

  const maxWaitMs = 5 * 60 * 1000;
  const pollIntervalMs = 3000;
  const startTime = Date.now();
  let paidSuccessfully = false;

  while (Date.now() - startTime < maxWaitMs) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\r  ⌛ 正在轮询订单状态... 已等待 ${elapsed} 秒 / 300 秒`);
    
    const query = await request(`/api/pay/query?order_id=${orderId}`, { cookie: authCookie });
    if (query.status === 200) {
      const qBody = query.body as Record<string, unknown>;
      if (qBody.status === 'paid') {
        paidSuccessfully = true;
        console.log('\n\n  🎉 检测到订单已支付成功!');
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  if (!paidSuccessfully) {
    console.error('\n\n❌ 验证超时失败：未能检测到支付到账。');
    console.error('\n🔍 排查提示:');
    console.error('  1. 请检查安卓手机上的 BufPay 监听 App 是否在线且运行正常。');
    console.error('  2. 确认手机的微信/支付宝到账通知开启（有横幅或语音提示）。');
    console.error('  3. 确认手机去除了电池优化，确保后台保活正常。');
    console.error('  4. 检查 BufPay 平台后台订单列表中该笔订单是否显示已支付。');
    console.error('  5. 登录 Cloudflare Logs，检查 `/api/pay/notify` 是否收到了 webhook 回调及其响应。');
    process.exit(1);
  }

  // ---- 5. 验证记账与额度 ----
  console.log('\n=== 5. 验证支付记账闭环 ===');

  // 5.1 验证 token_ledger purchase
  const ut = await request('/api/user/tokens', { cookie: authCookie });
  assert(ut.status === 200, `tokens 历史查询状态: ${ut.status}`);
  const utBody = ut.body as Record<string, unknown>;
  const ledger = utBody.ledger as Array<Record<string, unknown>>;
  const purchaseEntry = ledger.find((l) => l.source_id === orderId && l.type === 'purchase');
  assert(purchaseEntry !== undefined, '账本中已成功写入 purchase 记录');
  if (purchaseEntry) {
    assert(purchaseEntry.delta_tokens as number > 0, `账本充值 delta 正确 (+${purchaseEntry.delta_tokens})`);
    assert(purchaseEntry.source === 'bufpay', `记账 source = bufpay`);
  }

  // 5.2 验证 token balance 增加
  const um = await request('/api/user/me', { cookie: authCookie });
  assert(um.status === 200, `me 状态查询: ${um.status}`);
  const umBody = um.body as Record<string, unknown>;
  const newBalance = umBody.token_balance as number;
  assert(newBalance > initialBalance, `用户 token_balance 正确增加: ${initialBalance} → ${newBalance}`);

  // 5.3 验证 subscription 激活
  const us = await request('/api/user/subscription', { cookie: authCookie });
  assert(us.status === 200, `subscription 状态查询: ${us.status}`);
  const usBody = us.body as Record<string, unknown>;
  const sub = usBody.subscription as Record<string, unknown> | null;
  assert(sub !== null, '已成功写入订阅记录');
  if (sub) {
    assert(sub.plan === PLAN_ID, `订阅计划匹配: ${sub.plan}`);
    assert(sub.status === 'active', `订阅状态已激活: ${sub.status}`);
  }

  // 清除本地生成的二维码文件
  try {
    const qrPath = path.resolve(process.cwd(), 'pay_qr.png');
    if (fs.existsSync(qrPath)) {
      fs.unlinkSync(qrPath);
    }
  } catch {}

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('测试异常:', e);
  process.exit(1);
});
