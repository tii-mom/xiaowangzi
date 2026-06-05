/**
 * 生产环境只读巡检脚本 (check-production-health.ts)
 * 
 * 运行方法:
 * BASE_URL=https://wan.lat ADMIN_TOKEN=<your_token> npx tsx scripts/check-production-health.ts
 */

const BASE_URL = process.env.BASE_URL ?? 'https://wan.lat';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

let failures = 0;

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`  ❌ FAIL: ${label}`);
    failures++;
  } else {
    console.log(`  ✅ PASS: ${label}`);
  }
}

async function checkUrlStatus(path: string, expectedStatus = 200): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`);
    assert(res.status === expectedStatus, `GET ${path} 响应状态码 = ${res.status} (期望 ${expectedStatus})`);
    return await res.text();
  } catch (error) {
    assert(false, `GET ${path} 请求失败: ${(error as Error).message}`);
    return null;
  }
}

async function main() {
  console.log(`=== 生产环境只读巡检开始 (目标地址: ${BASE_URL}) ===\n`);

  // 1. https://wan.lat 根路径
  console.log('1. 检查根路径');
  await checkUrlStatus('/');

  // 2. /api/health 健康检查接口
  console.log('\n2. 检查健康接口');
  const healthText = await checkUrlStatus('/api/health');
  if (healthText) {
    try {
      const healthJson = JSON.parse(healthText);
      assert(healthJson.ok === true, `/api/health 返回 "ok": true`);
    } catch {
      assert(false, `/api/health 返回非 JSON 格式: ${healthText}`);
    }
  }

  // 3. /legal/privacy 隐私协议
  console.log('\n3. 检查隐私协议页面');
  await checkUrlStatus('/legal/privacy');

  // 4. /legal/terms 服务条款
  console.log('\n4. 检查服务条款页面');
  await checkUrlStatus('/legal/terms');

  // 5. /pay 页面套餐展示检查
  console.log('\n5. 检查支付页面内容');
  const payHtml = await checkUrlStatus('/pay');
  if (payHtml) {
    // 应当包含正式套餐金额
    assert(payHtml.includes('29'), `包含 29 元月套餐说明`);
    assert(payHtml.includes('99'), `包含 99 元季度套餐说明`);
    assert(payHtml.includes('399'), `包含 399 元年套餐说明`);

    // 不应包含测试套餐/余额/钱包字样
    assert(!payHtml.includes('staging_test_10c'), `不应包含 staging_test_10c`);
    assert(!payHtml.includes('0.10') && !payHtml.includes('0.1'), `不应包含 0.10 元测试价格`);
    assert(!payHtml.includes('Wallet'), `不应包含 Wallet`);
    assert(!payHtml.includes('Balance'), `不应包含 Balance`);
  }

  // 6. 管理员概览接口（可选）
  console.log('\n6. 检查管理员后台概览 (可选)');
  if (!ADMIN_TOKEN) {
    console.log('  ⏭️  跳过管理员检查 (未提供 ADMIN_TOKEN 环境变量)');
  } else {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/overview`, {
        headers: { 'x-admin-token': ADMIN_TOKEN },
      });
      assert(res.status === 200, `使用 ADMIN_TOKEN 请求 /api/admin/overview 响应状态码 = ${res.status}`);
      if (res.status === 200) {
        const text = await res.text();
        const json = JSON.parse(text);
        assert(typeof json.users_count === 'number', `成功拉取管理员数据，用户总数: ${json.users_count}`);
      }
    } catch (error) {
      assert(false, `/api/admin/overview 请求失败: ${(error as Error).message}`);
    }
  }

  console.log(`\n=== 巡检结束: ${failures === 0 ? 'PASS (全部通过 ✅)' : 'FAIL (存在失败项 ❌)'} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('巡检脚本运行时发生异常:', e);
  process.exit(1);
});
