'use client';

import { ScheduledLaunchesModal } from './scheduled-launches-dropdown';
import { NotificationsDropdown } from './notifications-dropdown';
import SubmissionDialog from '../submissions/submission-dialog';
import { Button } from '@workspace/ui/components/button';
import Link from '@workspace/ui/components/link';
import { usePathname } from 'next/navigation';
import { cn } from '@workspace/ui/lib/utils';
import { navItems } from '@/lib/nav-items';
import UserNav from './user-nav';
import React from 'react';

// TODO: fix this
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function PublicNav({ session }: { session: any }) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <>
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
        {navItems.map((item) => (
          <React.Fragment key={item.href}>
            <Button
              variant="ghost"
              render={(props) => (
                <Link
                  {...props}
                  href={item.href}
                  event={`${item.label.toLowerCase()}_nav_click`}
                  className={cn(
                    'text-muted-foreground rounded-none p-2 text-sm hover:bg-neutral-900',
                    isActive(item.href) && 'text-primary bg-neutral-900',
                  )}
                >
                  {item.label}
                </Link>
              )}
            />
          </React.Fragment>
        ))}
      </div>
      {session?.user.id ? (
        <>
          <ScheduledLaunchesModal />
          <NotificationsDropdown />
          <UserNav />
        </>
      ) : (
        <Button
          className="rounded-none border border-neutral-800 bg-transparent px-4 py-2 text-sm text-white hover:border-neutral-700 hover:bg-neutral-900"
          render={(props) => (
            <Link href="/login" event="login_nav_click" {...props}>
              Login
            </Link>
          )}
        />
      )}
      <SubmissionDialog />
    </>
  );
}
