import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs';
import { Heart, TrendingUp, GitFork, Clock, ExternalLink, FileText } from 'lucide-react';
import ProjectCard from '@/app/(public)/(projects)/projects/project-card';
import { MarkdownContent } from '@/components/project/markdown-content';
import { Card, CardContent } from '@workspace/ui/components/card';
import { Skeleton } from '@workspace/ui/components/skeleton';
import UnsubmittedRepoCard from './unsubmitted-project-card';
import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@workspace/ui/components/button';
import { ContributionGraph } from './contribution-graph';
import { ProjectWithGithubData } from '@/types/project';
import { Badge } from '@workspace/ui/components/badge';
import { authClient } from '@workspace/auth/client';
import Icons from '@workspace/ui/components/icons';
import Link from '@workspace/ui/components/link';
import { useQuery } from '@tanstack/react-query';
import { UnSubmittedRepo } from '@workspace/api';
import { RepoContent } from '@/lib/constants';
import { cn } from '@workspace/ui/lib/utils';
import { useTRPC } from '@/hooks/use-trpc';
import { useQueryState } from 'nuqs';

interface Profile {
  git?: {
    login: string;
    provider: 'github' | 'gitlab';
  };
  id?: string;
  image?: string;
  name?: string;
}

interface PullRequestData {
  mergedAt?: string;
  isDraft?: boolean;
  createdAt: string;
  updatedAt?: string;
  state: string;
  url: string;
  title: string;
  repository: {
    url: string;
    nameWithOwner: string;
  };
  headRefName?: string;
  baseRefName?: string;
  id: string | number;
}

interface ProfileTabsProps {
  isReadmeLoading: boolean;
  profileReadme: RepoContent | null;
  profile: Profile | undefined;
  isProfileLoading: boolean;
  tab: string;
  setTab: (value: string) => void;
  featuredProjects: ProjectWithGithubData[];
  projectsWithGithubData: ProjectWithGithubData[];
  unsubmittedProjects: UnSubmittedRepo[];
}

export function ProfileTabs({
  isReadmeLoading,
  profileReadme,
  profile,
  isProfileLoading,
  tab,
  setTab,
  featuredProjects,
  projectsWithGithubData,
  unsubmittedProjects,
}: ProfileTabsProps) {
  const featuredCarouselRef = useRef<HTMLDivElement>(null);

  // TODO: Fix this
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [filterState, setFilterState] = useQueryState('filterState', {
    defaultValue: 'all',
  });

  useEffect(() => {
    authClient
      .getSession()
      .then((sessionData) => {
        setSession(sessionData);
      })
      .catch((error) => {
        console.error('Session fetch failed:', error);
      })
      .finally(() => {
        setSessionLoading(false);
      });
  }, []);

  const filteredUnSubmitted =
    filterState === 'owned'
      ? unsubmittedProjects.filter((proj) => proj.isOwner)
      : unsubmittedProjects;
  const sessionUserId = session?.data?.user?.id;

  const isOwnProfile =
    !sessionLoading && sessionUserId && profile?.id ? sessionUserId === profile.id : false;

  return (
    <>
      {isProfileLoading && (
        <Card className="rounded-none border-neutral-800 bg-neutral-900/50 p-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-center py-8">
              <div className="text-neutral-400">Loading contribution graph...</div>
            </div>
          </CardContent>
        </Card>
      )}
      {!isProfileLoading && profile?.git && (
        <ContributionGraph username={profile.git.login} provider={profile.git.provider} />
      )}
      <Tabs defaultValue={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 rounded-none border-neutral-800 bg-neutral-900/50">
          <TabsTrigger value="about" className="rounded-none">
            About
          </TabsTrigger>
          <TabsTrigger value="projects" className="rounded-none">
            Projects
          </TabsTrigger>
          <TabsTrigger value="unsubmitted" className="rounded-none">
            Unsubmitted
          </TabsTrigger>
          <TabsTrigger value="contributions" className="rounded-none">
            Contributions
          </TabsTrigger>
          <TabsTrigger value="collections" className="rounded-none">
            Collections
          </TabsTrigger>
        </TabsList>
        <TabsContent value="about" className="mt-2">
          {profileReadme ? (
            <div className="rounded-none border border-neutral-800 bg-neutral-900/50 p-6">
              <MarkdownContent
                content={profileReadme.content}
                encoding={
                  profileReadme.encoding === 'base64' || profileReadme.encoding === 'utf8'
                    ? profileReadme.encoding
                    : 'base64'
                }
              />
            </div>
          ) : isReadmeLoading ? (
            <Card className="rounded-none border-neutral-800 bg-neutral-900/50 p-0">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-5 w-3/4 rounded-none" />
                  <Skeleton className="h-4 w-1/2 rounded-none" />
                  <Skeleton className="h-4 w-5/6 rounded-none" />
                  <Skeleton className="h-4 w-2/3 rounded-none" />
                  <Skeleton className="h-4 w-4/5 rounded-none" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-none border border-neutral-800 bg-neutral-900/50 p-6">
              <div className="py-8 text-center">
                <FileText className="mx-auto mb-4 h-12 w-12 text-neutral-600" />
                <h3 className="mb-2 text-lg font-medium text-neutral-300">No README found</h3>
                <p className="mx-auto mb-4 max-w-md text-sm text-neutral-400">
                  A profile README typically includes a short bio, interests, skills, and links to
                  notable projects or socials.
                </p>
                <p className="text-xs text-neutral-500">
                  Common filenames: README.md, README.rst, README.txt
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="projects" className="mt-2">
          {featuredProjects.length > 0 ? (
            <div className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center text-xl font-semibold">
                  <TrendingUp className="mr-2 h-5 w-5 text-orange-500" />
                  Featured Projects
                </h2>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (featuredCarouselRef.current) {
                        featuredCarouselRef.current.scrollBy({ left: -300, behavior: 'smooth' });
                      }
                    }}
                    className="h-8 w-8 p-0"
                  >
                    ←
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (featuredCarouselRef.current) {
                        featuredCarouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
                      }
                    }}
                    className="h-8 w-8 p-0"
                  >
                    →
                  </Button>
                </div>
              </div>
              <div
                ref={featuredCarouselRef}
                className="flex space-x-4 overflow-x-auto pb-4"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {featuredProjects.length > 0 ? (
                  featuredProjects?.map((project) => (
                    <ProjectCard key={project.id} project={project} isOwnProfile={isOwnProfile} />
                  ))
                ) : (
                  <div className="flex items-center justify-center">
                    <p className="text-neutral-400">No featured projects</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div>
            <div className="space-y-4">
              {projectsWithGithubData?.map((project) => (
                <ProjectCard key={project.id} project={project} isOwnProfile={isOwnProfile} />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contributions" className="mt-2">
          {profile && <UserPullRequests profile={profile} />}
        </TabsContent>

        <TabsContent value="collections" className="mt-2">
          <div className="py-12 text-center">
            <div className="mb-4 text-neutral-400">
              <Heart className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>Project collections coming soon...</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="unsubmitted">
          {unsubmittedProjects.length > 0 ? (
            <div className="mt-2">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold">Quicksubmit Projects</h2>
                <div className="xs:flex-row xs:gap-2 flex w-full gap-2 sm:w-auto">
                  <Select
                    value={filterState}
                    onValueChange={(value: string) => setFilterState(value)}
                  >
                    <SelectTrigger className="xs:w-[140px] w-full rounded-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="left-0 rounded-none">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="owned">Owned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-4">
                {filteredUnSubmitted.map((project, id) => (
                  <UnsubmittedRepoCard isOwnProfile={isOwnProfile} key={id} repo={project} />
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </>
  );
}

function UserPullRequests({ profile }: { profile: Profile }) {
  const trpc = useTRPC();
  const [selectedState, setSelectedState] = useQueryState('selectedState', {
    defaultValue: 'all',
  });
  const [sortBy, setSortBy] = useQueryState('sortBy', {
    defaultValue: 'recent',
  });

  const { data, isLoading, error } = useQuery(
    trpc.profile.getUserPullRequests.queryOptions(
      {
        username: profile?.git?.login ?? '',
        provider: profile?.git?.provider ?? 'github',
        state: selectedState as 'all' | 'open' | 'closed' | 'merged',
        limit: 100,
      },
      {
        enabled: !!profile?.git?.login && !!profile?.git?.provider,
      },
    ),
  );

  if (!profile?.git?.login || !profile?.git?.provider) {
    return (
      <div className="py-12 text-center">
        <div className="mb-4 text-neutral-400">
          <Icons.github className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>No Git provider connected to this profile</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="rounded-none border-neutral-800 bg-neutral-900/50 p-0">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Skeleton className="mb-2 h-5 w-3/4 rounded-none" />
                  <Skeleton className="mb-2 h-4 w-1/2 rounded-none" />
                  <Skeleton className="h-4 w-1/4 rounded-none" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <div className="mb-4 text-neutral-400">
          <Icons.github className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>Failed to load pull requests</p>
          <p className="mt-2 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const pullRequests = data?.pullRequests || [];

  const calculatePRScore = (pr: PullRequestData) => {
    let score = 0;

    if (pr.mergedAt) score += 20;
    if (pr.isDraft) score -= 10;

    const ageInDays = Math.floor(
      (Date.now() - new Date(pr.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (ageInDays < 30) score += 5;

    if (pr.mergedAt && pr.createdAt) {
      const daysToMerge = Math.floor(
        (new Date(pr.mergedAt).getTime() - new Date(pr.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysToMerge < 3) score += 10;
      else if (daysToMerge > 30) score -= 5;
    }

    return Math.round(score);
  };

  const sortedPullRequests = [...pullRequests].sort((a, b) => {
    switch (sortBy) {
      case 'impact':
        return calculatePRScore(b) - calculatePRScore(a);
      case 'discussion':
        return (
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
        );
      case 'fastest': {
        const aTime = a.mergedAt
          ? new Date(a.mergedAt).getTime() - new Date(a.createdAt).getTime()
          : Infinity;
        const bTime = b.mergedAt
          ? new Date(b.mergedAt).getTime() - new Date(b.createdAt).getTime()
          : Infinity;
        return aTime - bTime;
      }
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const stats = {
    open: pullRequests.filter((pr) => pr.state === 'open').length,
    closed: pullRequests.filter((pr) => pr.state === 'closed' && !pr.mergedAt).length,
    merged: pullRequests.filter((pr) => pr.mergedAt).length,
    avgMergeTime: (() => {
      const mergedPRs = pullRequests.filter((pr) => pr.mergedAt);
      if (mergedPRs.length === 0) return 0;
      const totalTime = mergedPRs.reduce((sum, pr) => {
        return sum + (new Date(pr.mergedAt!).getTime() - new Date(pr.createdAt).getTime());
      }, 0);
      return Math.round(totalTime / mergedPRs.length / (1000 * 60 * 60 * 24));
    })(),
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="rounded-none border-neutral-800 bg-neutral-900/50 p-0">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.merged}</div>
            <div className="text-xs text-neutral-400">Merged PRs</div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-800 bg-neutral-900/50 p-0">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.open}</div>
            <div className="text-xs text-neutral-400">Open PRs</div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-800 bg-neutral-900/50 p-0">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.avgMergeTime}d</div>
            <div className="text-xs text-neutral-400">Avg Merge Time</div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-800 bg-neutral-900/50 p-0">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{pullRequests.length}</div>
            <div className="text-xs text-neutral-400">Total PRs</div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Pull Requests</h2>
        <div className="xs:flex-row xs:gap-2 flex w-full gap-2 sm:w-auto">
          <Select value={sortBy} onValueChange={(value: string) => setSortBy(value)}>
            <SelectTrigger className="xs:w-[140px] w-full rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="left-0 rounded-none">
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="impact">By Status</SelectItem>
              <SelectItem value="discussion">Last Updated</SelectItem>
              <SelectItem value="fastest">Fastest Merged</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedState} onValueChange={(value: string) => setSelectedState(value)}>
            <SelectTrigger className="xs:w-[140px] w-full rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="left-0 rounded-none">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="merged">Merged</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {sortedPullRequests.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-neutral-400">
            <GitFork className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No {selectedState !== 'all' ? selectedState : ''} pull requests found</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedPullRequests.map((pr) => {
            // const score = calculatePRScore(pr);
            const isMergedQuickly =
              pr.mergedAt &&
              new Date(pr.mergedAt).getTime() - new Date(pr.createdAt).getTime() <
                3 * 24 * 60 * 60 * 1000;

            return (
              <Card
                key={pr.id}
                className={cn(
                  'rounded-none border-neutral-800 bg-neutral-900/50 p-0 transition-colors hover:bg-neutral-900/70',
                  isMergedQuickly && 'border-green-900/50',
                )}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Link
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary text-base font-medium"
                        >
                          {pr.title}
                        </Link>
                        <Badge
                          variant={
                            pr.state === 'open' ? 'default' : pr.mergedAt ? 'secondary' : 'outline'
                          }
                          className={cn(
                            'rounded-none text-xs',
                            pr.state === 'open' &&
                              'border-green-800 bg-green-900/20 text-green-400',
                            pr.mergedAt && 'border-purple-800 bg-purple-900/20 text-purple-400',
                            pr.state === 'closed' &&
                              !pr.mergedAt &&
                              'border-red-800 bg-red-900/20 text-red-400',
                          )}
                        >
                          {pr.mergedAt ? 'Merged' : pr.state}
                        </Badge>
                        {pr.isDraft && (
                          <Badge variant="outline" className="rounded-none text-xs">
                            Draft
                          </Badge>
                        )}
                        {isMergedQuickly && (
                          <Badge className="rounded-none border-green-800 bg-green-900/20 text-xs text-green-400">
                            <Clock className="mr-1 h-3 w-3" />
                            Quick Merge
                          </Badge>
                        )}
                      </div>
                      <div className="mb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center text-sm text-neutral-400">
                          <Link
                            href={pr.repository.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-neutral-200"
                          >
                            {pr.repository.nameWithOwner}
                          </Link>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-neutral-400 sm:mt-0">
                          <span className="flex items-center gap-1">
                            <Icons.clock className="h-3 w-3" />
                            {new Date(pr.createdAt).toLocaleDateString()}
                          </span>
                          {pr.mergedAt && (
                            <span className="flex items-center gap-1">
                              <Icons.merge className="h-3 w-3" />
                              {new Date(pr.mergedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {pr.headRefName && (
                        <div className="mt-2 flex flex-col gap-2 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            <code className="min-w-0 rounded-none bg-neutral-800 px-1.5 py-0.5 break-words hyphens-auto">
                              {pr.headRefName}
                            </code>
                            {pr.baseRefName && (
                              <>
                                <span className="shrink-0">→</span>
                                <code className="min-w-0 rounded-none bg-neutral-800 px-1.5 py-0.5 break-words hyphens-auto">
                                  {pr.baseRefName}
                                </code>
                              </>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            render={(props) => (
                              <Link
                                href={pr.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Open pull request in a new tab"
                                title="Open pull request in a new tab"
                                {...props}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            )}
                          />
                        </div>
                      )}
                      {!pr.headRefName && (
                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            render={(props) => (
                              <Link
                                href={pr.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Open pull request in a new tab"
                                title="Open pull request in a new tab"
                                {...props}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            )}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
