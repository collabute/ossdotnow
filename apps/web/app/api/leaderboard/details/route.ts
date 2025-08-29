
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { and, eq, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { z } from 'zod/v4';

import { contribRollups } from '@workspace/db/schema';
import { db } from '@workspace/db';

const HAS_ALL_TIME = false as const;

type WindowKey = '30d' | '365d' | 'all';

// request body
const Body = z.object({
  window: z.enum(HAS_ALL_TIME ? (['all', '30d', '365d'] as const) : (['30d', '365d'] as const)),
  userIds: z.array(z.string().min(1)).max(2000),
});

// map window -> DB period
const PERIOD_FROM_WINDOW: Record<'30d' | '365d', 'last_30d' | 'last_365d'> = {
  '30d': 'last_30d',
  '365d': 'last_365d',
};

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return new Response(`Bad Request: ${parsed.error.message}`, { status: 400 });
  }

  const { window, userIds } = parsed.data as { window: WindowKey; userIds: string[] };
  if (userIds.length === 0) {
    return Response.json({ ok: true, window, entries: [] });
  }

  // guard if 'all' requested but enum not supported in DB
  if (window === 'all' && !HAS_ALL_TIME) {
    return new Response(`Bad Request: 'all' window not supported by current schema`, {
      status: 400,
    });
  }

  try {
    // Build WHERE by window/period
    const where = and(
      inArray(contribRollups.userId, userIds),
      window === 'all'
        ? eq(contribRollups.period, 'all_time')
        : eq(contribRollups.period, PERIOD_FROM_WINDOW[window]),
    );

    // Fetch snapshot rows
    const rows = await db
      .select({
        userId: contribRollups.userId,
        commits: contribRollups.commits,
        prs: contribRollups.prs,
        issues: contribRollups.issues,
        total: contribRollups.total,
      })
      .from(contribRollups)
      .where(where);

    // Index by userId for quick lookup
    const byId = new Map(
      rows.map((r) => [
        r.userId,
        {
          commits: Number(r.commits ?? 0),
          prs: Number(r.prs ?? 0),
          issues: Number(r.issues ?? 0),
          total: Number(r.total ?? 0),
        },
      ]),
    );

    // Preserve requested order and fill zeros for missing
    const entries = userIds.map((id) => {
      const v = byId.get(id) ?? { commits: 0, prs: 0, issues: 0, total: 0 };
      return { userId: id, ...v };
    });

    return Response.json({ ok: true, window, entries });
  } catch (err: unknown) {
    const msg = String(err instanceof Error ? err.message : err);
    console.error('[leaderboard/details]', err);
    return new Response(`Internal Error: ${msg}`, { status: 500 });
  }
}
