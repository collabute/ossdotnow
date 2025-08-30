import { NextSSRPlugin } from '@uploadthing/react/next-ssr-plugin';
import { ourFileRouter } from '@/app/api/uploadthing/core';
import { extractRouterConfig } from 'uploadthing/server';
import { TempNav } from '@/components/layout/temp-nav';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from '@/components/providers';
import Footer from '@/components/layout/footer';
import { env } from '@workspace/env/server';
import { Databuddy } from '@databuddy/sdk';
import { connection } from 'next/server';
import { Toaster } from 'sonner';
import { Suspense } from 'react';
import { Metadata } from 'next';
import './globals.css';

const fontSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
});

const fontMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    template: '%s | oss now | early project submissions are live',
    default: 'oss now | early project submissions are live',
  },
  description:
    'A platform for open source project discovery, collaboration, and growth - connecting project owners with contributors.',
  icons: {
    icon: '/icon.svg',
  },
  metadataBase: new URL(
    env.VERCEL_PROJECT_PRODUCTION_URL === 'localhost'
      ? 'http://localhost:3000'
      : `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`,
  ),
};

async function UTSSR() {
  await connection();
  return <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} overscroll-none bg-[#101010] font-sans antialiased`}
      >
        <main className="root">
          <Suspense>
            <UTSSR />
          </Suspense>
          <Providers>
            {children}
            <Footer />

            <TempNav />

            <Databuddy
              clientId={env.DATABUDDY_CLIENT_ID}
              enableBatching={true}
              trackErrors
              trackOutgoingLinks
            />
            <Toaster />
          </Providers>
        </main>
      </body>
    </html>
  );
}
