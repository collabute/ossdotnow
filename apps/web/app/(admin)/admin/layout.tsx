import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from '@workspace/ui/components/breadcrumb';
import { SidebarInset, SidebarProvider } from '@workspace/ui/components/sidebar';
import { AppSidebar } from '@workspace/ui/components/app-sidebar';
import { Button } from '@workspace/ui/components/button';
import { notFound, redirect } from 'next/navigation';
import Link from '@workspace/ui/components/link';
import { auth } from '@workspace/auth/server';
import { headers } from 'next/headers';
import { Home } from 'lucide-react';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const { user } = session ?? {};

  if (!user) {
    redirect('/login');
  }

  const isAdminOrModerator = user.role === 'admin' || user.role === 'moderator';

  if (!isAdminOrModerator) {
    notFound();
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex w-full items-center justify-between px-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/admin">Admin Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Button
              variant="outline"
              size="sm"
              render={(props) => (
                <Link href="/" {...props}>
                  <Home className="mr-2 h-4 w-4" />
                  Home
                </Link>
              )}
            />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
