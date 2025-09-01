import { env } from './server';

export function isCronAuthorized(headerValue: string | null | undefined) {
  if (!headerValue) return false;
  const token = headerValue.startsWith('Bearer ')
    ? headerValue.slice('Bearer '.length).trim()
    : headerValue.trim();
  return token.length > 0 && token === env.CRON_SECRET;
}
