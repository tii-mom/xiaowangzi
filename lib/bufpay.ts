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

export async function createBufPayOrder(
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

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '(unable to read body)');
    const preview = bodyText.length > 300 ? bodyText.slice(0, 300) + '...' : bodyText;
    throw new Error(`BufPay create-order HTTP ${res.status}: ${preview}`);
  }

  const raw = await res.text();
  const contentType = res.headers.get('content-type') ?? '';

  let data: unknown;
  if (contentType.includes('application/json') || raw.trim().startsWith('{')) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`BufPay create-order failed: invalid JSON response`);
    }
  } else {
    const h2 = raw.match(/<h2[^>]*>(.*?)<\/h2>/i)?.[1];
    const message = h2
      ? h2.replace(/<[^>]+>/g, '').trim()
      : raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

    throw new Error(`BufPay create-order failed: ${message || 'non-JSON response'}`);
  }

  const result = data as BufPayCreateResult & { info?: string };
  if (result.status === 'ok') {
    return result;
  }

  throw new Error(`BufPay create-order failed: status=${result.status}, info=${result.info ?? '--'}`);
}

export async function queryBufPayOrder(
  aoid: string,
  baseUrl?: string,
): Promise<BufPayQueryResult> {
  const apiUrl = baseUrl ?? 'https://bufpay.com';
  const url = `${apiUrl}/api/query/${aoid}`;

  const res = await fetch(url);

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '(unable to read body)');
    const preview = bodyText.length > 300 ? bodyText.slice(0, 300) + '...' : bodyText;
    throw new Error(`BufPay query HTTP ${res.status}: ${preview}`);
  }

  let data: BufPayQueryResult;
  try {
    data = await res.json();
  } catch (parseErr) {
    throw new Error(`BufPay query JSON parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
  }

  return data;
}
