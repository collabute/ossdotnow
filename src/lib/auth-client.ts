import { createAuthClient } from 'better-auth/react';

import { env } from './env';

export const authClient = createAuthClient({
  baseURL: env.VITE_API_BASE_URL,
  fetchOptions: {
    credentials: 'include',
  },
});
