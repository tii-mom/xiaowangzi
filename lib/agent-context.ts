import { buildAgentSystemContext } from '@/lib/agent-profile';
import { formatMemoriesForPrompt, getActiveMemories } from '@/lib/agent-memory';
import {
  LIFE_REDESIGN_SKILL_TITLE,
  formatLifeRedesignRuntimeHint,
  formatLifeRedesignSkillForPrompt,
} from '@/lib/agent-skills/life-redesign';
import { formatGrowthContextForPrompt } from '@/lib/growth';
import {
  decideWebSearch,
  formatSearchForPrompt,
  runControlledWebSearch,
  type SearchDecision,
  type WebSearchResult,
} from '@/lib/web-search';

export type AgentChannel = 'web' | 'hermes';

export interface AgentRuntimeContext {
  systemPrompt: string;
  searchDecision: SearchDecision;
  searchResult?: WebSearchResult;
}

export async function buildCompleteAgentRuntimeContext(params: {
  userId: number;
  channel: AgentChannel;
  message: string;
}): Promise<AgentRuntimeContext> {
  const [agentContext, memories, growthContext] = await Promise.all([
    buildAgentSystemContext(params.userId),
    getActiveMemories(params.userId),
    formatGrowthContextForPrompt(params.userId),
  ]);
  const searchDecision = decideWebSearch(params.message);
  const searchResult = searchDecision.shouldSearch
    ? await runControlledWebSearch(searchDecision.query)
    : undefined;
  const skillPrompt = agentContext.coreDoc.includes(LIFE_REDESIGN_SKILL_TITLE)
    ? null
    : formatLifeRedesignSkillForPrompt();

  const systemPrompt = [
    agentContext.combinedPrompt,
    skillPrompt,
    formatLifeRedesignRuntimeHint(params.message),
    growthContext,
    formatMemoryContext(formatMemoriesForPrompt(memories)),
    formatRuntimeContext(params.channel),
    searchResult ? formatSearchForPrompt(searchResult) : formatNoSearchContext(),
  ].filter(Boolean).join('\n\n');

  return { systemPrompt, searchDecision, searchResult };
}

function formatMemoryContext(memoryText: string): string {
  return `[稳定记忆]
${memoryText}

使用规则：稳定记忆只用于更贴近用户偏好；不要主动复述记忆库，不要编造没有出现过的信息。`;
}

function formatRuntimeContext(channel: AgentChannel): string {
  const now = new Date();
  const timeZone = 'Asia/Shanghai';
  const formatted = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'medium',
    hour12: false,
  }).format(now);

  return `[运行时上下文]
- 当前时间：${formatted}
- 当前时区：${timeZone}
- 当前渠道：${channel}
- 微信/移动端回答默认短一些；用户问事实问题时直接回答。`;
}

function formatNoSearchContext(): string {
  return `[工具上下文]
- 本轮未触发联网搜索。
- 不要声称已经搜索或看到实时资料。
- 如果用户只是闲聊，保持自然陪伴；如果用户问事实问题，先直接回答已知部分。`;
}
