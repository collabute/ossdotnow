import { createFileRoute } from '@tanstack/react-router';

import { RouteErrorState, RoutePendingState } from '@/components/layout/route-boundaries';
import { SiteHeader } from '@/components/layout/site-header';
import { Profile } from '@/components/user/profile';
import { requireOnboarded } from '@/lib/route-guards';

export const Route = createFileRoute('/profile')({
  beforeLoad: async () => {
    await requireOnboarded();
  },
  component: ProfilePage,
  pendingComponent: () => <RoutePendingState label="Loading profile" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Profile could not load"
      description="Your profile is unavailable right now. Try again from the dashboard."
    />
  ),
});

function ProfilePage() {
  return (
    <main className="px-6">
      <SiteHeader />
      <Profile />
    </main>
  );
}
