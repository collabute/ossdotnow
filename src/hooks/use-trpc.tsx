'use client';

import { createTRPCClient, httpBatchStreamLink, loggerLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import {
  QueryClientProvider,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import superjson from 'superjson';

import type { AppRouter } from '@/lib/api-types';
import { env } from '@/lib/env';
import { getQueryClient } from '@/lib/query-client';

const trpcContext = createTRPCContext<AppRouter>();

export const TRPCProvider = trpcContext.TRPCProvider;

type TrpcProcedure = {
  queryOptions: (...args: any[]) => UseQueryOptions<ApiData, any, ApiData, QueryKey>;
  mutationOptions: (
    options?: UseMutationOptions<any, any, ApiMutationVariables, unknown>,
  ) => UseMutationOptions<any, any, ApiMutationVariables, unknown>;
  queryKey: (...args: any[]) => QueryKey;
};

type ApiData = Record<string, any> & any[];
type ApiMutationVariables = void | Record<string, any>;

type TrpcRouterProxy = {
  admin: {
    dashboard: TrpcProcedure;
  };
  earlyAccess: {
    getWaitlist: TrpcProcedure;
  };
  github: {
    getRepoData: TrpcProcedure;
    searchRepos: TrpcProcedure;
    suggestProjectFields: TrpcProcedure;
  };
  projects: {
    acceptProject: TrpcProcedure;
    canClaimProject: TrpcProcedure;
    claimProject: TrpcProcedure;
    createProject: TrpcProcedure;
    debugGitHubPermissions: TrpcProcedure;
    deleteMyProject: TrpcProcedure;
    expressProjectInterest: TrpcProcedure;
    getAdminProjectDetail: TrpcProcedure;
    getMyProjectInterestHistory: TrpcProcedure;
    getMyProjectInterestInbox: TrpcProcedure;
    getMyProjects: TrpcProcedure;
    getProject: TrpcProcedure;
    getProjectViewerState: TrpcProcedure;
    getProjects: TrpcProcedure;
    getRecommendedProjects: TrpcProcedure;
    getSavedProjects: TrpcProcedure;
    rejectProject: TrpcProcedure;
    reportProject: TrpcProcedure;
    resubmitMyProject: TrpcProcedure;
    saveProject: TrpcProcedure;
    unsaveProject: TrpcProcedure;
    updateMyProject: TrpcProcedure;
  };
  system: {
    providerStatus: TrpcProcedure;
  };
  user: {
    disconnectProvider: TrpcProcedure;
    getAccountSecurity: TrpcProcedure;
    getContributorProfile: TrpcProcedure;
    getInvestorProfile: TrpcProcedure;
    me: TrpcProcedure;
    signOutEverywhere: TrpcProcedure;
    updateAccountType: TrpcProcedure;
    updateProfile: TrpcProcedure;
    upsertContributorProfile: TrpcProcedure;
    upsertInvestorProfile: TrpcProcedure;
  };
  users: {
    getUsers: TrpcProcedure;
    suspendUser: TrpcProcedure;
    unsuspendUser: TrpcProcedure;
    updateUserRole: TrpcProcedure;
  };
};

export function useTRPC(): TrpcRouterProxy {
  return trpcContext.useTRPC() as unknown as TrpcRouterProxy;
}

function getUrl() {
  return `${env.VITE_API_BASE_URL}/api/trpc`;
}

interface TRPCReactProviderProps {
  children: ReactNode;
}

export function TRPCReactProvider(props: Readonly<TRPCReactProviderProps>) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            env.VITE_PUBLIC_ENV === 'development' ||
            (op.direction === 'down' && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: superjson,
          url: getUrl(),
          fetch: (url, options) => fetch(url, { ...options, credentials: 'include' }),
          headers: () => {
            const headers = new Headers();
            headers.set('x-trpc-source', 'tanstack-start-react');

            return headers;
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
