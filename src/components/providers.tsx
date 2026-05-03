'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { TRPCReactProvider } from '@/hooks/use-trpc';
import * as React from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <NextThemesProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
        enableColorScheme
      >
        {children}
      </NextThemesProvider>
    </TRPCReactProvider>
  );
}
