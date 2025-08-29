// apps/web/app/api/leaderboard/export/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { db } from '@workspace/db';

// NEW read helper that uses contribRollups internally
import { getLeaderboardPage } from '@workspace/api/read'; // your refactored reader

// User meta gives us githubLogin / gitlabUsername to tag provider in CSV
import { getUserMetas } from '@workspace/api/use-meta';

// If your contrib_period enum includes 'all_time', flip this to true
const HAS_ALL_TIME = false as const;

const Query = z.object({
  // provider is no longer used, but keep for backward-compat (ignored)
  provider: z.enum(['combined', 'github', 'gitlab']).default('combined'),
  window: z.enum(HAS_ALL_TIME ? (['all', '30d', '365d'] as const) : (['30d', '365d'] as const))
    .default('30d'),
  limit: z.coerce.number().int().min(1).max(2000).default(500),
  cursor: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return new Response(`Bad Request: ${parsed.error.message}`, { status: 400 });
  }
  const { window, limit, cursor } = parsed.data;

  // Guard: 'all' not supported unless you added all_time snapshots
  if (window === 'all' && !HAS_ALL_TIME) {
    return new Response(`Bad Request: 'all' window not supported by current schema`, { status: 400 });
  }

  // Page through leaderboard to collect up to `limit` rows
  let entries: Array<{ userId: string; score: number }> = [];
  let next = cursor;

  while (entries.length < limit) {
    const page = await getLeaderboardPage(db, {
      window: window === 'all' ? ('365d' as '30d' | '365d') : window, // 'all' would be supported only if HAS_ALL_TIME=true in reader too
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

  // Build CSV; since each user has one provider, put score into the correct column
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

    // allocate score to provider column based on meta
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
