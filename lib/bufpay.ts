import crypto from 'node:crypto';

export interface BufPayCreateParams {
  name: string;
  pay_type: 'wechat' | 'alipay';
  price: string;
  order_id: string;
  order_uid: string;
  notify_url: string;
  return_url: string;
  feedback_url?: string;
}

export interface BufPayCreateResult {
  status: string;
  aoid: string;
  pay_type: string;
  price: string;
  qr_price: string;
  qr: string;
  qr_img: string;
  cid: number;
  expires_in: number;
  return_url: string;
  feedback_url: string;
}

export interface BufPayNotifyParams {
  aoid: string;
  order_id: string;
  order_uid: string;
  price: string;
  pay_price: string;
  sign: string;
}

export interface BufPayQueryResult {
  status: 'not_exist' | 'new' | 'payed' | 'success' | 'fee_error' | 'expire';
}

function md5Sign(...parts: string[]): string {
  return crypto
    .createHash('md5')
    .update(parts.join(''), 'utf8')
    .digest('hex')
    .toLowerCase();
}

export function signCreateOrder(
  params: BufPayCreateParams,
  appSecret: string,
): string {
  const parts = [
    params.name,
    params.pay_type,
    params.price,
    params.order_id,
    params.order_uid,
    params.notify_url,
    params.return_url,
    params.feedback_url ?? '',
    appSecret,
  ];
  return md5Sign(...parts);
}

export function verifyNotifySign(
  params: BufPayNotifyParams,
  appSecret: string,
): boolean {
  const expected = md5Sign(
    params.aoid,
    params.order_id,
    params.order_uid,
    params.price,
    params.pay_price,
    appSecret,
  );
  return expected === params.sign;
}

export function createBufPayOrder(
  aid: string,
  params: BufPayCreateParams,
  appSecret: string,
  baseUrl?: string,
): Promise<BufPayCreateResult> {
  const sign = signCreateOrder(params, appSecret);

  const body = new URLSearchParams({
    name: params.name,
    pay_type: params.pay_type,
    price: params.price,
    order_id: params.order_id,
    order_uid: params.order_uid,
    notify_url: params.notify_url,
    return_url: params.return_url,
    feedback_url: params.feedback_url ?? '',
    sign,
  });

  const apiUrl = baseUrl ?? 'https://bufpay.com';
  const url = `${apiUrl}/api/pay/${aid}`;

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  }).then(async (res) => {
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      return data as BufPayCreateResult;
    }
    throw new Error(`BufPay create-order failed: status=${data.status}, info=${data.info ?? '--'}`);
  });
}

export function queryBufPayOrder(
  aoid: string,
  baseUrl?: string,
): Promise<BufPayQueryResult> {
  const apiUrl = baseUrl ?? 'https://bufpay.com';
  const url = `${apiUrl}/api/query/${aoid}`;

  return fetch(url)
    .then((res) => res.json())
    .then((data) => data as BufPayQueryResult);
}
