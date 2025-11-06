import { Button } from '@workspace/ui/components/button';
import Icons from '@workspace/ui/components/icons';
import Link from '@workspace/ui/components/link';
import { auth } from '@workspace/auth/server';
import { cn } from '@workspace/ui/lib/utils';
import { env } from '@workspace/env/server';
import { headers } from 'next/headers';
import PublicNav from './public-nav';
import UserNav from './user-nav';
import TempNav from './temp-nav';

export async function SiteHeader() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <header className="bg-background sticky top-0 z-50 w-full">
      <div className={cn('mx-auto flex h-20 items-center justify-between px-4 sm:px-8')}>
        <Link href="/" className="flex items-center gap-4" event="home_nav_click">
          <Icons.logo className="size-6 sm:size-8" />
          <span className="text-lg font-medium sm:text-2xl">oss.now</span>
        </Link>
        {/* <nav className="flex items-center gap-1 sm:gap-2">
          {env.NODE_ENV === 'production' ? <TempNav /> : <PublicNav />}
          {session?.user.id ? (
            <UserNav />
          ) : env.NODE_ENV !== 'production' ? (
            <Button className="ml-2 rounded-none" asChild>
              <Link href="/login" event="login_nav_click">
                Login
              </Link>
            </Button>
          ) : null}
        </nav> */}
      </div>
    </header>
  );
}
