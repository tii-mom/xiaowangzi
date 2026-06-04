import { getDb, type DatabaseAdapter } from '@/lib/db';

export interface AgentResult {
  id: number;
  user_id: number;
  status: string;
  agent_name: string;
}

export interface AgentManager {
  createUserAgent(userId: number): Promise<AgentResult>;
  getUserAgent(userId: number): Promise<AgentResult | null>;
  resetUserAgent(userId: number): Promise<AgentResult>;
}

// ---------------------------------------------------------------------------
// LocalAgentManager — Web MVP 默认使用，不依赖 Hermes
// ---------------------------------------------------------------------------

class LocalAgentManager implements AgentManager {
  private db: DatabaseAdapter;
  constructor(db: DatabaseAdapter) {
    this.db = db;
  }

  async createUserAgent(userId: number): Promise<AgentResult> {
    const existing = await this.db.query(
      "SELECT * FROM user_agents WHERE user_id = ? AND status IN ('pending', 'active') LIMIT 1",
      [userId],
    );
    if (existing.results.length > 0) {
      return existing.results[0] as unknown as AgentResult;
    }

    await this.db.execute(
      "INSERT INTO user_agents (user_id, agent_name, status) VALUES (?, ?, 'active')",
      [userId, `local-user-${userId}`],
    );

    const created = await this.db.query(
      'SELECT * FROM user_agents WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [userId],
    );
    return created.results[0] as unknown as AgentResult;
  }

  async getUserAgent(userId: number): Promise<AgentResult | null> {
    const rows = await this.db.query(
      "SELECT * FROM user_agents WHERE user_id = ? AND status IN ('pending', 'active') ORDER BY id DESC LIMIT 1",
      [userId],
    );
    if (rows.results.length === 0) return null;
    return rows.results[0] as unknown as AgentResult;
  }

  async resetUserAgent(userId: number): Promise<AgentResult> {
    await this.db.execute(
      "DELETE FROM user_agents WHERE user_id = ?",
      [userId],
    );
    return this.createUserAgent(userId);
  }
}

// ---------------------------------------------------------------------------
// HermesAgentManager — skeleton，待 Hermes 验证后启用
// ---------------------------------------------------------------------------

class HermesAgentManager implements AgentManager {
  private db: DatabaseAdapter;
  constructor(db: DatabaseAdapter) {
    this.db = db;
  }

  private checkHermesConfig(): void {
    const baseUrl = process.env.HERMES_BASE_URL;
    const apiKey = process.env.HERMES_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error('[HermesAgentManager] HERMES_BASE_URL 或 HERMES_API_KEY 未配置，无法使用 Hermes Agent。当前应使用 LocalAgentManager。');
    }
  }

  async createUserAgent(userId: number): Promise<AgentResult> {
    this.checkHermesConfig();
    throw new Error('[HermesAgentManager] Hermes 子 Agent 创建 API 未验证，请使用 LocalAgentManager。');
  }

  async getUserAgent(userId: number): Promise<AgentResult | null> {
    this.checkHermesConfig();
    throw new Error('[HermesAgentManager] Hermes 子 Agent 查询 API 未验证，请使用 LocalAgentManager。');
  }

  async resetUserAgent(userId: number): Promise<AgentResult> {
    this.checkHermesConfig();
    throw new Error('[HermesAgentManager] Hermes 子 Agent 重置 API 未验证，请使用 LocalAgentManager。');
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let _manager: AgentManager | null = null;

export function getAgentManager(): AgentManager {
  if (_manager) return _manager;

  const db = getDb();
  const useHermes = process.env.AGENT_BACKEND === 'hermes';

  if (useHermes) {
    _manager = new HermesAgentManager(db);
  } else {
    _manager = new LocalAgentManager(db);
  }

  return _manager;
}

export function resetAgentManager(): void {
  _manager = null;
}
