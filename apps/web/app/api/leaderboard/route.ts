export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { getLeaderboardPage } from "@workspace/api/read";

const HAS_ALL_TIME = false as const;

const Query = z.object({
  window: z.enum(HAS_ALL_TIME ? (["all", "30d", "365d"] as const) : (["30d", "365d"] as const))
    .default("30d"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.coerce.number().int().min(0).optional(),
});

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return new Response(`Bad Request: ${parsed.error.message}`, { status: 400 });
  }
  const q = parsed.data;

  if (q.window === "all" && !HAS_ALL_TIME) {
    return new Response(`Bad Request: 'all' window not supported by current schema`, { status: 400 });
  }

  // If you add 'all' later, ensure your reader also supports it.
  const windowForReader = q.window === "all" ? ("365d" as "30d" | "365d") : q.window;

  const { entries, nextCursor, source } = await getLeaderboardPage(db, {
    window: windowForReader, // '30d' | '365d' (or 'all' if you implement it)
    limit: q.limit,
    cursor: q.cursor,
  });

  return Response.json({
    ok: true,
    window: q.window,
    limit: q.limit,
    cursor: q.cursor ?? 0,
    nextCursor,
    source,
    entries,
  });
}
