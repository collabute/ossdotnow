export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getUserMetas } from '@workspace/api/leaderboard/use-meta';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const Body = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(200),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return new Response(`Bad Request: ${parsed.error.message}`, { status: 400 });
  }
  const { userIds } = parsed.data;
  const entries = await getUserMetas(userIds);
  return Response.json({ ok: true, entries });
}
