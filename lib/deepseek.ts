import { getEnv } from '@/lib/env';

const BASE_URL = getEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com');
export const DEEPSEEK_MODEL = getEnv('DEEPSEEK_MODEL', 'deepseek-v4-flash');

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatResult {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function callDeepSeekChat(
  messages: ChatMessage[],
  apiKey: string,
): Promise<ChatResult> {
  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: 0.8,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '(unable to read body)');
    const preview = bodyText.length > 300 ? bodyText.slice(0, 300) + '...' : bodyText;
    throw new Error(`DeepSeek HTTP ${response.status}: ${preview}`);
  }

  let data: DeepSeekResponse;
  try {
    data = await response.json();
  } catch (parseErr) {
    throw new Error(`DeepSeek JSON parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
  }

  const choice = data.choices?.[0];
  if (!choice?.message?.content) {
    throw new Error('DeepSeek returned empty response');
  }

  if (!data.usage || data.usage.total_tokens <= 0) {
    throw new Error('DeepSeek usage missing or invalid: total_tokens must be > 0');
  }

  return {
    content: choice.message.content,
    usage: {
      prompt_tokens: data.usage.prompt_tokens ?? 0,
      completion_tokens: data.usage.completion_tokens ?? 0,
      total_tokens: data.usage.total_tokens,
    },
  };
}
