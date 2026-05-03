import { Outlet, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { PoweredByNeon } from '@/components/layout/powered-by-neon';
import { RouteErrorState, RoutePendingState } from '@/components/layout/route-boundaries';
import { SiteHeader } from '@/components/layout/site-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Icons from '@/components/ui/icons';
import Link from '@/components/ui/link';
import { authClient } from '@/lib/auth-client';
import { useTRPC } from '@/hooks/use-trpc';
import { requireOnboarded } from '@/lib/route-guards';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const session = await requireOnboarded();

    return { user: session.user };
  },
  component: DashboardLayout,
  pendingComponent: () => <RoutePendingState label="Loading dashboard" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Dashboard could not load"
      description="Your dashboard is unavailable right now. Try again or return to project discovery."
    />
  ),
});

function DashboardLayout() {
  const { user } = Route.useRouteContext();
  const isOwner = user.accountType === 'owner';
  const hasGitHub = user.connectedProviders?.includes('github') ?? false;

  return (
    <main>
      <SiteHeader />
      <section className="mx-auto min-h-[calc(100vh-80px)] w-full max-w-6xl space-y-8 px-6 py-8">
        <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">{user.accountType} dashboard</p>
            <h1 className="text-3xl font-medium">Dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-none" asChild>
              <Link href="/dashboard">Overview</Link>
            </Button>
            {isOwner && (
              <>
                <Button variant="outline" className="rounded-none" asChild>
                  <Link href="/dashboard/projects">My Projects</Link>
                </Button>
              </>
            )}
            <Button variant="outline" className="rounded-none" asChild>
              <Link href="/projects">Discover</Link>
            </Button>
            <Button variant="outline" className="rounded-none" asChild>
              <Link href="/dashboard/notifications">Notifications</Link>
            </Button>
          </div>
        </div>
        {!hasGitHub && <ConnectGitHubAlert />}
        <Outlet />
      </section>
      <PoweredByNeon />
    </main>
  );
}

function ConnectGitHubAlert() {
  const trpc = useTRPC();
  const [isConnecting, setIsConnecting] = useState(false);
  const { data: providerStatus } = useQuery(trpc.system.providerStatus.queryOptions());
  const isGitHubConfigured = providerStatus?.github.oauthConfigured ?? true;

  async function connectGitHub() {
    if (!isGitHubConfigured) {
      toast.error('GitHub OAuth is not configured for this environment.');
      return;
    }

    setIsConnecting(true);
    const callbackURL = typeof window === 'undefined' ? '/dashboard' : window.location.href;
    const { error } = await authClient.linkSocial({
      provider: 'github',
      callbackURL,
      errorCallbackURL: callbackURL,
    });

    if (error) {
      toast.error(error.message || 'Could not connect GitHub');
      setIsConnecting(false);
    }
  }

  return (
    <Alert className="flex items-center justify-between gap-4 rounded-none bg-transparent">
      <div className="flex min-w-0 items-center gap-3">
        <Icons.github className="h-5 w-5 shrink-0 fill-current" />
        <p className="truncate text-lg font-medium">
          {isGitHubConfigured
            ? 'GitHub is required for repository ownership'
            : 'GitHub OAuth is not configured in this environment'}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="shrink-0 rounded-none"
        disabled={isConnecting || !isGitHubConfigured}
        onClick={connectGitHub}
      >
        {isConnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icons.github className="h-4 w-4 fill-current" />
        )}
        Connect GitHub
      </Button>
    </Alert>
  );
}
