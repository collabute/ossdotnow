import { redis } from './client';

export async function acquireLock(key: string, ttlSec = 60): Promise<string | null> {
  const token = Math.random().toString(36).slice(2);
  const ok = await redis.set(key, token, { nx: true, ex: ttlSec });
  return ok === 'OK' ? token : null;
}

export async function releaseLock(key: string, token: string): Promise<void> {
  try {
    await redis.eval(
      'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
      [key],
      [token],
    );
  } catch {
    //ignore
  }
}

export async function withLock<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const token = await acquireLock(key, ttlSec);
  if (!token) throw new Error('LOCK_CONFLICT');
  try {
    return await fn();
  } finally {
    await releaseLock(key, token);
  }
}

export function dailyLockKey(provider: 'github' | 'gitlab', userId: string, yyyymmdd: string) {
  return `lock:daily:${provider}:${userId}:${yyyymmdd}`;
}

export function backfillLockKey(provider: 'github' | 'gitlab', userId: string) {
  return `lock:backfill:${provider}:${userId}`;
}
