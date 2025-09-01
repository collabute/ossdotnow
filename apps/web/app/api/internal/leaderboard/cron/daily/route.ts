export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { isCronAuthorized } from '@workspace/env/verify-cron';
import { env } from '@workspace/env/server';
import { NextRequest } from 'next/server';
import { z } from 'zod/v4';

import { syncUserLeaderboards } from '@workspace/api/leaderboard/redis';
import { refreshUserRollups } from '@workspace/api/leaderboard/aggregator';
import { redis } from '@workspace/api/redis/client';
import { db } from '@workspace/db';

const USER_SET = 'lb:users';
const META = (id: string) => `lb:user:${id}`;

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
  concurrency: z.coerce.number().int().min(1).max(8).default(4),
  dry: z.union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')]).optional(),
});

function ymd(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export async function GET(req: NextRequest) {
  const ok =
    isCronAuthorized(req.headers.get('authorization')) || !!req.headers.get('x-vercel-cron');
  if (!ok) return new Response('Unauthorized', { status: 401 });

  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return new Response(`Bad Request: ${parsed.error.message}`, { status: 400 });
  }
  const { limit, concurrency, dry } = parsed.data;
  const isDry = dry === '1' || dry === 'true';

  const snapshotDate = ymd(new Date());

  try {
    await redis.ping();

    const allIdsRaw = await redis.smembers(USER_SET);
    const userIds = (Array.isArray(allIdsRaw) ? allIdsRaw : []).map(String).slice(0, limit);

    if (userIds.length === 0) {
      return Response.json({
        ok: true,
        scanned: 0,
        processed: 0,
        skipped: 0,
        errors: [],
        snapshotDate,
        note: `No user IDs in Redis set "${USER_SET}". Seed it via backfill.`,
      });
    }

    const pipe = redis.pipeline();
    for (const id of userIds) pipe.hgetall(META(id));
    const rawResults = await pipe.exec();

    const metaRows = rawResults.map((r) => {
      const val = Array.isArray(r) ? r[1] : r;
      return val && typeof val === 'object' ? (val as Record<string, unknown>) : {};
    });

    const asTrimmedString = (v: unknown): string | undefined => {
      if (typeof v === 'string') return v.trim();
      if (v == null) return undefined;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
      if (Array.isArray(v)) return v.length ? String(v[0]).trim() : undefined;
      return undefined;
    };

    if (isDry) {
      const preview = userIds.map((id, i) => {
        const m = metaRows[i] || {};
        const githubLogin = asTrimmedString(m.githubLogin) ?? null;
        const gitlabUsername = asTrimmedString(m.gitlabUsername) ?? null;
        return { userId: id, githubLogin, gitlabUsername };
      });
      return Response.json({
        ok: true,
        dryRun: true,
        scanned: userIds.length,
        sample: preview.slice(0, 10),
        snapshotDate,
      });
    }

    const workers = Math.max(1, Math.min(concurrency, 8));
    let idx = 0;
    let processed = 0;
    let skipped = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    const tasks = Array.from({ length: workers }, async () => {
      while (true) {
        const i = idx++;
        if (i >= userIds.length) break;

        const userId = userIds[i]!;
        const m = metaRows[i] || {};
        const githubLogin = asTrimmedString(m.githubLogin);
        const gitlabUsername = asTrimmedString(m.gitlabUsername);

        if (!githubLogin && !gitlabUsername) {
          skipped++;
          continue;
        }

        if (githubLogin && !env.GITHUB_TOKEN) {
          errors.push({ userId, error: 'Missing GITHUB_TOKEN' });
          skipped++;
          continue;
        }
        if (gitlabUsername && !env.GITLAB_TOKEN) {
          errors.push({ userId, error: 'Missing GITLAB_TOKEN' });
          skipped++;
          continue;
        }

        try {
          await refreshUserRollups(
            { db },
            {
              userId,
              githubLogin,
              gitlabUsername,
              githubToken: env.GITHUB_TOKEN,
              gitlabToken: env.GITLAB_TOKEN,
              gitlabBaseUrl: env.GITLAB_ISSUER || 'https://gitlab.com',
            },
          );

          await syncUserLeaderboards(db, userId);
          processed++;
        } catch (err) {
          errors.push({ userId, error: String(err instanceof Error ? err.message : err) });
        }
      }
    });

    await Promise.all(tasks);

    return Response.json({
      ok: true,
      scanned: userIds.length,
      processed,
      skipped,
      errors,
      snapshotDate,
    });
  } catch (err: unknown) {
    const msg = String(err instanceof Error ? `${err.name}: ${err.message}` : err);
    if (env.VERCEL_ENV !== 'production') {
      console.error('[cron/daily-rollups] fatal:', err);
      return new Response(`Internal Error: ${msg}`, { status: 500 });
    }
    return new Response('Internal Error', { status: 500 });
  }
}
