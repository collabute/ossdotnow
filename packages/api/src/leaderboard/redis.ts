import { contribRollups } from "@workspace/db/schema";
import { redis } from "../redis/client";
import type { DB } from "@workspace/db";
import { eq } from "drizzle-orm";

type PeriodKey = "last_30d" | "last_365d" | "all_time"; // depending on what you store

// Redis ZSET keys for each period
const PERIOD_KEYS: Record<PeriodKey, string> = {
  last_30d: "lb:rollups:30d",
  last_365d: "lb:rollups:365d",
  all_time: "lb:rollups:all",
};

const USER_SET = "lb:users";

export async function syncUserLeaderboards(db: DB, userId: string): Promise<void> {
  await redis.sadd(USER_SET, userId);

  const rows = await db
    .select({
      period: contribRollups.period,
      total: contribRollups.total,
    })
    .from(contribRollups)
    .where(eq(contribRollups.userId, userId));

  const pipe = redis.pipeline();

  for (const r of rows) {
    const period = r.period as PeriodKey;
    const total = Number(r.total ?? 0);
    const key = PERIOD_KEYS[period];
    if (key) {
      pipe.zadd(key, { score: total, member: userId });
    }
  }

  pipe.sadd(USER_SET, userId);
  await pipe.exec();
}

/** Remove a user entirely from all leaderboard ZSETs. */
export async function removeUserFromLeaderboards(userId: string): Promise<void> {
  const keys = Object.values(PERIOD_KEYS);
  const pipe = redis.pipeline();
  for (const k of keys) pipe.zrem(k, userId);
  pipe.srem(USER_SET, userId);
  await pipe.exec();
}

/** Get the top N users for a given window. */
export async function topPeriod(limit = 10, period: PeriodKey = "last_30d") {
  const key = PERIOD_KEYS[period];
  const res = await redis.zrange(key, 0, limit - 1, { rev: true, withScores: true });

  // parse Upstash results (objects or tuples)
  if (Array.isArray(res) && res.length && typeof res[0] === "object") {
    return (res as Array<{ member: string; score: number | string }>).map(({ member, score }) => ({
      userId: member,
      score: typeof score === "string" ? Number(score) : Number(score ?? 0),
    }));
  }

  if (Array.isArray(res)) {
    const out: Array<{ userId: string; score: number }> = [];
    for (let i = 0; i < res.length; i += 2) {
      const member = String(res[i] ?? "");
      const score = Number(res[i + 1] ?? 0);
      out.push({ userId: member, score });
    }
    return out;
  }

  return [];
}

/** List all user IDs ever synced into Redis leaderboards. */
export async function allKnownUserIds(): Promise<string[]> {
  const ids = await redis.smembers(USER_SET);
  return Array.isArray(ids) ? ids.map(String) : [];
}
