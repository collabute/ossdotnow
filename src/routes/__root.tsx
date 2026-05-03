import { Analytics } from '@vercel/analytics/react';
import { Databuddy } from '@databuddy/sdk';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { Toaster } from 'sonner';

import { Providers } from '@/components/providers';
import { RouteErrorState, RouteNotFoundState } from '@/components/layout/route-boundaries';
import { env } from '@/lib/env';
import appCss from '@/styles/globals.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        title: 'oss now | open source discovery and collaboration',
      },
      {
        name: 'description',
        content:
          'A platform for open source project discovery, collaboration, and growth - connecting project owners with contributors.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/icon.svg' },
    ],
  }),
  component: RootLayout,
  notFoundComponent: () => <RouteNotFoundState />,
  errorComponent: RouteErrorState,
});

function RootLayout() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="overscroll-none bg-[#101010] font-sans antialiased">
        <Providers>
          <Outlet />
          <Analytics />
          {env.VITE_DATABUDDY_CLIENT_ID ? (
            <Databuddy
              clientId={env.VITE_DATABUDDY_CLIENT_ID}
              enableBatching={true}
              trackErrors
              trackOutgoingLinks
              disabled={env.VITE_PUBLIC_ENV === 'development'}
            />
          ) : null}
          <Toaster />
        </Providers>
        <Scripts />
      </body>
    </html>
  );
}
