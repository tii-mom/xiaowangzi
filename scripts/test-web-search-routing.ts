/**
 * 受控联网搜索路由测试
 *
 * 运行: npx tsx scripts/test-web-search-routing.ts
 */

let failures = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    console.error(`  ❌ ${label}`);
    failures++;
  } else {
    console.log(`  ✅ ${label}`);
  }
}

async function main() {
  console.log('Web Search Routing 测试\n');
  const { decideWebSearch, runControlledWebSearch } = await import('../lib/web-search');

  const weather = decideWebSearch('今天成都天气怎么样？');
  assert(weather.shouldSearch, '天气问题触发搜索');
  assert(weather.intent === 'weather', `天气 intent = weather (${weather.intent})`);

  const news = decideWebSearch('查一下今天 AI 有什么最新新闻');
  assert(news.shouldSearch, '明确最新新闻触发搜索');

  const chat = decideWebSearch('你陪我聊聊');
  assert(!chat.shouldSearch, '普通陪伴闲聊不触发搜索');

  const time = decideWebSearch('现在几点？');
  assert(!time.shouldSearch, '当前时间使用运行时上下文，不触发搜索');

  delete process.env.WEB_SEARCH_PROVIDER;
  const disabled = await runControlledWebSearch('今天成都天气');
  assert(disabled.status === 'disabled', `无 provider 时 status=disabled (${disabled.status})`);
  assert(disabled.summary.includes('未配置'), '无 provider 时明确说明未配置');

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
