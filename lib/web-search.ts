import { getEnv } from '@/lib/env';

export type SearchIntent = 'none' | 'weather' | 'news' | 'price' | 'policy' | 'realtime' | 'explicit';

export interface SearchDecision {
  shouldSearch: boolean;
  intent: SearchIntent;
  query: string;
}

export interface WebSearchResult {
  provider: string;
  query: string;
  status: 'ok' | 'disabled' | 'error';
  summary: string;
  durationMs: number;
  error?: string;
}

interface FirecrawlSearchItem {
  title?: string;
  url?: string;
  description?: string;
  markdown?: string;
  content?: string;
}

interface ExaSearchItem {
  title?: string;
  url?: string;
  text?: string;
  summary?: string;
}

export function decideWebSearch(message: string): SearchDecision {
  const text = message.trim();
  const normalized = text.toLowerCase();

  const explicit = /(联网|搜索|搜一下|查一下|查查|最新|实时|今天.*新闻|现在.*新闻)/u.test(text);
  const weather = /(天气|气温|下雨|降雨|空气质量|台风|暴雨|温度)/u.test(text);
  const news = /(新闻|热搜|发生了什么|最近.*事件|最新消息)/u.test(text);
  const price = /(价格|多少钱|汇率|股价|币价|金价|油价|票价|报价)/u.test(text);
  const policy = /(政策|法规|规定|限行|签证|税率|法律|条例|监管)/u.test(text);
  const realtime = /(现在|今天|此刻|当前|实时|latest|today|now)/u.test(normalized);

  if (weather) return { shouldSearch: true, intent: 'weather', query: text };
  if (news) return { shouldSearch: true, intent: 'news', query: text };
  if (price) return { shouldSearch: true, intent: 'price', query: text };
  if (policy && realtime) return { shouldSearch: true, intent: 'policy', query: text };
  if (explicit) return { shouldSearch: true, intent: 'explicit', query: text };
  if (realtime && /(政策|价格|新闻|天气|赛事|航班|电影|活动)/u.test(text)) {
    return { shouldSearch: true, intent: 'realtime', query: text };
  }

  return { shouldSearch: false, intent: 'none', query: text };
}

export async function runControlledWebSearch(query: string): Promise<WebSearchResult> {
  const started = Date.now();
  const provider = getEnv('WEB_SEARCH_PROVIDER', '').toLowerCase();

  try {
    if (provider === 'firecrawl') {
      return await firecrawlSearch(query, started);
    }
    if (provider === 'exa') {
      return await exaSearch(query, started);
    }
    return {
      provider: provider || 'none',
      query,
      status: 'disabled',
      summary: '联网搜索工具未配置。请基于已知信息回答，并明确说明无法查询实时资料。',
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      provider: provider || 'unknown',
      query,
      status: 'error',
      summary: '联网搜索失败。不要编造实时信息；请说明无法完成实时查询。',
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function formatSearchForPrompt(result: WebSearchResult): string {
  return `[受控联网搜索]
- provider: ${result.provider}
- query: ${result.query}
- status: ${result.status}
- summary:
${result.summary}

使用规则：如果 status=ok，可以基于搜索摘要回答；如果 status=disabled/error，必须坦诚说明当前无法联网查询，不要编造实时事实。`;
}

async function firecrawlSearch(query: string, started: number): Promise<WebSearchResult> {
  const apiKey = getEnv('FIRECRAWL_API_KEY');
  if (!apiKey) {
    return disabled('firecrawl', query, started);
  }

  const response = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, limit: 3 }),
  });
  if (!response.ok) {
    throw new Error(`Firecrawl HTTP ${response.status}: ${await response.text().catch(() => '')}`);
  }
  const data = await response.json() as { data?: FirecrawlSearchItem[] };
  const items = data.data ?? [];
  return {
    provider: 'firecrawl',
    query,
    status: 'ok',
    summary: summarizeItems(items.map((item) => ({
      title: item.title,
      url: item.url,
      text: item.description ?? item.markdown ?? item.content,
    }))),
    durationMs: Date.now() - started,
  };
}

async function exaSearch(query: string, started: number): Promise<WebSearchResult> {
  const apiKey = getEnv('EXA_API_KEY');
  if (!apiKey) {
    return disabled('exa', query, started);
  }

  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, numResults: 3, contents: { text: true } }),
  });
  if (!response.ok) {
    throw new Error(`Exa HTTP ${response.status}: ${await response.text().catch(() => '')}`);
  }
  const data = await response.json() as { results?: ExaSearchItem[] };
  const items = data.results ?? [];
  return {
    provider: 'exa',
    query,
    status: 'ok',
    summary: summarizeItems(items.map((item) => ({
      title: item.title,
      url: item.url,
      text: item.summary ?? item.text,
    }))),
    durationMs: Date.now() - started,
  };
}

function disabled(provider: string, query: string, started: number): WebSearchResult {
  return {
    provider,
    query,
    status: 'disabled',
    summary: '联网搜索工具未配置。请基于已知信息回答，并明确说明无法查询实时资料。',
    durationMs: Date.now() - started,
  };
}

function summarizeItems(items: Array<{ title?: string; url?: string; text?: string }>): string {
  if (items.length === 0) {
    return '没有搜索到可用结果。';
  }
  return items
    .slice(0, 3)
    .map((item, idx) => {
      const title = item.title?.trim() || `结果 ${idx + 1}`;
      const url = item.url?.trim() || '无链接';
      const text = (item.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 420);
      return `${idx + 1}. ${title}\n${url}\n${text}`;
    })
    .join('\n\n');
}
