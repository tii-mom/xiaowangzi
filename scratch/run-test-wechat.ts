import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// 加载 .dev.vars 中的 secret
const devVarsPath = path.resolve(process.cwd(), '.dev.vars');
let secret = '';
if (fs.existsSync(devVarsPath)) {
  const content = fs.readFileSync(devVarsPath, 'utf8');
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*BUFPAY_APP_SECRET\s*=\s*(.*)?\s*$/);
    if (match) {
      secret = match[1].trim().replace(/^"|"$/g, '');
    }
  }
}

process.env.BASE_URL = 'https://pay-staging.wan.lat';
process.env.BUFPAY_APP_SECRET = secret;
process.env.PAY_TYPE = 'wechat';
process.env.PLAN_ID = 'staging_test_10c';

console.log('--- Launcher: Starting WeChat scan verification ---');
try {
  execSync('npx tsx scripts/test-bufpay-real-scan.ts', { stdio: 'inherit' });
} catch (err) {
  console.error('Launcher child process exited with error');
  process.exit(1);
}
