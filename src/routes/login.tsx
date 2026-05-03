import { createFileRoute, redirect } from '@tanstack/react-router';

import { LoginForm } from '@/components/auth/login-form';
import type { AuthMode } from '@/components/auth/login-form';
import { RouteErrorState, RoutePendingState } from '@/components/layout/route-boundaries';
import { SiteHeader } from '@/components/layout/site-header';
import Icons from '@/components/ui/icons';
import { getSession } from '@/lib/session';

const authModes = new Set<AuthMode>([
  'sign-in',
  'sign-up',
  'forgot-password',
  'reset-password',
  'verification-sent',
]);

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => {
    const mode = typeof search.mode === 'string' && authModes.has(search.mode as AuthMode)
      ? (search.mode as AuthMode)
      : 'sign-in';
    const nextSearch: {
      mode?: AuthMode;
      token?: string;
      error?: string;
    } = {};

    if (mode !== 'sign-in') {
      nextSearch.mode = mode;
    }

    if (typeof search.token === 'string') {
      nextSearch.token = search.token;
    }

    if (typeof search.error === 'string') {
      nextSearch.error = search.error;
    }

    return nextSearch;
  },
  beforeLoad: async () => {
    const session = await getSession();

    if (session?.user.id) {
      throw redirect({ to: session.user.accountType ? '/dashboard' : '/onboarding' });
    }
  },
  component: LoginPage,
  pendingComponent: () => <RoutePendingState label="Loading login" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Login could not load"
      description="Authentication is unavailable right now. Try again in a moment."
    />
  ),
});

function LoginPage() {
  const { mode = 'sign-in', token, error } = Route.useSearch();

  return (
    <main>
      <SiteHeader />
      <div className="relative h-[calc(100vh-80px)] w-full">
        <div className="absolute top-0 right-0 bottom-0 z-0 flex aspect-square w-full items-center justify-end bg-transparent mix-blend-screen md:w-[1000px]">
          <img
            src="/login-background.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 h-full object-cover object-right opacity-20 mix-blend-screen"
          />
        </div>
        <div className="bottom-0mx-auto absolute top-0 left-0 flex aspect-square h-full w-full max-w-5xl flex-row items-center justify-center gap-8 text-center">
          <div className="flex flex-col items-center justify-center gap-8">
            <Icons.logo className="mb-10 size-20" />
            <LoginForm
              key={`${mode}-${token ?? ''}-${error ?? ''}`}
              className="min-w-sm"
              redirectUrl="/onboarding"
              initialMode={mode}
              resetToken={token}
              routeError={error}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
