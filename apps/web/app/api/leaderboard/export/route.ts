export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest } from 'next/server';
import { db } from '@workspace/db';
import { z } from 'zod/v4';

import { getLeaderboardPage } from '@workspace/api/read';
import { getUserMetas } from '@workspace/api/use-meta';

const Query = z.object({
  provider: z.enum(['combined', 'github', 'gitlab']).default('combined'),
  window: z.enum(['30d', '365d']).default('30d'),
  limit: z.coerce.number().int().min(1).max(2000).default(500),
  cursor: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return new Response(`Bad Request: ${parsed.error.message}`, { status: 400 });
  }
  const { window, limit, cursor } = parsed.data;

  let entries: Array<{ userId: string; score: number }> = [];
  let next = cursor;

  while (entries.length < limit) {
    const page = await getLeaderboardPage(db, {
      window,
      limit: Math.min(200, limit - entries.length),
      cursor: next,
    });
    entries.push(...page.entries);
    if (page.nextCursor == null) break;
    next = page.nextCursor;
  }
  entries = entries.slice(0, limit);

  const userIds = entries.map((e) => e.userId);
  const metas = await getUserMetas(userIds);
  const metaMap = new Map(metas.map((m) => [m.userId, m]));

  const header = [
    'rank',
    'userId',
    'username',
    'githubLogin',
    'gitlabUsername',
    'total',
    'github',
    'gitlab',
  ];
  const lines = [header.join(',')];

  entries.forEach((e, idx) => {
    const rank = cursor + idx + 1;
    const m = metaMap.get(e.userId);

    const hasGithub = !!(m?.githubLogin && String(m.githubLogin).trim());
    const hasGitlab = !!(m?.gitlabUsername && String(m.gitlabUsername).trim());

    const githubScore = hasGithub ? e.score : 0;
    const gitlabScore = hasGitlab ? e.score : 0;

    const row = [
      rank,
      e.userId,
      m?.username ?? '',
      m?.githubLogin ?? '',
      m?.gitlabUsername ?? '',
      e.score,
      githubScore,
      gitlabScore,
    ]
      .map((v) => (typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v)))
      .join(',');

    lines.push(row);
  });

  const csv = lines.join('\n');
  const filename = `leaderboard_combined_${window}_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
