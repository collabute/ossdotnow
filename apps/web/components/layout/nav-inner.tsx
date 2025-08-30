'use client';

import SubmissionDialog from '../submissions/submission-dialog';
import { Button } from '@workspace/ui/components/button';
import Icons from '@workspace/ui/components/icons';
import Link from '@workspace/ui/components/link';
import { cn } from '@workspace/ui/lib/utils';
import { navItems } from '@/lib/nav-items';
import { MobileNav } from './mobile-nav';
import PublicNav from './public-nav';
import { ScheduledLaunchesModal } from './scheduled-launches-dropdown';
import { NotificationsDropdown } from './notifications-dropdown';
import UserNav from './user-nav';
import { useState } from 'react';

// TODO: fix this
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function NavInner({ session }: { session: any }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn('sticky top-8 z-50 mx-6 transition-all duration-100', {
        'top-0 mx-0 border-none': open,
      })}
    >
      <header
        className={cn('max-w-[1080px] border border-[#404040] bg-neutral-900 md:mx-auto', {
          'border-none': open,
        })}
      >
        <div
          className={cn(
            'mx-auto flex h-16 items-center justify-between px-4 transition-all duration-100',
            {
              'px-6': open,
            },
          )}
        >
          <div className="flex items-center gap-2">
            <MobileNav items={navItems} className="md:hidden" open={open} setOpen={setOpen} />
            <Link href="/" className="flex items-center gap-2" event="home_nav_click">
              <Icons.logo className="size-6 sm:size-7" />
              <span className="hidden text-xl font-medium text-white sm:inline">oss.now</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-2 md:flex">
              <PublicNav session={session} />
            </nav>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            {session?.user.id ? (
              <>
                <ScheduledLaunchesModal />
                <NotificationsDropdown />
                <UserNav />
              </>
            ) : (
              <Button
                className="rounded-none border border-neutral-800 bg-transparent px-4 py-2 text-sm text-white hover:border-neutral-700 hover:bg-neutral-900"
                asChild
              >
                <Link href="/login" event="login_nav_click">
                  Login
                </Link>
              </Button>
            )}
            <SubmissionDialog />
          </div>
        </div>
      </header>
    </div>
  );
}
