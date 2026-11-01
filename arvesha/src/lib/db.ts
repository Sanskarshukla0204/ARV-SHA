import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { env } from './env';

// One pool per server instance. In development the pool survives hot reloads.
const globalForPool = globalThis as unknown as { __arvPool?: Pool };

function createPool(): Pool {
  const connectionString = env('DATABASE_URL');
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({
    connectionString,
    max: Number(env('DATABASE_POOL_MAX') ?? 5),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
  });
  // A dropped idle connection must never crash the process.
  pool.on('error', (err) => console.error('[db] idle client error', err.message));
  return pool;
}

export function pool(): Pool {
  if (!globalForPool.__arvPool) globalForPool.__arvPool = createPool();
  return globalForPool.__arvPool;
}

export interface Queryable {
  query<T extends QueryResultRow = any>(text: string, params?: unknown[]): Promise<T[]>;
  one<T extends QueryResultRow = any>(text: string, params?: unknown[]): Promise<T | null>;
}

function wrap(runner: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }): Queryable {
  return {
    async query(text, params) {
      const res = await runner.query(text, params);
      return res.rows;
    },
    async one(text, params) {
      const res = await runner.query(text, params);
      return res.rows[0] ?? null;
    },
  };
}

/** Run one parameterised statement. Never build SQL by concatenating user input. */
export const db: Queryable = {
  query: (text, params) => wrap(pool()).query(text, params),
  one: (text, params) => wrap(pool()).one(text, params),
};

/** Run several statements in a single transaction. Rolls back on any thrown error. */
export async function tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  const client: PoolClient = await pool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(wrap(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection already gone */
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Escape user text for use inside an ILIKE pattern. */
export function likePattern(input: string): string {
  return `%${input.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export function isUniqueViolation(err: unknown, constraintContains?: string): boolean {
  const e = err as { code?: string; constraint?: string };
  if (e?.code !== '23505') return false;
  return constraintContains ? (e.constraint ?? '').includes(constraintContains) : true;
}
