import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'https://pay-staging.wan.lat';
const PAY_TYPE = 'alipay';
const PLAN_ID = 'staging_test_10c';
const ARTIFACTS_DIR = '/Users/yudeyou/.gemini/antigravity/brain/86d711dd-649c-4047-b085-4ca1009d324b';

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
  console.log('=== 1. 登录 Staging ===');
  const s1 = await request('/api/auth/web-session', { method: 'POST' });
  if (s1.status !== 200) {
    console.error('登录失败:', s1.status, s1.body);
    process.exit(1);
  }
  const s1Body = s1.body as Record<string, unknown>;
  const userId = s1Body.user ? (s1Body.user as Record<string, unknown>).id as number : 0;
  const setCookie = s1.headers.get('set-cookie') ?? '';
  const authCookie = setCookie.split(';')[0].trim();

  console.log(`用户 ID: ${userId}, Cookie: ${authCookie}`);

  console.log('=== 2. 创建 BufPay 支付宝订单 ===');
  const co = await request('/api/pay/create-order', {
    method: 'POST',
    cookie: authCookie,
    body: JSON.stringify({ plan: PLAN_ID, pay_type: PAY_TYPE }),
  });

  if (co.status !== 200) {
    console.error('创建订单失败:', co.status, co.body);
    process.exit(1);
  }

  const coBody = co.body as Record<string, unknown>;
  const orderId = coBody.order_id as string;
  const aoid = coBody.aoid as string;
  const price = coBody.price as string;
  const qrImg = coBody.qr_img as string;
  const qrUrl = coBody.qr as string;

  console.log(`订单 ID: ${orderId}`);
  console.log(`BufPay AOID: ${aoid}`);
  console.log(`价格: ${price} 元`);
  console.log(`二维码 URL: ${qrUrl}`);

  // 保存二维码
  if (qrImg && qrImg.includes('base64,')) {
    const base64Data = qrImg.split('base64,')[1];
    const qrBuffer = Buffer.from(base64Data, 'base64');
    
    // 保存到项目根目录
    const qrPath = path.resolve(process.cwd(), 'pay_qr.png');
    fs.writeFileSync(qrPath, qrBuffer);
    console.log(`已保存 QR 到项目根目录: ${qrPath}`);

    // 保存到 artifacts 目录以便显示
    const artifactQrPath = path.join(ARTIFACTS_DIR, 'pay_qr.png');
    fs.writeFileSync(artifactQrPath, qrBuffer);
    console.log(`已复制 QR 到 artifacts 目录: ${artifactQrPath}`);
  }

  // 保存订单状态，以便后续脚本轮询
  const state = {
    orderId,
    aoid,
    price,
    authCookie,
  };
  fs.writeFileSync(
    path.resolve(process.cwd(), 'scratch/order_state.json'),
    JSON.stringify(state, null, 2)
  );
  console.log('订单状态已保存至 scratch/order_state.json');
}

main().catch(err => {
  console.error('执行出错:', err);
  process.exit(1);
});
