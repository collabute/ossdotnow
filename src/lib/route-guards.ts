import { redirect } from '@tanstack/react-router';

import { getSession } from '@/lib/session';

export async function requireAuth() {
  const session = await getSession();

  if (!session?.user?.id) {
    throw redirect({ to: '/login' });
  }

  return session;
}

export async function requireOnboarded() {
  const session = await requireAuth();

  if (!session.user.accountType) {
    throw redirect({ to: '/onboarding' });
  }

  return session;
}

export async function requireOwnerAccount() {
  const session = await requireOnboarded();

  if (session.user.accountType !== 'owner') {
    throw redirect({ to: '/dashboard' });
  }

  return session;
}
