import { createFileRoute } from '@tanstack/react-router';

import SubmissionForm from '@/components/submissions/submission-form';
import { RouteErrorState, RoutePendingState } from '@/components/layout/route-boundaries';
import { requireOwnerAccount } from '@/lib/route-guards';

export const Route = createFileRoute('/dashboard/projects/new')({
  beforeLoad: async () => {
    await requireOwnerAccount();
  },
  component: NewProjectPage,
  pendingComponent: () => <RoutePendingState label="Loading submission form" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Submission form could not load"
      description="Project submission is unavailable right now. Try again from your dashboard."
    />
  ),
});

function NewProjectPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-medium">Submit a project</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Search for your GitHub repository, confirm the suggested fields, then submit it for admin
          review.
        </p>
      </div>
      <SubmissionForm />
    </div>
  );
}
