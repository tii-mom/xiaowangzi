import { getDb, type DatabaseAdapter } from '@/lib/db';

export interface AgentMemory {
  id: number;
  memory_type: string;
  content: string;
  confidence: number;
  updated_at: string;
}

const MEMORY_LIMIT = 8;

export async function getActiveMemories(userId: number): Promise<AgentMemory[]> {
  const db = getDb();
  const rows = await db.query<AgentMemory>(
    `SELECT id, memory_type, content, confidence, updated_at
     FROM agent_memories
     WHERE user_id = ? AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT ?`,
    [userId, MEMORY_LIMIT],
  );
  return rows.results;
}

export function formatMemoriesForPrompt(memories: AgentMemory[]): string {
  if (memories.length === 0) {
    return '暂无稳定记忆。不要编造用户偏好；只根据本轮问题和已有对话回应。';
  }

  return memories
    .map((memory) => `- ${memory.memory_type}: ${memory.content}`)
    .join('\n');
}

export async function maybeCaptureExplicitMemory(params: {
  db?: DatabaseAdapter;
  userId: number;
  agentProfileId: number;
  message: string;
  threadId: string;
}): Promise<void> {
  const content = extractExplicitMemory(params.message);
  if (!content) return;

  const db = params.db ?? getDb();
  await db.batch([
    {
      sql: `INSERT INTO agent_memories
            (user_id, agent_profile_id, memory_type, content, source, confidence, status, created_at, updated_at)
            VALUES (?, ?, 'preference', ?, 'explicit_chat', 0.9, 'active', datetime('now'), datetime('now'))`,
      params: [params.userId, params.agentProfileId, content],
    },
    {
      sql: `INSERT INTO agent_learning_events
            (user_id, agent_profile_id, event_type, payload_json, created_at)
            VALUES (?, ?, 'memory.explicit_captured', ?, datetime('now'))`,
      params: [
        params.userId,
        params.agentProfileId,
        JSON.stringify({ thread_id: params.threadId, content }),
      ],
    },
  ]);
}

export function extractExplicitMemory(message: string): string | null {
  const trimmed = message.trim().replace(/\s+/g, ' ');
  const patterns = [
    /(?:请你)?记住[：:，, ]*(.+)$/u,
    /(?:帮我)?记一下[：:，, ]*(.+)$/u,
    /以后你要记得[：:，, ]*(.+)$/u,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    const content = match?.[1]?.trim();
    if (content && content.length >= 2) {
      return content.slice(0, 240);
    }
  }
  return null;
}
