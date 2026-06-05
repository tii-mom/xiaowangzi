export interface Plan {
  id: string;
  name: string;
  tokens_amount: number;
  amount_cents: number;
  pay_type: 'wechat' | 'alipay';
}

export const PLANS: Record<string, Plan> = {
  free_trial: {
    id: 'free_trial',
    name: '免费体验',
    tokens_amount: 10000,
    amount_cents: 0,
    pay_type: 'wechat',
  },
  monthly: {
    id: 'monthly',
    name: '月光陪伴版',
    tokens_amount: 100000,
    amount_cents: 2900,
    pay_type: 'wechat',
  },
  quarterly: {
    id: 'quarterly',
    name: '星球成长版',
    tokens_amount: 500000,
    amount_cents: 9900,
    pay_type: 'wechat',
  },
  premium: {
    id: 'premium',
    name: '玫瑰星云版',
    tokens_amount: 3000000,
    amount_cents: 39900,
    pay_type: 'wechat',
  },
  staging_test_10c: {
    id: 'staging_test_10c',
    name: 'Staging Test 0.10',
    tokens_amount: 100,
    amount_cents: 10,
    pay_type: 'wechat',
  },
};

export function planIdToLabel(id: string): string {
  return PLANS[id]?.name ?? id;
}

export function centsToPriceYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function priceYuanToCents(yuan: string): number {
  return Math.round(parseFloat(yuan) * 100);
}
