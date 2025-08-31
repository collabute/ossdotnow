#!/usr/bin/env bun
/**
 * Batch backfill for all users in Redis.
 *
 * - Reads user IDs from Redis set: lb:users
 * - Skips users already processed (tracked in: lb:backfill:done:<days>)
 * - Reads provider handles from: lb:user:<id>  (githubLogin / gitlabUsername)
 * - Calls POST /api/internal/leaderboard/backfill for each user
 * - Bounded concurrency; retries on 409/429/5xx with backoff
 *
 * Usage:
 *   bun scripts/lb-backfill-365-all.ts --days=365 --batch=150 --concurrency=4 --origin=http://localhost:3000
 *
 * Env:
 *   CRON_SECRET (required)
 *   DATABASE_URL            (not used here, only Redis + HTTP)
 *   UPSTASH_REDIS_REST_URL  (required by your redis client)
 *   UPSTASH_REDIS_REST_TOKEN (required by your redis client)
 *
 * Notes:
 * - This script is idempotent thanks to "done" set tracking.
 * - You can re-run until it prints "All users processed".
 */

import { redis } from '../packages/api/src/redis/client';

type Flags = {
  days: number;
  batch: number;
  concurrency: number;
  jitterMinMs: number;
  jitterMaxMs: number;
  origin: string;
  dry: boolean;
};

function parseFlags(): Flags {
  const args = new Map<string, string>();
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args.set(m[1], m[2]);
    else if (a === '--dry') args.set('dry', 'true');
  }

  const envOrigin =
    process.env.ORIGIN ||
    (process.env.VERCEL_ENV === 'production'
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : `http://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'localhost:3000'}`);

  return {
    days: Number(args.get('days') ?? 365),
    batch: Number(args.get('batch') ?? 150),
    concurrency: Number(args.get('concurrency') ?? 4),
    jitterMinMs: Number(args.get('jitterMinMs') ?? 80),
    jitterMaxMs: Number(args.get('jitterMaxMs') ?? 220),
    origin: String(args.get('origin') ?? envOrigin),
    dry: (args.get('dry') ?? 'false') === 'true',
  };
}

const USER_SET = 'lb:users';
const META = (id: string) => `lb:user:${id}`;
const DONE = (days: number) => `lb:backfill:done:${days}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

function asTrimmed(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (v == null) return undefined;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim() || undefined;
  return undefined;
}

async function fetchMetaFor(
  ids: string[],
): Promise<Array<{ id: string; gh?: string; gl?: string }>> {
  const pipe = redis.pipeline();
  for (const id of ids) pipe.hgetall(META(id));
  const raw = await pipe.exec();

  return raw.map((item: any, i: number) => {
    const val = Array.isArray(item) ? item[1] : item;
    const obj = (val && typeof val === 'object' ? val : {}) as Record<string, unknown>;
    return {
      id: ids[i]!,
      gh: asTrimmed(obj.githubLogin),
      gl: asTrimmed(obj.gitlabUsername),
    };
  });
}

async function filterUndone(ids: string[], days: number): Promise<string[]> {
  const pipe = redis.pipeline();
  for (const id of ids) pipe.sismember(DONE(days), id);
  const res = await pipe.exec();
  return ids.filter((_, i) => {
    const item = Array.isArray(res[i]) ? res[i][1] : res[i];
    return !item;
  });
}

type BackfillResult = { ok: boolean; status: number; body?: any };

async function callBackfill(
  origin: string,
  cronSecret: string,
  body: Record<string, unknown>,
): Promise<BackfillResult> {
  const url = `${origin}/api/internal/leaderboard/backfill`;

  let attempt = 0;
  const maxAttempts = 4;

  while (true) {
    attempt++;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify(body),
      });

      const text = await r.text().catch(() => '');
      let parsed: any = undefined;
      try {
        parsed = text ? JSON.parse(text) : undefined;
      } catch {
        parsed = text;
      }

      if (r.ok) return { ok: true, status: r.status, body: parsed };

      if (r.status === 409 && attempt <= maxAttempts) {
        console.warn(`[backfill] 409 conflict; retrying in 60s…`);
        await sleep(60_000);
        continue;
      }

      if ((r.status === 429 || r.status === 403) && attempt <= maxAttempts) {
        const backoff = 60_000 * attempt;
        console.warn(`[backfill] ${r.status} rate-limited; retrying in ${backoff / 1000}s…`);
        await sleep(backoff);
        continue;
      }

      if (r.status >= 500 && attempt <= maxAttempts) {
        const backoff = 10_000 * attempt;
        console.warn(`[backfill] ${r.status} server error; retrying in ${backoff / 1000}s…`);
        await sleep(backoff);
        continue;
      }

      return { ok: false, status: r.status, body: parsed };
    } catch (e) {
      if (attempt <= maxAttempts) {
        const backoff = 5_000 * attempt;
        console.warn(
          `[backfill] fetch error (${(e as Error).message}); retrying in ${backoff / 1000}s…`,
        );
        await sleep(backoff);
        continue;
      }
      return { ok: false, status: 0, body: String(e) };
    }
  }
}

async function main() {
  const flags = parseFlags();
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET is required in env.');
    process.exit(1);
  }

  console.log(
    `Starting backfill: days=${flags.days} batch=${flags.batch} concurrency=${flags.concurrency} origin=${flags.origin} dry=${flags.dry}`,
  );

  await redis.ping();

  const allIds = (await redis.smembers(USER_SET)).map(String);
  if (allIds.length === 0) {
    console.log(`No users found in Redis set ${USER_SET}. Seed it first.`);
    return;
  }

  while (true) {
    const undone = await filterUndone(allIds, flags.days);
    if (undone.length === 0) {
      const totalDone = await redis.scard(DONE(flags.days));
      console.log(`✅ All users processed for ${flags.days}d. Done count = ${totalDone}.`);
      break;
    }

    const batch = undone.slice(0, flags.batch);
    console.log(`Processing batch of ${batch.length} (remaining ~${undone.length})…`);

    const metas = await fetchMetaFor(batch);
    const tasksQueue = metas.filter((m) => m.gh || m.gl);
    const skipped = metas.length - tasksQueue.length;
    if (skipped) console.log(`Skipping ${skipped} users without provider handles.`);

    let idx = 0;
    const results: Array<{ id: string; ok: boolean; status: number }> = [];

    const workers = Array.from(
      { length: Math.max(1, Math.min(flags.concurrency, 8)) },
      async () => {
        while (true) {
          const i = idx++;
          if (i >= tasksQueue.length) break;

          const { id, gh, gl } = tasksQueue[i]!;
          const body = {
            userId: id,
            githubLogin: gh,
            gitlabUsername: gl,
            days: flags.days,
            concurrency: 4,
          };

          if (flags.dry) {
            console.log(`[dry] would backfill ${id} (gh=${gh ?? '-'} gl=${gl ?? '-'})`);
            results.push({ id, ok: true, status: 200 });
            continue;
          }

          await sleep(jitter(flags.jitterMinMs, flags.jitterMaxMs));

          const res = await callBackfill(flags.origin, cronSecret, body);
          if (!res.ok) {
            const msg =
              typeof res.body === 'string'
                ? res.body
                : res.body?.error || res.body?.message || JSON.stringify(res.body ?? {});
            console.warn(`[backfill] user=${id} -> ${res.status} ${msg}`);
          } else {
            console.log(`[backfill] user=${id} -> OK (${res.status})`);
          }

          results.push({ id, ok: res.ok, status: res.status });
        }
      },
    );

    await Promise.all(workers);

    const succeeded = results.filter((r) => r.ok).map((r) => r.id);
    if (succeeded.length) {
      if (flags.dry) {
        console.log(`[dry] would mark done in ${DONE(flags.days)}: ${succeeded.join(', ')}`);
      } else {
        const pipe = redis.pipeline();
        for (const id of succeeded) pipe.sadd(DONE(flags.days), id);
        await pipe.exec();
      }
    }

    const failed = results.filter((r) => !r.ok).map((r) => r.id);
    console.log(
      `Batch complete: ok=${succeeded.length}, failed=${failed.length}, marked done=${flags.dry ? 0 : succeeded.length}.`,
    );

    if (succeeded.length === 0 && failed.length > 0) {
      console.warn(`No successes in this batch; backing off 90s before next batch…`);
      await sleep(90_000);
    }
  }

  const total = await redis.scard(USER_SET);
  const done = await redis.scard(DONE(flags.days));
  console.log(`Finished. USER_SET=${total}, DONE(${flags.days})=${done}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
