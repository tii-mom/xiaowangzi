import type { DatabaseAdapter, DatabaseRow, QueryResult } from './db';

/**
 * Cloudflare Workers 原生 D1 Binding Adapter
 *
 * 通过 wrangler.jsonc 中的 d1_databases binding 访问 D1。
 * 使用 getCloudflareContext().env.DB 获取 D1Database 实例。
 */
export class D1BindingAdapter implements DatabaseAdapter {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async query<T = DatabaseRow>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const stmt = this.db.prepare(sql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await bound.all();
    return {
      results: result.results as T[],
      success: result.success,
      meta: result.meta ? {
        duration: result.meta.duration ?? 0,
        last_row_id: result.meta.last_row_id,
        changes: result.meta.changes,
      } : undefined,
    };
  }

  async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const stmt = this.db.prepare(sql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await bound.run();
    return {
      results: [],
      success: result.success,
      meta: result.meta ? {
        duration: result.meta.duration ?? 0,
        last_row_id: result.meta.last_row_id,
        changes: result.meta.changes,
      } : undefined,
    };
  }

  async batch(
    statements: Array<{ sql: string; params?: unknown[] }>,
  ): Promise<QueryResult[]> {
    const stmts = statements.map((s) => {
      const stmt = this.db.prepare(s.sql);
      return s.params && s.params.length > 0 ? stmt.bind(...s.params) : stmt;
    });
    const results = await this.db.batch(stmts);
    return results.map((r) => ({
      results: r.results as DatabaseRow[],
      success: r.success,
      meta: r.meta ? {
        duration: r.meta.duration ?? 0,
        last_row_id: r.meta.last_row_id,
        changes: r.meta.changes,
      } : undefined,
    }));
  }
}
