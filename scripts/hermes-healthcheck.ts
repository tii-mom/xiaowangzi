/**
 * Hermes 健康检查脚本
 *
 * 验证 Hermes Agent 服务是否可访问
 *
 * 运行: npx tsx scripts/hermes-healthcheck.ts
 */

const BASE_URL = process.env.HERMES_BASE_URL ?? 'http://localhost:8080';
const API_KEY = process.env.HERMES_API_KEY ?? '';

interface CheckResult {
  name: string;
  url: string;
  passed: boolean;
  message: string;
}

async function check(name: string, url: string, init?: RequestInit): Promise<CheckResult> {
  try {
    const res = await fetch(url, init);
    if (res.ok) {
      return { name, url, passed: true, message: `HTTP ${res.status}` };
    }
    const body = await res.text().catch(() => '(unable to read body)');
    return { name, url, passed: false, message: `HTTP ${res.status}: ${body.slice(0, 100)}` };
  } catch (err) {
    return {
      name,
      url,
      passed: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  console.log('Hermes Agent Health Check\n');
  console.log(`  BASE_URL: ${BASE_URL}`);
  console.log(`  API_KEY: ${API_KEY ? '***configured***' : '(not set)'}`);
  console.log('');

  const results: CheckResult[] = [];

  results.push(await check('Hermes 根路径可达', `${BASE_URL}/`));

  results.push(await check(
    'Hermes /api/health (auth)',
    `${BASE_URL}/api/health`,
    API_KEY ? { headers: { Authorization: `Bearer ${API_KEY}` } } : undefined,
  ));

  results.push(await check(
    'Hermes /api/agents (列子Agent)',
    `${BASE_URL}/api/agents`,
    API_KEY ? { headers: { Authorization: `Bearer ${API_KEY}` } } : undefined,
  ));

  console.log('=== 结果 ===');
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}`);
    console.log(`     ${r.url} → ${r.message}`);
    if (!r.passed) allPassed = false;
  }

  if (!API_KEY) {
    console.log('\n  ⚠️  HERMES_API_KEY 未设置，所有认证请求可能失败');
  }

  if (allPassed) {
    console.log('\n✅ Hermes 服务正常');
    process.exit(0);
  } else {
    console.log('\n❌ 部分检查失败 — 可能 Hermes 未配置或不可达');
    console.log('请确认 HERMES_BASE_URL 和 HERMES_API_KEY 是否正确设置');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('检查异常:', err);
  process.exit(1);
});
