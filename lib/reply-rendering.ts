import type { AgentChannel } from '@/lib/agent-context';

export type ReplyRenderFormat = 'text' | 'html';

export interface ReplyRenderResult {
  render_format: ReplyRenderFormat;
  render_html?: string;
  reply: string;
}

const LONG_REPLY_VISIBLE_CHAR_LIMIT = 100;

export function buildReplyRender(reply: string, channel: AgentChannel): ReplyRenderResult {
  const normalizedReply = channel === 'hermes'
    ? formatWechatPlainText(reply)
    : reply.trim();

  if (channel !== 'web' || countVisibleChars(normalizedReply) <= LONG_REPLY_VISIBLE_CHAR_LIMIT) {
    return {
      reply: normalizedReply,
      render_format: 'text',
    };
  }

  return {
    reply: normalizedReply,
    render_format: 'html',
    render_html: renderLongReplyHtml(normalizedReply),
  };
}

export function shouldRenderHtml(reply: string): boolean {
  return countVisibleChars(reply) > LONG_REPLY_VISIBLE_CHAR_LIMIT;
}

function formatWechatPlainText(reply: string): string {
  const withoutTags = stripHtmlTags(reply).trim();
  if (countVisibleChars(withoutTags) <= LONG_REPLY_VISIBLE_CHAR_LIMIT) {
    return withoutTags;
  }

  const existingBlocks = withoutTags
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter(Boolean);
  if (existingBlocks.length > 1 || /^\s*(\d+[.、]|[-*])\s+/um.test(withoutTags)) {
    return withoutTags;
  }

  const sentences = withoutTags
    .split(/(?<=[。！？!?])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return withoutTags;
  }

  const title = sentences.shift() ?? '';
  const points = sentences.slice(0, 4).map((sentence, index) => `${index + 1}. ${sentence}`);
  return [title, ...points].join('\n\n');
}

function renderLongReplyHtml(reply: string): string {
  const blocks = reply
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter(Boolean);

  const body = blocks.map(renderBlockHtml).join('');
  return `<article class="xwz-rich-reply">${body}</article>`;
}

function renderBlockHtml(block: string): string {
  const lines = block
    .split(/\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length >= 2 && lines.every((line) => /^(\d+[.、]|[-*])\s+/u.test(line))) {
    const items = lines.map((line) => {
      const text = line.replace(/^(\d+[.、]|[-*])\s+/u, '');
      return `<li>${escapeHtml(text)}</li>`;
    }).join('');
    return `<ol>${items}</ol>`;
  }

  const heading = lines.length > 1 && lines[0].length <= 24 && !/[。！？!?]$/u.test(lines[0])
    ? `<h5>${escapeHtml(lines[0])}</h5>`
    : '';
  const paragraphLines = heading ? lines.slice(1) : lines;
  const paragraph = paragraphLines.map(escapeHtml).join('<br />');
  return `${heading}<p>${paragraph}</p>`;
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/gu, '');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function countVisibleChars(text: string): number {
  return Array.from(text.replace(/\s+/gu, '')).length;
}
