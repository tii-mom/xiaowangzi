interface EnvVarDef {
  key: string;
  required: boolean;
  description: string;
}

const ENV_VARS: EnvVarDef[] = [
  { key: 'NODE_ENV', required: false, description: '运行环境 (development/production)' },
  { key: 'APP_URL', required: false, description: '应用访问地址' },
  { key: 'NEXT_PUBLIC_APP_URL', required: false, description: '前端公开访问地址' },

  { key: 'DEEPSEEK_API_KEY', required: true, description: 'DeepSeek API 密钥' },
  { key: 'DEEPSEEK_BASE_URL', required: false, description: 'DeepSeek API 基础地址' },
  { key: 'DEEPSEEK_MODEL', required: false, description: 'DeepSeek 模型名称' },

  { key: 'BUFPAY_AID', required: false, description: 'BufPay 商户 ID' },
  { key: 'BUFPAY_APP_SECRET', required: false, description: 'BufPay 应用密钥' },
  { key: 'BUFPAY_NOTIFY_URL', required: false, description: 'BufPay 支付回调地址' },
  { key: 'BUFPAY_RETURN_URL', required: false, description: 'BufPay 支付完成跳转地址' },

  { key: 'CLOUDFLARE_ACCOUNT_ID', required: false, description: 'Cloudflare 账户 ID' },
  { key: 'CLOUDFLARE_DATABASE_ID', required: false, description: 'Cloudflare D1 数据库 ID' },
  { key: 'CLOUDFLARE_API_TOKEN', required: false, description: 'Cloudflare API Token' },

  { key: 'HERMES_BASE_URL', required: false, description: 'Hermes Agent 服务地址' },
  { key: 'HERMES_API_KEY', required: false, description: 'Hermes API 密钥' },
  { key: 'HERMES_WEBHOOK_SECRET', required: false, description: 'Hermes Webhook 签名密钥' },

  { key: 'ADMIN_EMAIL', required: false, description: '管理员邮箱' },
  { key: 'SESSION_SECRET', required: false, description: '会话加密密钥' },
];

export function validateEnv(): { missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const def of ENV_VARS) {
    const value = process.env[def.key];
    if (def.required && (!value || value.trim() === '')) {
      missing.push(`[${def.key}] ${def.description}`);
    } else if (!def.required && (!value || value.trim() === '')) {
      warnings.push(`[${def.key}] 未设置: ${def.description}`);
    }
  }

  return { missing, warnings };
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`缺少必需环境变量: ${key}`);
  }
  return value.trim();
}

export function getEnv(key: string, fallback: string = ''): string {
  const value = process.env[key];
  return value ? value.trim() : fallback;
}
