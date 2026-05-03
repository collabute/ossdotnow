import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import { env } from './env';

const getRequestCookie = createIsomorphicFn()
  .server(() => getRequest().headers.get('cookie'))
  .client(() => null);

export interface AuthSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
    accountType?: 'owner' | 'contributor' | 'investor' | null;
    connectedProviders?: string[];
  };
  session: {
    id: string;
    userId: string;
    expiresAt: string | Date;
  };
}

export async function getSession() {
  const headers = new Headers({
    Accept: 'application/json',
  });

  const cookie = getRequestCookie();

  if (cookie) {
    headers.set('cookie', cookie);
  }

  const response = await fetch(`${env.VITE_API_BASE_URL}/api/session`, {
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as AuthSession | null;
}
