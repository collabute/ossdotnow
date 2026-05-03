import { createFileRoute } from '@tanstack/react-router';

import { PoweredByNeon } from '@/components/layout/powered-by-neon';
import {
  RouteErrorState,
  RouteNotFoundState,
  RoutePendingState,
} from '@/components/layout/route-boundaries';
import { SiteHeader } from '@/components/layout/site-header';
import ProjectPage from '@/components/projects/project-page';

export const Route = createFileRoute('/projects/$id')({
  component: ProjectRoute,
  notFoundComponent: () => (
    <RouteNotFoundState
      title="Project not found"
      description="This project does not exist, is private, or is still waiting for approval."
    />
  ),
  pendingComponent: () => <RoutePendingState label="Loading project" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Project could not load"
      description="This project page is unavailable right now. Try again or browse approved projects."
    />
  ),
});

function ProjectRoute() {
  const { id } = Route.useParams();

  return (
    <main>
      <SiteHeader />
      <ProjectPage id={id} />
      <PoweredByNeon />
    </main>
  );
}
