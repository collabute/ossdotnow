// packages/api/src/leaderboard/meta.ts
import { syncUserLeaderboards } from './redis';
import { redis } from '../redis/client';

export type UserMetaInput = {
  username?: string | null;
  avatar?: string | null;
  githubLogin?: string | null;
  gitlabUsername?: string | null;
};

export async function setUserMeta(
  userId: string,
  meta: UserMetaInput,
  opts: { seedLeaderboards?: boolean } = { seedLeaderboards: true },
): Promise<void> {
  const updates: Record<string, string> = {};
  const put = (k: string, v?: string | null) => {
    if (v && v.trim()) updates[k] = v.trim();
  };

  // display fields
  put('username', meta.username);
  // write the avatar to multiple keys so any reader finds it
  put('avatar', meta.avatar);
  put('image', meta.avatar);
  put('avatarUrl', meta.avatar);
  put('imageUrl', meta.avatar);

  // provider handles
  put('githubLogin', meta.githubLogin);
  put('gitlabUsername', meta.gitlabUsername);

  if (Object.keys(updates).length > 0) {
    await redis.hset(`lb:user:${userId}`, updates);
  }
  await redis.sadd('lb:users', userId);

  if (opts.seedLeaderboards) {
    const { db } = await import('@workspace/db');
    await syncUserLeaderboards(db, userId);
  }
}
