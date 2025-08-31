export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { auth } from '@workspace/auth/server';
import { env } from '@workspace/env/server';
import { NextRequest } from 'next/server';
import { z } from 'zod/v4';

const Body = z.object({
  users: z
    .array(
      z
        .object({
          userId: z.string().min(1),
          githubLogin: z.string().min(1).optional(),
          gitlabUsername: z.string().min(1).optional(),
        })
        .refine((u) => !!(u.githubLogin || u.gitlabUsername), {
          message: 'At least one of githubLogin or gitlabUsername is required',
        }),
    )
    .min(1)
    .max(200),
  days: z.number().int().min(1).max(365).default(365),
  concurrency: z.number().int().min(1).max(8).default(4),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
  const role = session?.user?.role as string | undefined;
  if (!session || !role || !['admin', 'moderator'].includes(role)) {
    return new Response('Forbidden', { status: 403 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return new Response(`Bad Request: ${parsed.error.message}`, { status: 400 });
  }

  const { users, concurrency } = parsed.data;
  const limit = Math.max(1, Math.min(concurrency, 8));
  const origin = env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000';

  const url = new URL('/api/internal/leaderboard/backfill', origin).toString();

  let i = 0,
    ok = 0,
    fail = 0;
  const results: Array<{ userId: string; status: number }> = [];

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= users.length) return;
      const u = users[idx]!;
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${env.CRON_SECRET}`,
          },
          body: JSON.stringify({
            userId: u.userId,
            githubLogin: u.githubLogin,
            gitlabUsername: u.gitlabUsername,
          }),
        });
        results.push({ userId: u.userId, status: r.status });
        if (r.ok || r.status === 409) ok++;
        else fail++;
      } catch {
        results.push({ userId: u.userId, status: 0 });
        fail++;
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return Response.json({ ok: fail === 0, summary: { ok, fail, total: users.length }, results });
}
