export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { auth } from '@workspace/auth/server';
import { NextRequest } from 'next/server';
import { db } from '@workspace/db';

import { syncUserLeaderboards } from '@workspace/api/leaderboard/redis';
import { setUserMeta } from '@workspace/api/leaderboard/meta';

export async function POST(req: NextRequest) {
  const sess = await auth.api.getSession({ headers: req.headers }).catch(() => null);
  const user = sess?.user;
  if (!user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const guessGithub =
    typeof user.username === 'string' && user.username ? user.username : undefined;

  await setUserMeta(user.id, { githubLogin: guessGithub }, { seedLeaderboards: false });
  await syncUserLeaderboards(db, user.id);

  return Response.json({ ok: true });
}
