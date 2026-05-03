'use client';

import Link from '@/components/ui/link';
import { useRouterState } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

export default function PublicNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <>
      <Link
        href="/roadmap"
        event="roadmap_nav_click"
        className={cn(
          'text-muted-foreground hidden whitespace-nowrap p-2 text-sm hover:bg-neutral-900 md:inline-flex',
          isActive('/roadmap') && 'text-primary bg-neutral-900',
        )}
      >
        roadmap
      </Link>
      <Link
        href="/projects"
        event="projects_nav_click"
        className={cn(
          'text-muted-foreground inline-flex whitespace-nowrap p-2 text-sm hover:bg-neutral-900',
          isActive('/projects') && 'text-primary bg-neutral-900',
        )}
      >
        projects
      </Link>
    </>
  );
}
