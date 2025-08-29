import { sql, desc, eq } from "drizzle-orm";
import type { DB } from "@workspace/db";
import { redis } from "../redis/client";

// NEW schema
import { contribRollups } from "@workspace/db/schema";

/** Windows we support in rollups */
export type WindowKey = "30d" | "365d";

/** Materialized period enum values in DB */
type PeriodKey = "last_30d" | "last_365d";

const PERIOD_FROM_WINDOW: Record<WindowKey, PeriodKey> = {
  "30d": "last_30d",
  "365d": "last_365d",
} as const;

/** Redis keys for sorted sets (ZSET) with scores = totals */
const REDIS_KEYS: Record<WindowKey, string> = {
  "30d": "lb:rollups:30d",
  "365d": "lb:rollups:365d",
} as const;

export type LeaderRow = { userId: string; score: number };

type ZRangeItemObj = { member?: unknown; score?: unknown };

/** Robustly parse Upstash zrange results (object form or tuple list). */
function parseZRange(res: unknown): LeaderRow[] {
  if (!res) return [];

  // Common Upstash return: [{ member, score }, ...]
  if (Array.isArray(res) && res.length > 0 && typeof res[0] === "object" && res[0] !== null) {
    return (res as ZRangeItemObj[]).flatMap((x) => {
      const id = typeof x.member === "string" ? x.member : String(x.member ?? "");
      const n = Number(x.score ?? 0);
      return id ? [{ userId: id, score: Number.isFinite(n) ? n : 0 }] : [];
    });
  }

  // Some clients return [member, score, member, score, ...]
  if (Array.isArray(res)) {
    const out: LeaderRow[] = [];
    for (let i = 0; i < res.length; i += 2) {
      const id = String(res[i] ?? "");
      const n = Number(res[i + 1] ?? 0);
      if (id) out.push({ userId: id, score: Number.isFinite(n) ? n : 0 });
    }
    return out;
  }

  return [];
}

/** Read a page from Redis; swallow errors so DB can be the fallback. */
async function topFromRedis(
  window: WindowKey,
  start: number,
  stop: number,
): Promise<LeaderRow[]> {
  try {
    const key = REDIS_KEYS[window];
    const res = await redis.zrange(key, start, stop, { rev: true, withScores: true });
    return parseZRange(res);
  } catch (err) {
    console.error("Redis error in topFromRedis:", err);
    return [];
  }
}

/** DB fallback: read rollups for a window (period), ordered by total desc. */
async function topFromDb(
  db: DB,
  window: WindowKey,
  limit: number,
  offset: number,
): Promise<LeaderRow[]> {
  const period = PERIOD_FROM_WINDOW[window]; // 'last_30d' | 'last_365d'

  const rows = await db
    .select({
      userId: contribRollups.userId,
      score: contribRollups.total,
    })
    .from(contribRollups)
    .where(eq(contribRollups.period, period))
    .orderBy(desc(contribRollups.total))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({ userId: r.userId, score: Number(r.score ?? 0) }));
}

/**
 * Public API
 * - Tries Redis ZSET first (fast path).
 * - Falls back to DB scan on contribRollups for the requested window.
 */
export async function getLeaderboardPage(
  db: DB,
  opts: {
    window: WindowKey;     // '30d' | '365d'
    limit: number;         // page size (1..100)
    cursor?: number;       // 0-based offset
  },
): Promise<{ entries: LeaderRow[]; nextCursor: number | null; source: "redis" | "db" }> {
  const limit = Math.min(Math.max(opts.limit, 1), 100);
  const start = Math.max(opts.cursor ?? 0, 0);
  const stop = start + limit - 1;

  // 1) Try Redis
  const fromRedis = await topFromRedis(opts.window, start, stop);
  if (fromRedis.length > 0) {
    const nextCursor = fromRedis.length === limit ? start + limit : null;
    return { entries: fromRedis, nextCursor, source: "redis" };
  }

  // 2) Fallback to DB
  const fromDb = await topFromDb(db, opts.window, limit, start);
  const nextCursor = fromDb.length === limit ? start + limit : null;
  return { entries: fromDb, nextCursor, source: "db" };
}
