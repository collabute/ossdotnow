import { Ratelimit } from '@upstash/ratelimit';
import { redis } from "../redis/client";

const ratelimitCache: Record<string, Ratelimit> = {};

export function getRateLimiter(prefix: string): Ratelimit {
  if (!ratelimitCache[prefix]) {
    ratelimitCache[prefix] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(2, '1m'),
      analytics: true,
      prefix: `ratelimit:${prefix}`,
    });
  }
  return ratelimitCache[prefix];
}
