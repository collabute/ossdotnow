import { redis } from '../redis/client';
import type { DB } from '@workspace/db';
import { desc, eq } from 'drizzle-orm';

import { contribRollups } from '@workspace/db/schema';

export type WindowKey = '30d' | '365d';

type PeriodKey = 'last_30d' | 'last_365d';

const PERIOD_FROM_WINDOW: Record<WindowKey, PeriodKey> = {
  '30d': 'last_30d',
  '365d': 'last_365d',
} as const;

const REDIS_KEYS: Record<WindowKey, string> = {
  '30d': 'lb:rollups:30d',
  '365d': 'lb:rollups:365d',
} as const;

export type LeaderRow = { userId: string; score: number };

type ZRangeItemObj = { member?: unknown; score?: unknown };

function parseZRange(res: unknown): LeaderRow[] {
  if (!res) return [];

  if (Array.isArray(res) && res.length > 0 && typeof res[0] === 'object' && res[0] !== null) {
    return (res as ZRangeItemObj[]).flatMap((x) => {
      const id = typeof x.member === 'string' ? x.member : String(x.member ?? '');
      const n = Number(x.score ?? 0);
      return id ? [{ userId: id, score: Number.isFinite(n) ? n : 0 }] : [];
    });
  }

  if (Array.isArray(res)) {
    const out: LeaderRow[] = [];
    for (let i = 0; i < res.length; i += 2) {
      const id = String(res[i] ?? '');
      const n = Number(res[i + 1] ?? 0);
      if (id) out.push({ userId: id, score: Number.isFinite(n) ? n : 0 });
    }
    return out;
  }

  return [];
}

async function topFromRedis(window: WindowKey, start: number, stop: number): Promise<LeaderRow[]> {
  try {
    const key = REDIS_KEYS[window];
    const res = await redis.zrange(key, start, stop, { rev: true, withScores: true });
    return parseZRange(res);
  } catch (err) {
    console.error('Redis error in topFromRedis:', err);
    return [];
  }
}

async function topFromDb(
  db: DB,
  window: WindowKey,
  limit: number,
  offset: number,
): Promise<LeaderRow[]> {
  const period = PERIOD_FROM_WINDOW[window];

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

export async function getLeaderboardPage(
  db: DB,
  opts: {
    window: WindowKey;
    limit: number;
    cursor?: number;
  },
): Promise<{ entries: LeaderRow[]; nextCursor: number | null; source: 'redis' | 'db' }> {
  const limit = Math.min(Math.max(opts.limit, 1), 100);
  const start = Math.max(opts.cursor ?? 0, 0);
  const stop = start + limit - 1;

  const fromRedis = await topFromRedis(opts.window, start, stop);
  if (fromRedis.length > 0) {
    const nextCursor = fromRedis.length === limit ? start + limit : null;
    return { entries: fromRedis, nextCursor, source: 'redis' };
  }

  const fromDb = await topFromDb(db, opts.window, limit, start);
  const nextCursor = fromDb.length === limit ? start + limit : null;
  return { entries: fromDb, nextCursor, source: 'db' };
}
