/**
 * Hermes 微信聊天共享服务回归
 *
 * 运行: npx tsx scripts/test-hermes-chat.ts
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
  console.log('Hermes Chat 回归测试\n');

  const { getDb } = await import('../lib/db');
  const { processUserChatTurn } = await import('../lib/chat-turn');
  const { DEFAULT_CORE_DOC_CONTENT, ensureUserPrimaryAgentProfile } = await import('../lib/agent-profile');
  const db = getDb();

  const userId = 93001;
  const initialBalance = 50000;
  const messageId = `wx_msg_${Date.now().toString(36)}`;
  let deepSeekCalls = 0;
  let capturedPrompt = '';

  await db.execute(
    "INSERT INTO users (id, token_balance, status) VALUES (?, ?, 'active')",
    [userId, initialBalance],
  );
  await ensureUserPrimaryAgentProfile(userId);

  const profileRows = await db.query<{ id: number }>(
    "SELECT id FROM agent_profiles WHERE user_id = ? AND is_primary = 1 AND status = 'active' LIMIT 1",
    [userId],
  );
  const profileId = profileRows.results[0]?.id;
  assert(typeof profileId === 'number', '用户 Primary Agent Profile 已创建');

  await db.execute(
    "INSERT INTO agent_bindings (agent_profile_id, channel, external_id, status) VALUES (?, 'wechat', ?, 'active')",
    [profileId, 'wxid_test_hermes'],
  );

  console.log('\n=== 1. 已绑定微信普通聊天 ===');
  const result = await processUserChatTurn({
    userId,
    tokenBalance: initialBalance,
    message: '你好，我在微信里找你聊天',
    minTokenBalance: 10000,
    channel: 'hermes',
    externalMessageId: messageId,
    threadId: `hermes_${messageId}`,
    chatCompletion: async (messages) => {
      deepSeekCalls++;
      capturedPrompt = messages[0]?.content ?? '';
      return {
        content: '我在这里，像一盏小小的灯。',
        usage: {
          prompt_tokens: 120,
          completion_tokens: 30,
          total_tokens: 150,
        },
      };
    },
  });

  assert(result.status === 'ok', `聊天返回 ok: ${result.status}`);
  assert(result.reply === '我在这里，像一盏小小的灯。', '返回 assistant reply');
  assert(result.remainingTokens === initialBalance - 150, `余额扣减到 ${initialBalance - 150}`);
  assert(deepSeekCalls === 1, 'DeepSeek 调用 1 次');
  assert(capturedPrompt.includes(DEFAULT_CORE_DOC_CONTENT), 'system prompt 包含 Core Document');
  assert(capturedPrompt.includes('陪伴用户的温柔小王子'), 'system prompt 包含 persona summary');
  assert(capturedPrompt.includes('[运行时上下文]'), 'system prompt 包含运行时上下文');
  assert(capturedPrompt.includes('当前时区：Asia/Shanghai'), 'system prompt 包含当前时区');
  assert(capturedPrompt.includes('当前渠道：hermes'), 'system prompt 包含 Hermes 渠道');
  assert(capturedPrompt.includes('[稳定记忆]'), 'system prompt 包含稳定记忆段');
  assert(capturedPrompt.includes('[工具上下文]'), '普通聊天包含未触发搜索说明');

  const convRows = await db.query(
    "SELECT role, channel, external_message_id, agent_profile_id FROM conversations WHERE thread_id = ? ORDER BY id ASC",
    [result.threadId],
  );
  assert(convRows.results.length === 2, '写入 user + assistant 两条 conversations');
  assert(convRows.results[0]?.channel === 'hermes', 'user conversation channel = hermes');
  assert(convRows.results[0]?.external_message_id === messageId, 'user conversation 带 external_message_id');
  assert(convRows.results[0]?.agent_profile_id === profileId, 'conversation 关联 agent_profile_id');

  const ledgerRows = await db.query(
    "SELECT delta_tokens, source_id FROM token_ledger WHERE user_id = ? AND type = 'usage'",
    [userId],
  );
  assert(ledgerRows.results.length === 1, 'usage ledger 仅 1 条');
  assert(ledgerRows.results[0]?.delta_tokens === -150, 'usage ledger delta_tokens = -150');

  console.log('\n=== 2. 重复微信 message_id 幂等 ===');
  const duplicate = await processUserChatTurn({
    userId,
    tokenBalance: initialBalance - 150,
    message: '你好，我在微信里找你聊天',
    minTokenBalance: 10000,
    channel: 'hermes',
    externalMessageId: messageId,
    threadId: `hermes_${messageId}`,
    chatCompletion: async () => {
      deepSeekCalls++;
      return {
        content: '不应该再次调用',
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    },
  });

  assert(duplicate.status === 'already_processed', `重复消息返回 already_processed: ${duplicate.status}`);
  assert(duplicate.reply === '我在这里，像一盏小小的灯。', '重复消息返回已保存 reply');
  assert(deepSeekCalls === 1, '重复消息不再次调用 DeepSeek');

  const ledgerAfterDuplicate = await db.query(
    "SELECT COUNT(*) as cnt FROM token_ledger WHERE user_id = ? AND type = 'usage'",
    [userId],
  );
  assert(ledgerAfterDuplicate.results[0]?.cnt === 1, '重复消息不重复扣费');

  console.log('\n=== 3. 8 位普通文本也可作为聊天内容 ===');
  const eightCharMessageId = `wx_msg_8_${Date.now().toString(36)}`;
  const eightCharResult = await processUserChatTurn({
    userId,
    tokenBalance: initialBalance - 150,
    message: 'Z27HOME1',
    minTokenBalance: 10000,
    channel: 'hermes',
    externalMessageId: eightCharMessageId,
    threadId: `hermes_${eightCharMessageId}`,
    chatCompletion: async () => {
      deepSeekCalls++;
      return {
        content: 'Z-27 一直亮着。',
        usage: { prompt_tokens: 40, completion_tokens: 10, total_tokens: 50 },
      };
    },
  });
  assert(eightCharResult.status === 'ok', '8 位普通文本可进入聊天服务');
  assert(eightCharResult.reply === 'Z-27 一直亮着。', '8 位普通文本返回聊天 reply');
  assert(deepSeekCalls === 2, '第二条普通消息调用 DeepSeek');

  console.log('\n=== 4. 余额不足 ===');
  const poorUserId = 93002;
  await db.execute(
    "INSERT INTO users (id, token_balance, status) VALUES (?, ?, 'active')",
    [poorUserId, 100],
  );
  const poorResult = await processUserChatTurn({
    userId: poorUserId,
    tokenBalance: 100,
    message: '余额不足时不要聊天',
    minTokenBalance: 10000,
    channel: 'hermes',
    externalMessageId: `wx_msg_poor_${Date.now().toString(36)}`,
    chatCompletion: async () => {
      deepSeekCalls++;
      return {
        content: '不应该调用',
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    },
  });
  assert(poorResult.status === 'insufficient_tokens', '余额不足返回 insufficient_tokens');
  assert(deepSeekCalls === 2, '余额不足不调用 DeepSeek');

  console.log('\n=== 5. 实时问题但搜索工具未配置 ===');
  const toolUserId = 93003;
  await db.execute(
    "INSERT INTO users (id, token_balance, status) VALUES (?, ?, 'active')",
    [toolUserId, initialBalance],
  );
  await ensureUserPrimaryAgentProfile(toolUserId);
  const unavailable = await processUserChatTurn({
    userId: toolUserId,
    tokenBalance: initialBalance,
    message: '今天成都天气怎么样？',
    minTokenBalance: 10000,
    channel: 'hermes',
    externalMessageId: `wx_tool_${Date.now().toString(36)}`,
    chatCompletion: async () => {
      deepSeekCalls++;
      return {
        content: '不应该调用',
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    },
  });
  assert(unavailable.status === 'tool_unavailable', `搜索未配置返回 tool_unavailable (${unavailable.status})`);
  assert(String(unavailable.reply).includes('联网搜索工具'), '搜索未配置时短答说明工具不可用');
  assert(deepSeekCalls === 2, '搜索工具未配置不调用 DeepSeek');
  const toolLedgerRows = await db.query(
    "SELECT id FROM token_ledger WHERE user_id = ? AND type = 'usage'",
    [toolUserId],
  );
  assert(toolLedgerRows.results.length === 0, '搜索工具未配置不扣费');
  const toolCallRows = await db.query(
    "SELECT status, tool_name FROM agent_tool_calls WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    [toolUserId],
  );
  assert(toolCallRows.results[0]?.status === 'disabled', '搜索工具调用审计 status=disabled');

  console.log(`\n=== 结果: ${failures === 0 ? '全部通过 ✅' : `${failures} 个失败 ❌`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
