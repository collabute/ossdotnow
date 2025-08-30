'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { projectProviderEnum } from '@workspace/db/schema';
import { Button } from '@workspace/ui/components/button';
import { authClient } from '@workspace/auth/client';
import { Flag, Share2 } from 'lucide-react';
import { useTRPC } from '@/hooks/use-trpc';
import { toast } from 'sonner';
import {isValidProvider} from '@/lib/constants'

interface LaunchHeaderProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  launch: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any;
  projectId: string;
}

export default function LaunchHeader({ launch, project, projectId }: LaunchHeaderProps) {
  const { data: session } = authClient.useSession();
  const trpc = useTRPC();

  // Fetch repository data
  const repoQuery = useQuery(
    trpc.repository.getRepo.queryOptions(
      {
        url: project?.gitRepoUrl as string,
        provider: project?.gitHost as (typeof projectProviderEnum.enumValues)[number],
      },
      {
        enabled: !!project?.gitRepoUrl && isValidProvider(project?.gitHost),
        retry: false,
      },
    ),
  );

  const reportMutation = useMutation(
    trpc.launches.reportProject.mutationOptions({
      onSuccess: () => {
        toast.success('Project reported successfully!');
      },
      onError: () => {
        toast.error('Failed to report project. Please try again.');
      },
    }),
  );

  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: launch?.name,
          text: launch?.tagline,
          url,
        });
      } catch (error) {
        console.error(error);
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleReport = async () => {
    if (!session?.user) {
      toast.error('Please login to report');
      return;
    }
    reportMutation.mutate({ projectId });
  };

  return (
    <div className="border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="flex flex-row gap-4 sm:gap-6">
        {/* Column 1: Repo Logo */}
        <div className="order-2 flex-shrink-0 self-stretch sm:order-1 sm:self-stretch">
          <div className="mx-auto h-20 max-w-32 sm:h-full">
            {(repoQuery.data && repoQuery.data?.owner && repoQuery.data?.owner?.avatar_url) ||
            (repoQuery.data?.namespace && repoQuery.data?.namespace?.avatar_url) ? (
              <img
                src={
                  repoQuery.data?.owner?.avatar_url ||
                  `https://gitlab.com${repoQuery.data?.namespace?.avatar_url}`
                }
                alt={`${launch.name} logo`}
                className="h-full w-full rounded-none object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full animate-pulse bg-neutral-900" />
            )}
          </div>
        </div>

        {/* Column 2: Repo Name, Description, User Info */}
        <div className="order-1 min-w-0 flex-1 sm:order-2">
          <h1 className="mb-2 text-3xl font-bold">{launch.name}</h1>
          <p className="mb-2 text-lg text-neutral-400">{launch.tagline}</p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex gap-2">
              {launch.status === 'live' && (
                <Button variant="outline" onClick={handleShare} className="gap-2 rounded-none">
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              )}
              <Button
                title="Report"
                variant="outline"
                onClick={handleReport}
                className="gap-2 rounded-none"
                disabled={reportMutation.isPending}
              >
                <Flag className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
