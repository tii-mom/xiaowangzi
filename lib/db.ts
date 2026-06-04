export type DatabaseRow = Record<string, unknown>;

export interface QueryResult<T = DatabaseRow> {
  results: T[];
  success: boolean;
  meta?: {
    duration: number;
    last_row_id?: number;
    changes?: number;
  };
}

export interface DatabaseAdapter {
  query<T = DatabaseRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  batch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<QueryResult[]>;
}

// ---------------------------------------------------------------------------
// D1 REST API Adapter
// ---------------------------------------------------------------------------

interface D1RestResponse {
  result: Array<{
    results: Array<Record<string, unknown>>;
    success: boolean;
    meta?: { duration: number; last_row_id: number; changes: number };
  }>;
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: unknown[];
}

class D1RestAdapter implements DatabaseAdapter {
  private accountId: string;
  private databaseId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor(accountId: string, databaseId: string, apiToken: string) {
    this.accountId = accountId;
    this.databaseId = databaseId;
    this.apiToken = apiToken;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}`;
  }

  async query<T = DatabaseRow>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const response = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });

    const data: D1RestResponse = await response.json();

    if (!data.success || data.errors.length > 0) {
      const errorMsg = data.errors.map((e) => e.message).join('; ');
      throw new Error(`D1 query failed: ${errorMsg}`);
    }

    const firstResult = data.result[0];
    if (!firstResult) {
      throw new Error('D1 query returned no result');
    }

    return {
      results: firstResult.results as T[],
      success: firstResult.success,
      meta: firstResult.meta ? {
        duration: firstResult.meta.duration,
        last_row_id: firstResult.meta.last_row_id,
        changes: firstResult.meta.changes,
      } : undefined,
    };
  }

  async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    return this.query(sql, params);
  }

  async batch(
    statements: Array<{ sql: string; params?: unknown[] }>,
  ): Promise<QueryResult[]> {
    const results: QueryResult[] = [];
    for (const stmt of statements) {
      const result = await this.query(stmt.sql, stmt.params ?? []);
      results.push(result);
    }
    return results;
  }
}

// ---------------------------------------------------------------------------
// Mock Adapter (本地开发用，内存存储)
// ---------------------------------------------------------------------------

class MockAdapter implements DatabaseAdapter {
  private store: Map<string, Array<Record<string, unknown>>> = new Map();
  private autoIncrements: Map<string, number> = new Map();

  async query<T = DatabaseRow>(sql: string, _params: unknown[] = []): Promise<QueryResult<T>> {
    const upper = sql.trim().toUpperCase();
    const start = Date.now();

    if (upper.startsWith('SELECT')) {
      const tableMatch = sql.match(/FROM\s+(\w+)/i);
      const table = tableMatch ? tableMatch[1].toLowerCase() : 'unknown';
      const rows = (this.store.get(table) ?? []) as unknown as T[];
      return { results: rows, success: true, meta: { duration: Date.now() - start } };
    }

    if (upper.startsWith('INSERT')) {
      const tableMatch = sql.match(/INTO\s+(\w+)/i);
      const table = tableMatch ? tableMatch[1].toLowerCase() : 'unknown';
      const current = this.autoIncrements.get(table) ?? 0;
      const nextId = current + 1;
      this.autoIncrements.set(table, nextId);

      const row: Record<string, unknown> = { id: nextId };
      const existing = this.store.get(table) ?? [];
      this.store.set(table, [...existing, row]);

      return {
        results: [row] as unknown as T[],
        success: true,
        meta: { duration: Date.now() - start, last_row_id: nextId, changes: 1 },
      };
    }

    if (upper.startsWith('UPDATE')) {
      const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
      const table = tableMatch ? tableMatch[1].toLowerCase() : 'unknown';
      return {
        results: [] as unknown as T[],
        success: true,
        meta: { duration: Date.now() - start, changes: 0 },
      };
    }

    if (upper.startsWith('DELETE')) {
      return {
        results: [] as unknown as T[],
        success: true,
        meta: { duration: Date.now() - start, changes: 0 },
      };
    }

    return { results: [] as unknown as T[], success: true, meta: { duration: Date.now() - start } };
  }

  async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    return this.query(sql, params);
  }

  async batch(
    statements: Array<{ sql: string; params?: unknown[] }>,
  ): Promise<QueryResult[]> {
    const results: QueryResult[] = [];
    for (const stmt of statements) {
      const result = await this.execute(stmt.sql, stmt.params ?? []);
      results.push(result);
    }
    return results;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let _db: DatabaseAdapter | null = null;

export function createDatabaseAdapter(): DatabaseAdapter {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (accountId && databaseId && apiToken) {
    return new D1RestAdapter(accountId, databaseId, apiToken);
  }

  console.warn('[db] Cloudflare D1 env vars not set. Using MockAdapter. All data is in-memory and will be lost on restart.');

  return new MockAdapter();
}

export function getDb(): DatabaseAdapter {
  if (!_db) {
    _db = createDatabaseAdapter();
  }
  return _db;
}
