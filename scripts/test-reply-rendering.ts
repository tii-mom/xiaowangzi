/**
 * Reply Rendering 测试
 *
 * 运行: npx tsx scripts/test-reply-rendering.ts
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
  console.log('Reply Rendering 测试\n');

  const { buildReplyRender, shouldRenderHtml } = await import('../lib/reply-rendering');

  const shortReply = '现在是晚上 8 点。';
  const shortRender = buildReplyRender(shortReply, 'web');
  assert(shortRender.render_format === 'text', '100 字以内 Web 回复保持 text');
  assert(shortRender.render_html === undefined, '短回复不返回 render_html');
  assert(!shouldRenderHtml(shortReply), 'shouldRenderHtml 短回复为 false');

  const longReply = [
    '先给你一句判断：你不是缺自律，而是旧身份还在保护旧生活。',
    '',
    '1. 今天写下反愿景，再写一个最小可行愿景，马上做一个 20 分钟行动。',
    '2. 这一周固定 2-3 个 daily levers，每晚复盘哪个动作真的改变了轨迹。',
    '3. 这个月只选一个月度项目，让技能、作品、健康或关系产生可见进展。',
    '4. 这一年定义新身份、北极星目标和约束，每季度根据反馈迭代。',
  ].join('\n');
  const webRender = buildReplyRender(longReply, 'web');
  assert(shouldRenderHtml(longReply), '长回复 shouldRenderHtml 为 true');
  assert(webRender.render_format === 'html', 'Web 长回复返回 html 格式');
  assert(typeof webRender.render_html === 'string' && webRender.render_html.includes('<article'), 'Web 长回复包含固定 article 模板');
  assert(String(webRender.render_html).includes('<ol>'), '编号行被渲染为有序列表');

  const unsafeLongReply = `${longReply}\n\n<script>alert("x")</script>`;
  const safeRender = buildReplyRender(unsafeLongReply, 'web');
  assert(!String(safeRender.render_html).includes('<script'), 'Web HTML 不包含可执行 script 标签');
  assert(String(safeRender.render_html).includes('&lt;script&gt;'), 'Web HTML 对用户文本做转义');

  const wechatRender = buildReplyRender(unsafeLongReply, 'hermes');
  assert(wechatRender.render_format === 'text', '微信长回复保持 text');
  assert(wechatRender.render_html === undefined, '微信不返回 render_html');
  assert(!wechatRender.reply.includes('<article'), '微信回复不包含 HTML article');
  assert(!wechatRender.reply.includes('<script'), '微信回复剥离 HTML 标签');

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
