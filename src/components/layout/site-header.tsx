'use client';

import PublicNav from '@/components/layout/public-nav';
import UserNav from '@/components/layout/user-nav';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Button } from '@/components/ui/button';
import Icons from '@/components/ui/icons';
import Link from '@/components/ui/link';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

export function SiteHeader() {
  const { data: session } = authClient.useSession();

  return (
    <header className="bg-background sticky top-0 z-50 w-full">
      <div className={cn('mx-auto flex h-20 items-center justify-between gap-3 px-4 sm:px-8')}>
        <Link href="/" className="flex min-w-0 items-center gap-3" event="home_nav_click">
          <Icons.logo className="size-6 sm:size-8" />
          <span className="hidden text-lg font-medium sm:inline sm:text-2xl">oss.now</span>
        </Link>

        <nav className="flex min-w-0 items-center gap-1 sm:gap-2">
          <PublicNav />
          {session?.user.id ? (
            <>
              <Button className="ml-1 rounded-none px-2 sm:ml-2 sm:px-4" variant="outline" asChild>
                <Link href="/dashboard" event="dashboard_nav_click">
                  Dashboard
                </Link>
              </Button>
              <NotificationBell />
              <UserNav />
            </>
          ) : (
            <Button className="ml-1 rounded-none px-3 sm:ml-2 sm:px-4" asChild>
              <Link href="/login" event="login_nav_click">
                Login
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
