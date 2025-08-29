import { redis } from './client';

export async function acquireLock(key: string, ttlSec = 60): Promise<boolean> {
  const ok = await redis.set(key, '1', { nx: true, ex: ttlSec });
  return ok === 'OK';
}

export async function releaseLock(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    //ignore
  }
}

export async function withLock<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const got = await acquireLock(key, ttlSec);
  if (!got) throw new Error('LOCK_CONFLICT'); // normalized
  try {
    return await fn();
  } finally {
    await releaseLock(key);
  }
}

export function dailyLockKey(provider: 'github' | 'gitlab', userId: string, yyyymmdd: string) {
  return `lock:daily:${provider}:${userId}:${yyyymmdd}`;
}

export function backfillLockKey(provider: 'github' | 'gitlab', userId: string) {
  return `lock:backfill:${provider}:${userId}`;
}
