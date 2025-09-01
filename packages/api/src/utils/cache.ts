import { redis } from "../redis/client";

interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

const DEFAULT_TTL = 60 * 60;
const CACHE_PREFIX = 'api:cache:';

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const { ttl = DEFAULT_TTL, prefix = CACHE_PREFIX } = options;
  const cacheKey = `${prefix}${key}`;

  try {
    const cached = await redis.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  } catch (error) {
    console.error('Cache read error:', error);
  }

  const data = await fetcher();

  try {
    await redis.set(cacheKey, data, {
      ex: ttl,
    });
  } catch (error) {
    console.error('Cache write error:', error);
  }

  return data;
}

export async function invalidateCache(pattern: string): Promise<void> {
  if (!pattern || typeof pattern !== 'string') {
    throw new Error('Pattern must be a non-empty string');
  }
  try {
    const fullPattern = `${CACHE_PREFIX}${pattern}*`;

    let cursor = '0';
    do {
      const result = await redis.scan(cursor, { match: fullPattern, count: 100 });
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (error) {
    console.error('Cache invalidation error:', { pattern, error });
  }
}

export function createCacheKey(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}
