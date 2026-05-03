import { createFileRoute, redirect } from '@tanstack/react-router';
import { BriefcaseBusiness, Code2, HandCoins, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { PoweredByNeon } from '@/components/layout/powered-by-neon';
import { RouteErrorState, RoutePendingState } from '@/components/layout/route-boundaries';
import { SiteHeader } from '@/components/layout/site-header';
import { Button } from '@/components/ui/button';
import { useTRPC } from '@/hooks/use-trpc';
import { getSession } from '@/lib/session';

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async () => {
    const session = await getSession();

    if (!session?.user?.id) {
      throw redirect({ to: '/login' });
    }

    if (session.user.accountType) {
      throw redirect({ to: '/dashboard' });
    }

    return { user: session.user };
  },
  component: OnboardingPage,
  pendingComponent: () => <RoutePendingState label="Loading onboarding" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Onboarding could not load"
      description="Account setup is unavailable right now. Try again from the dashboard."
    />
  ),
});

const accountTypeOptions = [
  {
    value: 'owner',
    title: 'Project Owner',
    description: 'Submit and manage open source projects for review.',
    icon: BriefcaseBusiness,
  },
  {
    value: 'contributor',
    title: 'Contributor',
    description: 'Find projects that need code, docs, design, or community help.',
    icon: Code2,
  },
  {
    value: 'investor',
    title: 'Investor',
    description: 'Discover approved projects looking for growth and capital.',
    icon: HandCoins,
  },
] as const;

function OnboardingPage() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();

  const { mutate, isPending, variables } = useMutation(
    trpc.user.updateAccountType.mutationOptions({
      onSuccess: async () => {
        toast.success('Account type saved');
        await navigate({ to: '/dashboard' });
      },
      onError: (error) => {
        toast.error(error.message || 'Could not save account type');
      },
    }),
  );

  return (
    <main>
      <SiteHeader />
      <section className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-5xl flex-col justify-center gap-10 px-6 py-12">
        <div className="max-w-2xl space-y-4">
          <p className="text-muted-foreground text-sm">Signed in as {user.email}</p>
          <h1 className="text-3xl font-medium sm:text-5xl">Choose your account type</h1>
          <p className="text-muted-foreground text-balance text-base sm:text-lg">
            This controls your dashboard experience. Admin permissions stay separate from this
            selection.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {accountTypeOptions.map((option) => {
            const Icon = option.icon;
            const isActiveMutation = variables?.accountType === option.value;

            return (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                className="border-border flex h-full min-h-56 w-full min-w-0 flex-col items-start justify-between gap-8 overflow-hidden whitespace-normal rounded-none p-5 text-left"
                disabled={isPending}
                onClick={() => mutate({ accountType: option.value })}
              >
                <span className="flex min-w-0 flex-col items-start gap-4">
                  <Icon className="h-6 w-6" />
                  <span className="block max-w-full text-xl font-medium text-white">
                    {option.title}
                  </span>
                  <span className="text-muted-foreground block max-w-full text-wrap break-words text-sm leading-6">
                    {option.description}
                  </span>
                </span>
                <span className="text-sm font-medium">
                  {isPending && isActiveMutation ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving
                    </span>
                  ) : (
                    'Select'
                  )}
                </span>
              </Button>
            );
          })}
        </div>
      </section>
      <PoweredByNeon />
    </main>
  );
}
