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

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '(unable to read body)');
      const preview = bodyText.length > 300 ? bodyText.slice(0, 300) + '...' : bodyText;
      throw new Error(`D1 HTTP ${response.status}: ${preview}`);
    }

    let data: D1RestResponse;
    try {
      data = await response.json() as D1RestResponse;
    } catch (parseErr) {
      throw new Error(`D1 response JSON parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
    }

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
  private nextId: Map<string, number> = new Map();

  async query<T = DatabaseRow>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const upper = sql.trim().toUpperCase();
    const start = Date.now();
    const table = this.getTable(sql);

    if (upper.startsWith('SELECT')) {
      const rows = (this.store.get(table) ?? []) as unknown as T[];
      return { results: rows, success: true, meta: { duration: Date.now() - start } };
    }

    if (upper.startsWith('INSERT')) {
      const id = this.getNextId(table);
      const row = this.buildInsertRow(sql, id, params);
      const existing = this.store.get(table) ?? [];
      this.store.set(table, [...existing, row]);
      return { results: [row] as unknown as T[], success: true, meta: { duration: Date.now() - start, last_row_id: id, changes: 1 } };
    }

    if (upper.startsWith('UPDATE')) {
      const existing = this.store.get(table) ?? [];
      let changes = 0;
      if (existing.length > 0) {
        this.applyUpdate(existing, sql);
        changes = 1;
      }
      return { results: [] as unknown as T[], success: true, meta: { duration: Date.now() - start, changes } };
    }

    if (upper.startsWith('DELETE')) {
      return { results: [] as unknown as T[], success: true, meta: { duration: Date.now() - start, changes: 0 } };
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

  private getTable(sql: string): string {
    const m = sql.match(/(?:INTO|FROM|UPDATE)\s+(\w+)/i);
    return m ? m[1].toLowerCase() : 'unknown';
  }

  private getNextId(table: string): number {
    const v = (this.nextId.get(table) ?? 0) + 1;
    this.nextId.set(table, v);
    return v;
  }

  private buildInsertRow(sql: string, autoId: number, params: unknown[]): Record<string, unknown> {
    const row: Record<string, unknown> = { id: autoId };
    const colsMatch = sql.match(/\(([^)]+)\)/i);
    if (!colsMatch) return row;
    const cols = colsMatch[1].split(',').map((c) => c.trim().split(/\s+/)[0]);

    const valuesRaw = sql.slice(sql.lastIndexOf('VALUES') + 6, sql.lastIndexOf(')'));
    const valueParts = this.splitValues(valuesRaw);

    let paramIdx = 0;
    for (let i = 0; i < cols.length && i < valueParts.length; i++) {
      const colName = cols[i].toLowerCase();
      const valPart = valueParts[i].trim();

      if (valPart === '?') {
        const v = params[paramIdx++];
        if (colName === 'id' && v !== undefined && v !== null) {
          row.id = typeof v === 'number' ? v : parseInt(String(v), 10);
        } else if (v === null || v === undefined) {
          row[colName] = null;
        } else {
          row[colName] = v;
        }
      } else {
        const cleaned = valPart.replace(/^['"]/,'').replace(/['"]$/, '').replace(/^datetime\([^)]*\)$/, new Date().toISOString());
        const parsed = parseInt(cleaned, 10);
        if (colName === 'id' && !Number.isNaN(parsed)) {
          row.id = parsed;
        } else if (cleaned.toLowerCase() === 'null') {
          row[colName] = null;
        } else {
          row[colName] = Number.isNaN(parsed) ? cleaned : parsed;
        }
      }
    }
    return row;
  }

  private splitValues(raw: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    let inString = false;
    let quoteChar = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (inString) {
        current += ch;
        if (ch === quoteChar) inString = false;
      } else if (ch === '(') {
        depth++;
        current += ch;
      } else if (ch === ')') {
        depth--;
        current += ch;
      } else if (ch === ',' && depth === 0) {
        parts.push(current);
        current = '';
      } else if (ch === "'" || ch === '"') {
        inString = true;
        quoteChar = ch;
        current += ch;
      } else {
        current += ch;
      }
    }
    if (current.trim()) parts.push(current);
    return parts;
  }

  private applyUpdate(rows: Array<Record<string, unknown>>, sql: string): void {
    const setMatch = sql.match(/SET\s+([\s\S]+?)(?:\s+WHERE|$)/i);
    if (!setMatch) return;
    const setClauses = setMatch[1].split(',').map((s) => s.trim());
    for (const clause of setClauses) {
      const eq = clause.split('=');
      if (eq.length < 2) continue;
      const col = eq[0].trim().toLowerCase();
      const expr = eq.slice(1).join('=').trim();
      for (const row of rows) {
        const current = (row[col] as number) ?? 0;
        if (expr.includes('+')) {
          row[col] = current + (parseInt(expr.replace(/[^0-9-]/g, ''), 10) || 0);
        } else if (expr.includes('-') && !expr.includes('now')) {
          if (expr.trim().toLowerCase().startsWith(col)) {
            row[col] = current - (parseInt(expr.replace(/[^0-9-]/g, ''), 10) || 0);
          } else {
            const v = parseInt(expr, 10);
            row[col] = Number.isNaN(v) ? expr : v;
          }
        } else {
          const v = parseInt(expr, 10);
          row[col] = Number.isNaN(v) ? expr : v;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let _db: DatabaseAdapter | null = null;

export function createDatabaseAdapter(): DatabaseAdapter {
  const nodeEnv = process.env.NODE_ENV;
  const explicitMock = process.env.DATABASE_ADAPTER === 'mock';

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  const hasD1Config = Boolean(accountId && databaseId && apiToken);

  if (nodeEnv === 'production') {
    if (!hasD1Config) {
      throw new Error(
        '[db] Production 环境禁止使用 MockAdapter。' +
        '请设置 CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_API_TOKEN。'
      );
    }
    return new D1RestAdapter(accountId!, databaseId!, apiToken!);
  }

  if (hasD1Config) {
    return new D1RestAdapter(accountId!, databaseId!, apiToken!);
  }

  if (explicitMock || nodeEnv === 'development' || nodeEnv === 'test' || !nodeEnv) {
    console.warn(
      '[db] 使用 MockAdapter（数据仅存在于内存，重启丢失）。' +
      '如需连接真实 D1，请设置 CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_DATABASE_ID / CLOUDFLARE_API_TOKEN。'
    );
    return new MockAdapter();
  }

  throw new Error(
    `[db] 无法创建 DatabaseAdapter。NODE_ENV=${nodeEnv}, DATABASE_ADAPTER=${process.env.DATABASE_ADAPTER}`
  );
}

export function getDb(): DatabaseAdapter {
  if (!_db) {
    _db = createDatabaseAdapter();
  }
  return _db;
}
