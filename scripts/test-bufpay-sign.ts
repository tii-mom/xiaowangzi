/**
 * 测试 BufPay 签名函数 (纯逻辑，不访问网络)
 *
 * 运行: npx tsx scripts/test-bufpay-sign.ts
 */

import crypto from 'node:crypto';

function md5Sign(...parts: string[]): string {
  return crypto
    .createHash('md5')
    .update(parts.join(''), 'utf8')
    .digest('hex')
    .toLowerCase();
}

function signCreateOrder(
  name: string,
  payType: string,
  price: string,
  orderId: string,
  orderUid: string,
  notifyUrl: string,
  returnUrl: string,
  feedbackUrl: string,
  appSecret: string,
): string {
  return md5Sign(name, payType, price, orderId, orderUid, notifyUrl, returnUrl, feedbackUrl, appSecret);
}

function verifyNotifySign(
  aoid: string,
  orderId: string,
  orderUid: string,
  price: string,
  payPrice: string,
  sign: string,
  appSecret: string,
): boolean {
  const expected = md5Sign(aoid, orderId, orderUid, price, payPrice, appSecret);
  return expected === sign;
}

// ---------------------------------------------------------------------------
// 固定测试参数
// ---------------------------------------------------------------------------

const APP_SECRET = 'test_secret_1234567890abcdef';
const TEST_AOID = 'test_aoid_abcdef1234567890';

function testCreateOrderSign() {
  console.log('=== 测试 1: 创建订单签名 ===\n');

  const sig = signCreateOrder(
    '月光陪伴版',
    'wechat',
    '29.00',
    'wxz_abc123',
    'user_001',
    'https://wan.lat/api/pay/notify',
    'https://wan.lat',
    '',
    APP_SECRET,
  );
  console.log(`签名结果: ${sig}`);
  console.log(`长度: ${sig.length} (MD5 = 32)`);

  const sig2 = signCreateOrder(
    '月光陪伴版',
    'wechat',
    '29.00',
    'wxz_abc123',
    'user_001',
    'https://wan.lat/api/pay/notify',
    'https://wan.lat',
    '',
    APP_SECRET,
  );
  console.log(`重复计算: ${sig2}`);
  console.log(`一致: ${sig === sig2 ? '✅' : '❌'}`);

  const sigDiff = signCreateOrder(
    '星球成长版',
    'wechat',
    '99.00',
    'wxz_xyz789',
    'user_002',
    'https://wan.lat/api/pay/notify',
    'https://wan.lat',
    '',
    APP_SECRET,
  );
  console.log(`不同订单签名: ${sigDiff}`);
  console.log(`不同: ${sig !== sigDiff ? '✅' : '❌'}`);

  console.log('');
}

function testNotifySignVerify() {
  console.log('=== 测试 2: 回调验签 ===\n');

  const aoid = TEST_AOID;
  const orderId = 'wxz_abc123';
  const orderUid = 'user_001';
  const price = '29.00';
  const payPrice = '29.00';

  const correctSign = md5Sign(aoid, orderId, orderUid, price, payPrice, APP_SECRET);
  console.log(`正确签名: ${correctSign}`);

  console.log(`正确签名验证: ${verifyNotifySign(aoid, orderId, orderUid, price, payPrice, correctSign, APP_SECRET) ? '✅' : '❌'}`);
  console.log(`错误签名验证: ${verifyNotifySign(aoid, orderId, orderUid, price, payPrice, 'wrong_sign_here', APP_SECRET) ? '❌ (bug)' : '✅'}`);
  console.log(`错误密钥验证: ${verifyNotifySign(aoid, orderId, orderUid, price, payPrice, correctSign, 'wrong_secret') ? '❌ (bug)' : '✅'}`);

  console.log('');
}

function testNotifyParamsOrder() {
  console.log('=== 测试 3: 参数顺序验证 ===\n');

  const sign1 = md5Sign('aoid1', 'order1', 'uid1', '29.00', '29.00', APP_SECRET);
  const sign2 = md5Sign('aoid1', 'order1', 'uid1', '29.00', '29.00', APP_SECRET);
  console.log(`相同参数相同签名: ${sign1 === sign2 ? '✅' : '❌'}`);

  const signSwapped = md5Sign('order1', 'aoid1', 'uid1', '29.00', '29.00', APP_SECRET);
  console.log(`顺序不同签名不同: ${sign1 !== signSwapped ? '✅' : '❌'}`);

  console.log('');
}

function testFeedbackUrlOptional() {
  console.log('=== 测试 4: feedback_url 可选 ===\n');

  const sigWith = signCreateOrder(
    'test', 'wechat', '1.00', 'o1', 'u1',
    'http://n', 'http://r', 'http://f',
    APP_SECRET,
  );
  const sigWithout = signCreateOrder(
    'test', 'wechat', '1.00', 'o1', 'u1',
    'http://n', 'http://r', '',
    APP_SECRET,
  );
  console.log(`带 feedback_url: ${sigWith}`);
  console.log(`不带 feedback_url: ${sigWithout}`);
  console.log(`不同: ${sigWith !== sigWithout ? '✅ (空字符串参与签名)' : '⚠️ (需确认 BufPay 文档约定)'}`);

  console.log('');
}

// Run
console.log('BufPay 签名逻辑测试\n');
testCreateOrderSign();
testNotifySignVerify();
testNotifyParamsOrder();
testFeedbackUrlOptional();
console.log('所有测试完成');
