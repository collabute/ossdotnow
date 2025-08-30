
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod/v4';

import { isCronAuthorized } from '@workspace/env/verify-cron';
import { env } from '@workspace/env/server';

import { backfillLockKey, withLock, acquireLock, releaseLock } from '@workspace/api/locks';
import { syncUserLeaderboards } from '@workspace/api/leaderboard/redis';
import { setUserMetaFromProviders } from '@workspace/api/use-meta';
import { db } from '@workspace/db';
import { refreshUserRollups } from '@workspace/api/aggregator';

function ymd(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

const Body = z
  .object({
    userId: z.string().min(1).transform((s) => s.trim()),
    githubLogin: z.string().min(1).transform((s) => s.trim()).optional(),
    gitlabUsername: z.string().min(1).transform((s) => s.trim()).optional(),

    days: z.number().int().min(1).max(365).optional(),
    concurrency: z.number().int().min(1).max(8).optional(),
  })
  .refine((b) => !!b.githubLogin || !!b.gitlabUsername, {
    message: 'At least one of githubLogin or gitlabUsername is required.',
  });

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!isCronAuthorized(auth)) return new Response('Unauthorized', { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return new Response(`Bad Request: ${parsed.error.message}`, { status: 400 });
  }
  const body = parsed.data;

  const providers = (
    [
      ...(body.githubLogin ? (['github'] as const) : []),
      ...(body.gitlabUsername ? (['gitlab'] as const) : []),
    ] as Array<'github' | 'gitlab'>
  ).sort();

  const githubToken = env.GITHUB_TOKEN;
  const gitlabToken = env.GITLAB_TOKEN;
  const gitlabBaseUrl = 'https://gitlab.com';

  if (providers.includes('github') && !githubToken) {
    return new Response('Bad Request: github requested but GITHUB_TOKEN not set', { status: 400 });
  }
  if (providers.includes('gitlab') && !gitlabToken) {
    return new Response('Bad Request: gitlab requested but GITLAB_TOKEN not set', { status: 400 });
  }

  const ttlSec = 5 * 60;
  const todayStr = ymd(new Date());

  async function runOnce() {
    const wrote = await refreshUserRollups(
      { db },
      {
        userId: body.userId,
        githubLogin: body.githubLogin,
        gitlabUsername: body.gitlabUsername,
        githubToken,
        gitlabToken,
        gitlabBaseUrl,
      },
    );

    await syncUserLeaderboards(db, body.userId);

    await setUserMetaFromProviders(body.userId, body.githubLogin, body.gitlabUsername);

    return wrote;
  }

  try {
    if (providers.length === 2) {
      const [p1, p2] = providers;
      const k1 = backfillLockKey(p1 as 'github' | 'gitlab', body.userId);
      const k2 = backfillLockKey(p2 as 'github' | 'gitlab', body.userId);

      return await withLock(k1, ttlSec, async () => {
        const got2 = await acquireLock(k2, ttlSec);
        if (!got2) throw new Error(`LOCK_CONFLICT:${p2}`);
        try {
          const out = await runOnce();
          return Response.json({
            ok: true,
            userId: body.userId,
            providers,
            mode: 'rollups',
            snapshotDate: todayStr,
            wrote: out.wrote,
            providerUsed: out.provider,
          });
        } finally {
          await releaseLock(k2);
        }
      });
    }

    const p = providers[0]!;
    const key = backfillLockKey(p, body.userId);

    return await withLock(key, ttlSec, async () => {
      const out = await runOnce();
      return Response.json({
        ok: true,
        userId: body.userId,
        providers,
        mode: 'rollups',
        snapshotDate: todayStr,
        wrote: out.wrote,
        providerUsed: out.provider,
      });
    });
  } catch (err: unknown) {
    const id = Math.random().toString(36).slice(2, 8);
    console.error(`[rollup-backfill:${id}]`, err);
    const msg = String(err instanceof Error ? err.message : err);
    if (msg.startsWith('LOCK_CONFLICT')) {
      const p = msg.split(':')[1] || 'unknown';
      return new Response(`Conflict: backfill already running for ${p}`, { status: 409 });
    }
    return new Response(`Internal Error (ref ${id})`, { status: 500 });
  }
}
