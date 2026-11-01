import { db } from './db';

export interface Limit {
  /** Short bucket name, e.g. "login". Combined with the caller identity to form the key. */
  name: string;
  max: number;
  windowSec: number;
}

export interface LimitResult {
  allowed: boolean;
  count: number;
  retryAfterSec: number;
}

/**
 * Fixed-window counter stored in Postgres so limits hold across serverless instances.
 * `identity` is an IP address, a user id, or a hashed identifier.
 */
export async function consume(name: string, identity: string, max: number, windowSec: number): Promise<LimitResult> {
  const key = `${name}:${identity}`.slice(0, 200);
  const row = await db.one<{ count: number; window_start: Date }>(
    `INSERT INTO rate_limits (key, window_start, count)
     VALUES ($1, to_timestamp((floor(extract(epoch from now()) / $2::int) * $2::int)::double precision), 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count, window_start`,
    [key, windowSec],
  );
  const count = row?.count ?? 1;
  const windowEnd = (row ? new Date(row.window_start).getTime() : Date.now()) + windowSec * 1000;
  return {
    allowed: count <= max,
    count,
    retryAfterSec: Math.max(1, Math.ceil((windowEnd - Date.now()) / 1000)),
  };
}

/** Peek without incrementing. Used to block an identity that already failed too often. */
export async function peek(name: string, identity: string, windowSec: number): Promise<number> {
  const key = `${name}:${identity}`.slice(0, 200);
  const row = await db.one<{ count: number }>(
    `SELECT count FROM rate_limits
     WHERE key = $1 AND window_start = to_timestamp((floor(extract(epoch from now()) / $2::int) * $2::int)::double precision)`,
    [key, windowSec],
  );
  return row?.count ?? 0;
}

export async function cleanupRateLimits(): Promise<number> {
  const rows = await db.query(`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day' RETURNING 1`);
  return rows.length;
}
