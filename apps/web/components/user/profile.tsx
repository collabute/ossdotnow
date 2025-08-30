'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar';
import { Award, Calendar, Globe, MapPin, Share } from 'lucide-react';
import ResponsiveNumber from '@/components/user/responsive-numbers';
import { Card, CardContent } from '@workspace/ui/components/card';
import { Skeleton } from '@workspace/ui/components/skeleton';
import { useQueries, useQuery } from '@tanstack/react-query';
import { projectProviderEnum } from '@workspace/db/schema';
import { Button } from '@workspace/ui/components/button';
import Icons from '@workspace/ui/components/icons';
import { RecentActivity } from './recent-activity';
import { isValidProvider } from '@/lib/constants';
import Link from '@workspace/ui/components/link';
import { ProfileTabs } from './profile-tabs';
import { useEffect, useState } from 'react';
import { useTRPC } from '@/hooks/use-trpc';
import { useQueryState } from 'nuqs';

export default function ProfilePage({ id }: { id: string }) {
  const trpc = useTRPC();
  const [tab, setTab] = useQueryState('tab', {
    defaultValue: 'about',
  });
  const [showShadow, setShowShadow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowShadow(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const { data: profile, isLoading: isProfileLoading } = useQuery(
    trpc.profile.getProfile.queryOptions({ id }),
  );

  const { data: unSubmittedProjects } = useQuery(
    trpc.projects.getUnSubmitted.queryOptions(
      {
        provider: profile?.git.provider as 'github' | 'gitlab',
        username: profile?.username ?? '',
        userId: profile?.id ?? '',
      },
      {
        enabled: !!profile?.git.provider && !!profile?.username && !!profile?.id,
      },
    ),
  );

  const { data: projects } = useQuery(
    trpc.projects.getProjectsByUserId.queryOptions(
      {
        userId: profile?.id ?? '',
        page: 1,
        pageSize: 100,
      },
      {
        enabled: !!profile?.id,
      },
    ),
  );

  const githubUrlRegex = /(?:https?:\/\/github\.com\/|^)([^/]+)\/([^/]+?)(?:\.git|\/|$)/;

  const ensureHttpProtocol = (url: string) => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  };

  const { data: profileReadme, isPending: isReadmeLoading } = useQuery(
    trpc.repository.getReadme.queryOptions(
      {
        url: `${profile?.username}/${profile?.username}`,
        provider: profile?.git?.provider as (typeof projectProviderEnum.enumValues)[number],
      },
      {
        enabled: !!profile?.username && isValidProvider(profile?.git?.provider),
        retry: false,
      },
    ),
  );

  const projectQueries = useQueries({
    queries: (projects?.data || []).map((project) => {
      if (!project.gitRepoUrl) {
        return {
          queryKey: ['github-repo', project.id],
          queryFn: () => null,
          enabled: false,
        };
      }

      const match = project.gitRepoUrl.match(githubUrlRegex);
      if (!match) {
        return {
          queryKey: ['github-repo', project.id],
          queryFn: () => null,
          enabled: false,
        };
      }

      const [, owner, repo] = match;
      const repoPath = `${owner}/${repo}`;

      return trpc.repository.getRepo.queryOptions({ url: repoPath, provider: 'github' });
    }),
  });

  const projectsWithGithubData = projects?.data?.map((project, index) => {
    const githubData = projectQueries[index]?.data;
    return {
      ...project,
      githubData,
      stars: githubData?.stargazers_count || 0,
      forks: githubData?.forks_count || 0,
      lastCommit: githubData?.updated_at
        ? new Date(githubData.updated_at).toLocaleDateString()
        : 'Unknown',
      language: githubData?.language || null,
      openIssues: githubData?.open_issues_count || 0,
      topics: githubData?.topics || [],
    };
  });

  // const featuredProjects = projectsWithGithubData?.filter((project) => project.featured);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const featuredProjects = [] as any[];

  return (
    <div className="relative px-6 pt-8">
      <div
        className={`pointer-events-none fixed top-[calc(32px+65px)] z-10 h-10 w-full bg-gradient-to-b from-[#101010] to-transparent transition-all duration-300 ${
          showShadow ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div className="fixed top-0 right-0 left-0 z-10 h-[33px] bg-[#101010]" />
      <div className="relative mx-auto min-h-[calc(100vh-80px)] max-w-[1080px]">
        <div className="py-4">
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="sticky top-[calc(32px+66px+16px)]">
                {isProfileLoading ? (
                  <ProfileSidebarSkeleton />
                ) : (
                  <Card className="rounded-none border-neutral-800 bg-neutral-900/50 backdrop-blur-sm">
                    <CardContent className="px-6">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-16 w-16 flex-shrink-0 rounded-none">
                          <AvatarImage src={profile?.image} />
                          <AvatarFallback>
                            {profile?.name?.charAt(0).toUpperCase() ?? 'U'}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h1 className="truncate text-lg font-bold">{profile?.name}</h1>

                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" asChild>
                                <Link
                                  href={`https://${profile?.git?.provider}.com/${profile?.git?.login}`}
                                  target="_blank"
                                >
                                  {profile?.git?.provider === 'github' ? (
                                    <Icons.github className="h-4 w-4" />
                                  ) : (
                                    <Icons.gitlab className="h-4 w-4" />
                                  )}
                                </Link>
                              </Button>

                              {profile?.git?.blog && (
                                <Button variant="ghost" size="sm" asChild>
                                  <Link href={ensureHttpProtocol(profile.git.blog)} target="_blank">
                                    <Globe className="h-4 w-4" />
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="mt-1 flex items-center justify-between text-sm text-neutral-400">
                            {profile?.git?.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{profile?.git?.location}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {profile?.git?.createdAt &&
                                  new Date(profile.git.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-neutral-800 pt-4">
                        <div className="text-center">
                          <div className="text-lg font-bold">
                            {(projectsWithGithubData?.length || 0).toLocaleString()}
                          </div>
                          <div className="text-xs text-neutral-400">Projects</div>
                        </div>
                        <div className="text-center">
                          <ResponsiveNumber
                            value={
                              projectsWithGithubData?.reduce((sum, p) => sum + p.stars, 0) || 0
                            }
                            className="text-lg font-bold"
                          />
                          <div className="text-xs text-neutral-400">Stars</div>
                        </div>
                        <div className="text-center">
                          <ResponsiveNumber
                            value={
                              projectsWithGithubData?.reduce((sum, p) => sum + p.forks, 0) || 0
                            }
                            className="text-lg font-bold"
                          />
                          <div className="text-xs text-neutral-400">Forks</div>
                        </div>
                      </div>

                      <div className="mt-5 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-none border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-800 hover:text-neutral-200"
                          // TODO: Implement share functionality
                          // Add Web Share API with clipboard fallback
                        >
                          <Share className="mr-2 h-4 w-4" />
                          Share
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-none border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-800 hover:text-neutral-200"
                          // TODO: Implement endorse functionality
                          // Add endorse/profile recommendation feature
                        >
                          <Award className="mr-2 h-4 w-4" />
                          Endorse
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {profile?.id && (
                  <div className="hidden lg:block">
                    <RecentActivity userId={profile.id} />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 lg:col-span-8">
              <ProfileTabs
                isReadmeLoading={isReadmeLoading}
                profileReadme={profileReadme ?? null}
                profile={profile}
                isProfileLoading={isProfileLoading}
                tab={tab}
                setTab={setTab}
                featuredProjects={featuredProjects}
                projectsWithGithubData={projectsWithGithubData ?? []}
                unsubmittedProjects={unSubmittedProjects ?? []}
              />
            </div>
            {profile?.id && (
              <div className="block lg:hidden">
                <RecentActivity userId={profile.id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSidebarSkeleton() {
  return (
    <Card className="rounded-none border-neutral-800 bg-neutral-900/50 backdrop-blur-sm">
      <CardContent className="px-6">
        <div className="flex items-start gap-3">
          <Skeleton className="h-16 w-16 flex-shrink-0 rounded-none" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32 rounded-none" />
              <div className="flex items-center gap-1">
                <Skeleton className="h-8 w-8 rounded-none" />
                <Skeleton className="h-8 w-8 rounded-none" />
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Skeleton className="h-3 w-3 rounded-none" />
                <Skeleton className="h-4 w-20 rounded-none" />
              </div>
              <div className="flex items-center gap-1">
                <Skeleton className="h-3 w-3 rounded-none" />
                <Skeleton className="h-4 w-16 rounded-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-neutral-800 pt-4">
          <div className="text-center">
            <Skeleton className="mx-auto h-7 w-12 rounded-none" />
            <Skeleton className="mx-auto mt-1 h-3 w-12 rounded-none" />
          </div>
          <div className="text-center">
            <Skeleton className="mx-auto h-7 w-12 rounded-none" />
            <Skeleton className="mx-auto mt-1 h-3 w-12 rounded-none" />
          </div>
          <div className="text-center">
            <Skeleton className="mx-auto h-7 w-12 rounded-none" />
            <Skeleton className="mx-auto mt-1 h-3 w-12 rounded-none" />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-none" />
          <Skeleton className="h-9 flex-1 rounded-none" />
        </div>
      </CardContent>
    </Card>
  );
}
