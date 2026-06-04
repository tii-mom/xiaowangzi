import fs from 'node:fs';
import path from 'node:path';

let _prompt: string | null = null;

export function loadSystemPrompt(): string {
  if (_prompt) return _prompt;

  const promptPath = path.join(process.cwd(), 'prompts', 'prince.yaml');
  const raw = fs.readFileSync(promptPath, 'utf-8');

  const match = raw.match(/system:\s*\|\s*\n([\s\S]*)/);
  if (!match) {
    throw new Error('prince.yaml 格式错误: 找不到 system: | 块');
  }

  let content = match[1];
  content = content.replace(/^  /gm, '');
  content = content.trim();

  _prompt = content;
  return _prompt;
}
