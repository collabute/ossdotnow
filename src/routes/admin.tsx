import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from '@/components/ui/breadcrumb';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { Outlet, createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { getSession } from '@/lib/session';
import {
  RouteErrorState,
  RouteNotFoundState,
  RoutePendingState,
} from '@/components/layout/route-boundaries';

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const session = await getSession();

    if (!session?.user) {
      throw redirect({ to: '/login' });
    }

    if (session.user.role !== 'admin') {
      throw notFound();
    }

    return { user: session.user };
  },
  component: AdminLayout,
  notFoundComponent: () => (
    <RouteNotFoundState
      title="Admin area unavailable"
      description="This area is only available to administrators."
    />
  ),
  pendingComponent: () => <RoutePendingState label="Loading admin" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Admin could not load"
      description="Admin operations are unavailable right now. Try again from the dashboard."
    />
  ),
});

function AdminLayout() {
  const { user } = Route.useRouteContext();

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/admin">Admin Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
