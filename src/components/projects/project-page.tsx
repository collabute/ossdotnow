'use client';

import {
  AlertCircle,
  Bookmark,
  Briefcase,
  Building,
  CheckCircle,
  Clock,
  DollarSign,
  ExternalLink,
  Flag,
  GitFork,
  Github,
  GitMerge,
  GitPullRequest,
  Globe,
  Linkedin,
  Loader2,
  MessageSquare,
  Send,
  Star,
  Tag,
  Twitter,
  Users,
  XCircle,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import { ClaimProjectDialog } from '@/components/project/claim-project-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import ProjectTicks from '@/components/project/project-ticks';
import type { RouterOutputs } from '@/lib/api-types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { authClient } from '@/lib/auth-client';
import Icons from '@/components/ui/icons';
import { Label } from '@/components/ui/label';
import Link from '@/components/ui/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/hooks/use-trpc';
import { formatDate } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

type GitHubIssue = RestEndpointMethodTypes['issues']['listForRepo']['response']['data'][0];
type GitHubPullRequest = RestEndpointMethodTypes['pulls']['list']['response']['data'][0];
type ProjectDetail = NonNullable<RouterOutputs['projects']['getProject']>;
type ProjectViewerState = RouterOutputs['projects']['getProjectViewerState'];
type InterestType = 'contribution' | 'investment' | 'contact';

function useProject(id: string) {
  const trpc = useTRPC();
  const query = useQuery(trpc.projects.getProject.queryOptions({ id }));

  return {
    project: query.data,
  };
}

export default function ProjectPage({ id }: { id: string }) {
  const { project } = useProject(id);
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [interestType, setInterestType] = useState<InterestType | null>(null);
  const [interestMessage, setInterestMessage] = useState('');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const { data: viewer } = useQuery({
    ...trpc.user.me.queryOptions(),
    enabled: Boolean(user?.id),
  });
  const { data: viewerState } = useQuery(
    trpc.projects.getProjectViewerState.queryOptions(
      { projectId: id },
      { enabled: Boolean(project?.id) },
    ),
  );
  const viewerStateQueryKey = trpc.projects.getProjectViewerState.queryKey({ projectId: id });

  const { data: repoData, isError: isRepoDataError } = useQuery(
    trpc.github.getRepoData.queryOptions(
      { repo: project?.gitRepoUrl! },
      { enabled: !!project?.gitRepoUrl },
    ),
  );

  const repo = repoData?.repo;
  const contributors = repoData?.contributors;
  const issues = repoData?.issues;
  const pullRequests = repoData?.pullRequests;
  const cachedStats = project?.githubStats;
  const starsCount = repo?.stargazers_count ?? cachedStats?.stargazersCount ?? 0;
  const forksCount = repo?.forks_count ?? cachedStats?.forksCount ?? 0;
  const openIssuesCount =
    issues?.filter((issue: GitHubIssue) => !issue.pull_request && issue.state === 'open').length ??
    cachedStats?.openIssuesCount ??
    0;
  const repoUrl = repo?.html_url ?? cachedStats?.repoHtmlUrl ?? `https://github.com/${project?.gitRepoUrl ?? ''}`;
  const repoCreatedAt = repo?.created_at
    ? new Date(repo.created_at)
    : cachedStats?.repoCreatedAt ?? project?.createdAt;
  const repoUpdatedAt = repo?.updated_at
    ? new Date(repo.updated_at)
    : cachedStats?.repoUpdatedAt ?? project?.updatedAt;
  const saveMutation = useMutation({
    ...trpc.projects.saveProject.mutationOptions(),
    onSuccess: () => {
      toast.success('Project saved');
      queryClient.invalidateQueries({ queryKey: viewerStateQueryKey });
    },
    onError: (error) => {
      toast.error(error.message || 'Could not save project');
    },
  });
  const unsaveMutation = useMutation({
    ...trpc.projects.unsaveProject.mutationOptions(),
    onSuccess: () => {
      toast.success('Project removed from saved projects');
      queryClient.invalidateQueries({ queryKey: viewerStateQueryKey });
    },
    onError: (error) => {
      toast.error(error.message || 'Could not update saved project');
    },
  });
  const interestMutation = useMutation({
    ...trpc.projects.expressProjectInterest.mutationOptions(),
    onSuccess: () => {
      toast.success('Interest sent to the maintainer');
      setInterestType(null);
      setInterestMessage('');
      queryClient.invalidateQueries({ queryKey: viewerStateQueryKey });
    },
    onError: (error) => {
      toast.error(error.message || 'Could not send interest');
    },
  });
  const reportMutation = useMutation({
    ...trpc.projects.reportProject.mutationOptions(),
    onSuccess: () => {
      toast.success('Report submitted');
      setIsReportOpen(false);
      setReportReason('');
      setReportDetails('');
      queryClient.invalidateQueries({ queryKey: viewerStateQueryKey });
    },
    onError: (error) => {
      toast.error(error.message || 'Could not report project');
    },
  });

  if (!project || !project.gitRepoUrl) return <div>Project not found</div>;

  const isUnclaimed = !project.ownerId;
  const isOwner = user?.id === project.ownerId;
  const viewerAccountType = viewer?.accountType ?? null;
  const hasSession = Boolean(user?.id);

  function toggleSavedProject() {
    if (!project?.id) return;

    if (!hasSession) {
      toast.error('Sign in to save projects');
      return;
    }

    if (viewerState?.isSaved) {
      unsaveMutation.mutate({ projectId: project.id });
      return;
    }

    saveMutation.mutate({ projectId: project.id });
  }

  function openInterestDialog(type: InterestType) {
    if (!hasSession) {
      toast.error('Sign in to contact maintainers');
      return;
    }

    setInterestType(type);
  }

  function submitInterest() {
    if (!project?.id || !interestType) return;

    interestMutation.mutate({
      projectId: project.id,
      type: interestType,
      message: interestMessage || undefined,
    });
  }

  function submitReport() {
    if (!project?.id) return;

    reportMutation.mutate({
      projectId: project.id,
      reason: reportReason,
      details: reportDetails || undefined,
    });
  }

  return (
    <div className="mt-8">
      <div className="mx-auto max-w-6xl border border-neutral-800 bg-neutral-900/50 py-8">
        <div className="px-4">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <img
                src={project.logoUrl || cachedStats?.ownerAvatarUrl || repo?.owner.avatar_url || 'https://placehold.co/100x100'}
                alt={project?.name ?? 'Project Logo'}
                width={100}
                height={100}
                className="h-24 w-24 rounded-full border border-neutral-800"
              />
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-white">{project?.name}</h1>
                  <ProjectTicks project={project} />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <span className="rounded-md bg-neutral-800 px-3 py-1 text-sm font-medium text-neutral-300">
                    {project?.status?.replace('-', ' ')}
                  </span>
                  <span className="rounded-md bg-neutral-800 px-3 py-1 text-sm font-medium text-neutral-300">
                    {project?.type?.replace('-', ' ')}
                  </span>
                  {project?.hasBeenAcquired && (
                    <span className="rounded-md bg-yellow-500/10 px-3 py-1 text-sm font-medium text-yellow-400">
                      Acquired
                    </span>
                  )}
                </div>
                {project?.socialLinks && (
                  <div className="mt-4 flex gap-4">
                    {project.socialLinks.website && (
                      <Link
                        href={project.socialLinks.website}
                        target="_blank"
                        event="project_page_website_link_clicked"
                        eventObject={{ projectId: project.id }}
                        className="flex items-center gap-1 text-neutral-300 transition-colors hover:text-white"
                      >
                        <Globe className="h-3 w-3" />
                        <span className="text-sm">Website</span>
                        <ExternalLink className="ml-auto h-3 w-3" />
                      </Link>
                    )}
                    {project.socialLinks.discord && (
                      <Link
                        href={project.socialLinks.discord}
                        target="_blank"
                        rel="noopener noreferrer"
                        event="project_page_discord_link_clicked"
                        eventObject={{ projectId: project.id }}
                        className="flex items-center gap-1 text-neutral-300 transition-colors hover:text-white"
                      >
                        <Icons.discord className="h-3 w-3" />
                        <span className="text-sm">Discord</span>
                        <ExternalLink className="ml-auto h-3 w-3" />
                      </Link>
                    )}
                    {project.socialLinks.twitter && (
                      <Link
                        href={project.socialLinks.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        event="project_page_twitter_link_clicked"
                        eventObject={{ projectId: project.id }}
                        className="flex items-center gap-1 text-neutral-300 transition-colors hover:text-white"
                      >
                        <Twitter className="h-3 w-3" />
                        <span className="text-sm">Twitter</span>
                        <ExternalLink className="ml-auto h-3 w-3" />
                      </Link>
                    )}
                    {project.socialLinks.linkedin && (
                      <Link
                        href={project.socialLinks.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        event="project_page_linkedin_link_clicked"
                        eventObject={{ projectId: project.id }}
                        className="flex items-center gap-1 text-neutral-300 transition-colors hover:text-white"
                      >
                        <Linkedin className="h-3 w-3" />
                        <span className="text-sm">LinkedIn</span>
                        <ExternalLink className="ml-auto h-3 w-3" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end justify-end gap-2">
              <Link
                href={repoUrl}
                target="_blank"
                event="project_page_github_link_clicked"
                eventObject={{ projectId: project.id }}
              >
                <Button
                  variant="outline"
                  className="rounded-none border-neutral-800 bg-neutral-900 hover:border-neutral-700"
                >
                  <Github className="h-4 w-4" />
                  View on GitHub
                </Button>
              </Link>

              {isUnclaimed && user && (
                <div className="bg-background/50 mt-4 flex flex-col items-end gap-2 border p-4">
                  <h3 className="mb-2 text-sm font-medium">Project Ownership</h3>
                  <p className="text-muted-foreground mb-3 text-sm">
                    This project hasn&apos;t been claimed yet.
                  </p>
                  <ClaimProjectDialog projectId={project.id} />
                </div>
              )}

              {isOwner && (
                <div className="mt-4">
                  <Button variant="outline" size="sm" asChild className="rounded-none">
                    <Link href={`/dashboard/projects/${project.id}/edit`}>Edit Project Details</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl py-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <div className="border border-neutral-800 bg-neutral-900/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">Description</h2>
              <div className="mb-4">
                <p className="mt-2 text-base text-neutral-400">{project?.description}</p>
              </div>
              {isRepoDataError && cachedStats && (
                <div className="mb-4 border border-neutral-800 bg-neutral-950/70 p-3 text-sm text-neutral-400">
                  Live GitHub data is unavailable, so cached repository stats are shown.
                </div>
              )}
              <h2 className="mb-4 text-lg font-semibold text-white">Repository Stats</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-neutral-400">
                    <Star className="h-4 w-4" />
                    <span className="text-sm">Stars</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-white">{starsCount.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-neutral-400">
                    <GitFork className="h-4 w-4" />
                    <span className="text-sm">Forks</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-white">{forksCount.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-neutral-400">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Contributors</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {contributors?.length?.toLocaleString() ?? '—'}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-neutral-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">Open Issues</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-white">{openIssuesCount}</p>
                </div>
              </div>
            </div>

            {(project?.isLookingForContributors ||
              project?.isLookingForInvestors ||
              project?.isHiring) && (
              <div className="border border-neutral-800 bg-neutral-900/50 p-6">
                <h2 className="mb-4 text-lg font-semibold text-white">Opportunities</h2>
                <div className="space-y-3">
                  {project?.isLookingForContributors && (
                    <div className="flex items-center gap-3 rounded-md bg-emerald-500/10 p-3 pl-4">
                      <Users className="h-5 w-5 text-emerald-400" />
                      <div>
                        <p className="font-medium text-emerald-400">Open to Contributors</p>
                        <p className="text-sm text-neutral-400">
                          This project is actively seeking contributors
                        </p>
                      </div>
                    </div>
                  )}
                  {project?.isLookingForInvestors && (
                    <div className="flex items-center gap-3 rounded-md bg-blue-500/10 p-3 pl-4">
                      <DollarSign className="h-5 w-5 text-blue-400" />
                      <div>
                        <p className="font-medium text-blue-400">Seeking Investment</p>
                        <p className="text-sm text-neutral-400">
                          Open to investor discussions and funding
                        </p>
                      </div>
                    </div>
                  )}
                  {project?.isHiring && (
                    <div className="flex items-center gap-3 rounded-md bg-purple-500/10 p-3 pl-4">
                      <Briefcase className="h-5 w-5 text-purple-400" />
                      <div>
                        <p className="font-medium text-purple-400">We&apos;re Hiring!</p>
                        <p className="text-sm text-neutral-400">Check out available positions</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border border-neutral-800 bg-neutral-900/50 p-6">
              <Tabs defaultValue="issues" className="w-full">
                <TabsList className="bg-neutral-900/0 p-0">
                  <TabsTrigger value="issues">
                    <AlertCircle className="h-4 w-4" />
                    Issues
                  </TabsTrigger>
                  <TabsTrigger value="pull-requests">
                    <GitPullRequest className="h-4 w-4" />
                    Pull Requests
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="issues">
                  {issues &&
                  issues.filter((issue: GitHubIssue) => !issue.pull_request).length > 0 ? (
                    <div className="space-y-3">
                      {issues
                        .filter((issue: GitHubIssue) => !issue.pull_request)
                        .slice(0, 10)
                        .map((issue: GitHubIssue) => (
                          <div
                            key={issue.id}
                            className="rounded-md border border-neutral-800 p-4 transition-colors hover:border-neutral-700"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  {issue.state === 'open' ? (
                                    <div className="flex items-center gap-1 text-emerald-400">
                                      <AlertCircle className="h-4 w-4" />
                                      <span className="text-xs font-medium">Open</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-purple-400">
                                      <CheckCircle className="h-4 w-4" />
                                      <span className="text-xs font-medium">Closed</span>
                                    </div>
                                  )}
                                  <span className="text-xs text-neutral-500">#{issue.number}</span>
                                </div>
                                <Link
                                  href={issue.html_url}
                                  event="project_page_issue_link_clicked"
                                  eventObject={{ projectId: project.id }}
                                  target="_blank"
                                  className="mt-2 block text-sm font-medium text-neutral-300 transition-colors hover:text-white"
                                >
                                  {issue.title}
                                </Link>
                                {issue.labels && issue.labels.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {issue.labels.map((label: any) => (
                                      <span
                                        key={label.id}
                                        className="rounded-full px-2 py-0.5 text-xs"
                                        style={{
                                          backgroundColor: `#${label.color}20`,
                                          color: `#${label.color}`,
                                          border: `1px solid #${label.color}40`,
                                        }}
                                      >
                                        {label.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-2 flex items-center gap-4 text-xs text-neutral-500">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{formatDate(new Date(issue.created_at))}</span>
                                  </div>
                                  <span>by {issue.user?.login}</span>
                                </div>
                              </div>
                              <Link
                                href={issue.html_url}
                                target="_blank"
                                className="text-neutral-400 transition-colors hover:text-white"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </div>
                          </div>
                        ))}
                      {issues.filter((issue: GitHubIssue) => !issue.pull_request).length > 10 && (
                        <Link
                          href={`${repo?.html_url}/issues`}
                          target="_blank"
                          event="project_page_issues_link_clicked"
                          eventObject={{ projectId: project.id }}
                          className="block pt-2 text-center text-sm text-neutral-400 transition-colors hover:text-white"
                        >
                          View all{' '}
                          {issues.filter((issue: GitHubIssue) => !issue.pull_request).length} issues
                          on GitHub →
                        </Link>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400">No issues found</p>
                  )}
                </TabsContent>
                <TabsContent value="pull-requests">
                  {pullRequests && pullRequests.length > 0 ? (
                    <div className="space-y-3">
                      {pullRequests.slice(0, 10).map((pr: GitHubPullRequest) => (
                        <div
                          key={pr.id}
                          className="rounded-md border border-neutral-800 p-4 transition-colors hover:border-neutral-700"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {pr.draft ? (
                                  <div className="flex items-center gap-1 text-gray-400">
                                    <GitPullRequest className="h-4 w-4" />
                                    <span className="text-xs font-medium">Draft</span>
                                  </div>
                                ) : pr.state === 'open' ? (
                                  <div className="flex items-center gap-1 text-blue-400">
                                    <GitPullRequest className="h-4 w-4" />
                                    <span className="text-xs font-medium">Open</span>
                                  </div>
                                ) : pr.merged_at ? (
                                  <div className="flex items-center gap-1 text-purple-400">
                                    <GitMerge className="h-4 w-4" />
                                    <span className="text-xs font-medium">Merged</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-red-400">
                                    <XCircle className="h-4 w-4" />
                                    <span className="text-xs font-medium">Closed</span>
                                  </div>
                                )}
                                <span className="text-xs text-neutral-500">#{pr.number}</span>
                              </div>
                              <Link
                                href={pr.html_url}
                                target="_blank"
                                event="project_page_pull_request_link_clicked"
                                eventObject={{ projectId: project.id }}
                                className="mt-2 block text-sm font-medium text-neutral-300 transition-colors hover:text-white"
                              >
                                {pr.title}
                              </Link>
                              {pr.labels && pr.labels.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {pr.labels.map((label: any) => (
                                    <span
                                      key={label.id}
                                      className="rounded-full px-2 py-0.5 text-xs"
                                      style={{
                                        backgroundColor: `#${label.color}20`,
                                        color: `#${label.color}`,
                                        border: `1px solid #${label.color}40`,
                                      }}
                                    >
                                      {label.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="mt-2 flex items-center gap-4 text-xs text-neutral-500">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatDate(new Date(pr.created_at))}</span>
                                </div>
                                <span>by {pr.user?.login}</span>
                                {pr.merged_at && (
                                  <span className="text-purple-400">
                                    merged {formatDate(new Date(pr.merged_at))}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Link
                              href={pr.html_url}
                              event="project_page_pull_request_link_clicked"
                              eventObject={{ projectId: project.id }}
                              target="_blank"
                              className="text-neutral-400 transition-colors hover:text-white"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </div>
                        </div>
                      ))}
                      {pullRequests.length > 10 && (
                        <Link
                          href={`${repo?.html_url}/pulls`}
                          target="_blank"
                          event="project_page_pull_requests_link_clicked"
                          eventObject={{ projectId: project.id }}
                          className="block pt-2 text-center text-sm text-neutral-400 transition-colors hover:text-white"
                        >
                          View all {pullRequests.length} pull requests on GitHub →
                        </Link>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400">No pull requests</p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <ProjectActionsCard
              project={project}
              viewerState={viewerState}
              hasSession={hasSession}
              isOwner={isOwner}
              accountType={viewerAccountType}
              isSaving={saveMutation.isPending || unsaveMutation.isPending}
              isSubmittingInterest={interestMutation.isPending}
              isReporting={reportMutation.isPending}
              onToggleSaved={toggleSavedProject}
              onOpenInterest={openInterestDialog}
              onOpenReport={() => {
                if (!hasSession) {
                  toast.error('Sign in to report projects');
                  return;
                }

                setIsReportOpen(true);
              }}
            />

            <div className="border border-neutral-800 bg-neutral-900/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">About</h2>
              <div className="space-y-2 text-sm">
                {project?.createdAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Created</span>
                    <span className="text-neutral-300">
                      {repoCreatedAt ? formatDate(new Date(repoCreatedAt)) : 'Unknown'}
                    </span>
                  </div>
                )}
                {project?.updatedAt && (
                  <>
                    <Separator className="bg-neutral-800" />
                    <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Last Updated</span>
                    <span className="text-neutral-300">
                        {repoUpdatedAt ? formatDate(new Date(repoUpdatedAt)) : 'Unknown'}
                      </span>
                    </div>
                  </>
                )}
                {project?.gitHost && (
                  <>
                    <Separator className="bg-neutral-800" />
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Host</span>
                      <span className="text-neutral-300 capitalize">{project?.gitHost}</span>
                    </div>
                  </>
                )}
                <Separator className="bg-neutral-800" />
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Visibility</span>
                  <span className="text-neutral-300">
                    {project?.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-neutral-800 bg-neutral-900/50 p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <Tag className="h-5 w-5" />
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {project?.tags?.map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="rounded-full bg-neutral-800 px-3 py-1 text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {project?.hasBeenAcquired && project?.acquiredBy && (
              <div className="border border-yellow-500/20 bg-yellow-500/5 p-6">
                <div className="flex items-center gap-2 text-yellow-400">
                  <Building className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Acquisition</h2>
                </div>
                <p className="mt-2 text-sm text-neutral-300">This project has been acquired</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <ProjectInterestDialog
        type={interestType}
        message={interestMessage}
        isPending={interestMutation.isPending}
        onMessageChange={setInterestMessage}
        onClose={() => {
          if (!interestMutation.isPending) {
            setInterestType(null);
            setInterestMessage('');
          }
        }}
        onSubmit={submitInterest}
      />
      <ProjectReportDialog
        open={isReportOpen}
        reason={reportReason}
        details={reportDetails}
        isPending={reportMutation.isPending}
        onReasonChange={setReportReason}
        onDetailsChange={setReportDetails}
        onClose={() => {
          if (!reportMutation.isPending) {
            setIsReportOpen(false);
          }
        }}
        onSubmit={submitReport}
      />
    </div>
  );
}

function hasInterest(viewerState: ProjectViewerState | undefined, type: InterestType) {
  return viewerState?.interestTypes.includes(type) ?? false;
}

function ProjectActionsCard({
  project,
  viewerState,
  hasSession,
  isOwner,
  accountType,
  isSaving,
  isSubmittingInterest,
  isReporting,
  onToggleSaved,
  onOpenInterest,
  onOpenReport,
}: {
  project: ProjectDetail;
  viewerState: ProjectViewerState | undefined;
  hasSession: boolean;
  isOwner: boolean;
  accountType: 'owner' | 'contributor' | 'investor' | null | undefined;
  isSaving: boolean;
  isSubmittingInterest: boolean;
  isReporting: boolean;
  onToggleSaved: () => void;
  onOpenInterest: (type: InterestType) => void;
  onOpenReport: () => void;
}) {
  const hasContributionInterest = hasInterest(viewerState, 'contribution');
  const hasInvestmentInterest = hasInterest(viewerState, 'investment');
  const hasContactInterest = hasInterest(viewerState, 'contact');

  return (
    <div className="border border-neutral-800 bg-neutral-900/50 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">Project actions</h2>
      {!hasSession && (
        <div className="mb-4 border border-neutral-800 p-3 text-sm text-neutral-400">
          Sign in to save this project, contact the maintainer, or send contributor/investor
          interest.
          <Button className="mt-3 w-full rounded-none" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      )}
      {isOwner && (
        <p className="mb-4 text-sm text-neutral-400">
          You own this project, so public interest actions are hidden from your owner workflow.
        </p>
      )}

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start rounded-none border-neutral-800"
          disabled={!hasSession || isSaving}
          onClick={onToggleSaved}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}
          {viewerState?.isSaved ? 'Saved project' : 'Save project'}
        </Button>

        {project.isLookingForContributors && (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start rounded-none border-neutral-800"
            disabled={
              !hasSession ||
              isOwner ||
              accountType !== 'contributor' ||
              hasContributionInterest ||
              isSubmittingInterest
            }
            onClick={() => onOpenInterest('contribution')}
          >
            <Users className="h-4 w-4" />
            {hasContributionInterest ? 'Contributor interest sent' : 'I want to contribute'}
          </Button>
        )}

        {project.isLookingForInvestors && (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start rounded-none border-neutral-800"
            disabled={
              !hasSession ||
              isOwner ||
              accountType !== 'investor' ||
              hasInvestmentInterest ||
              isSubmittingInterest
            }
            onClick={() => onOpenInterest('investment')}
          >
            <DollarSign className="h-4 w-4" />
            {hasInvestmentInterest ? 'Investor interest sent' : 'I am interested'}
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          className="w-full justify-start rounded-none border-neutral-800"
          disabled={!hasSession || isOwner || !project.ownerId || hasContactInterest || isSubmittingInterest}
          onClick={() => onOpenInterest('contact')}
        >
          <MessageSquare className="h-4 w-4" />
          {hasContactInterest ? 'Maintainer contacted' : 'Contact maintainer'}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full justify-start rounded-none border-neutral-800 text-neutral-400"
          disabled={!hasSession || viewerState?.hasReported || isReporting}
          onClick={onOpenReport}
        >
          {isReporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
          {viewerState?.hasReported ? 'Report submitted' : 'Report project'}
        </Button>
      </div>

      {hasSession && accountType && accountType !== 'contributor' && project.isLookingForContributors && (
        <p className="mt-3 text-xs leading-5 text-neutral-500">
          Contributor intent is available to contributor accounts.
        </p>
      )}
      {hasSession && accountType && accountType !== 'investor' && project.isLookingForInvestors && (
        <p className="mt-2 text-xs leading-5 text-neutral-500">
          Investor interest is available to investor accounts.
        </p>
      )}
    </div>
  );
}

function ProjectInterestDialog({
  type,
  message,
  isPending,
  onMessageChange,
  onClose,
  onSubmit,
}: {
  type: InterestType | null;
  message: string;
  isPending: boolean;
  onMessageChange: (message: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const label =
    type === 'contribution'
      ? 'Send contributor interest'
      : type === 'investment'
        ? 'Send investor interest'
        : 'Contact maintainer';

  return (
    <Dialog open={Boolean(type)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-none">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            This creates an owner-visible inbound lead for this project.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="project-interest-message">Message</Label>
          <Textarea
            id="project-interest-message"
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder="Share useful context, availability, or what you want to discuss."
            className="min-h-28 rounded-none"
            disabled={isPending}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-none" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="rounded-none" disabled={isPending} onClick={onSubmit}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectReportDialog({
  open,
  reason,
  details,
  isPending,
  onReasonChange,
  onDetailsChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  reason: string;
  details: string;
  isPending: boolean;
  onReasonChange: (reason: string) => void;
  onDetailsChange: (details: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="rounded-none">
        <DialogHeader>
          <DialogTitle>Report project</DialogTitle>
          <DialogDescription>
            Send this project to moderation review with a clear reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-report-reason">Reason</Label>
            <Textarea
              id="project-report-reason"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Spam, misleading information, unsafe content..."
              className="min-h-20 rounded-none"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-report-details">Details</Label>
            <Textarea
              id="project-report-details"
              value={details}
              onChange={(event) => onDetailsChange(event.target.value)}
              placeholder="Optional details for moderators."
              className="min-h-24 rounded-none"
              disabled={isPending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-none" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-none"
            disabled={isPending || reportReasonIsInvalid(reason)}
            onClick={onSubmit}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function reportReasonIsInvalid(reason: string) {
  return reason.trim().length < 3;
}
