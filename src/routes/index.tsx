'use client';

import { createFileRoute } from '@tanstack/react-router';
import { ArrowRight, Plus } from 'lucide-react';

import GitAvatars from '@/components/git-avatars';
import { PoweredByNeon } from '@/components/layout/powered-by-neon';
import { SiteHeader } from '@/components/layout/site-header';
import { Logos } from '@/components/logos';
import { Button } from '@/components/ui/button';
import Link from '@/components/ui/link';
import { authClient } from '@/lib/auth-client';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <main>
      <SiteHeader />
      <div className="flex min-h-[calc(100vh-80px)] overflow-hidden p-6 md:min-h-[calc(100vh-80px)]">
        <img
          src="/home-background.png"
          alt=""
          aria-hidden="true"
          width={960}
          height={860}
          className="pointer-events-none absolute left-0 right-0 top-0 z-0 h-full w-full object-cover object-right-bottom opacity-70 mix-blend-screen"
        />

        <div className="relative z-10 mx-auto flex w-full flex-col items-center justify-center gap-8 overflow-hidden text-center">
          <div className="z-10 flex w-full max-w-lg flex-col items-center gap-12">
            <h1 className="z-10 text-4xl font-medium tracking-[-0.04em] sm:text-7xl">
              Open source it, <br /> right now.
            </h1>
            <p className="z-10 mx-auto text-balance text-center text-[#9f9f9f] sm:text-lg">
              A live platform for open source project discovery, collaboration, and growth -
              connecting project owners with contributors and investors.
            </p>

            <div className="flex flex-col items-center gap-6">
              <HomeActions />
              <div>
                <GitAvatars />
              </div>
            </div>
          </div>
          <Logos />
        </div>
      </div>
      <PoweredByNeon />
    </main>
  );
}

function HomeActions() {
  const { data: session } = authClient.useSession();
  const secondaryHref = session?.user.id ? '/dashboard' : '/login';
  const secondaryLabel = session?.user.id ? 'Open Dashboard' : 'Create Account';

  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
      <Button className="mx-auto flex w-full items-center gap-2 rounded-none sm:w-auto" asChild>
        <Link href="/projects" event="browse_projects_hero_click">
          <span>Browse Projects</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
      <Button
        variant="outline"
        className="mx-auto flex w-full items-center gap-2 rounded-none sm:w-auto"
        asChild
      >
        <Link href={secondaryHref} event="home_secondary_cta_click">
          <Plus className="h-4 w-4" />
          <span>{secondaryLabel}</span>
        </Link>
      </Button>
    </div>
  );
}
