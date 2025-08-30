'use client';

import {
  AlertCircle,
  ArrowUp,
  ExternalLink,
  GitFork,
  GitPullRequest,
  Star,
  Users,
  Trash2,
  Clock,
  CheckCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MarkdownTextarea } from '@/components/project/markdown-textarea';
import { Separator } from '@workspace/ui/components/separator';
import { useLaunchUpdates } from '@/hooks/use-launch-updates';
import { projectProviderEnum } from '@workspace/db/schema';
import { Button } from '@workspace/ui/components/button';
import { useRouter, usePathname } from 'next/navigation';
import { Input } from '@workspace/ui/components/input';
import { useCountdown } from '@/hooks/use-countdown';
import { authClient } from '@workspace/auth/client';
import Link from '@workspace/ui/components/link';
import { formatDistanceToNow } from 'date-fns';
import { useTRPC } from '@/hooks/use-trpc';
import { useState } from 'react';
import { toast } from 'sonner';
import {isValidProvider} from '@/lib/constants'

interface LaunchSidebarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  launch: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any;
  projectId: string;
}

export default function LaunchSidebar({ launch, project, projectId }: LaunchSidebarProps) {
  const { data: session } = authClient.useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const router = useRouter();
  const currentPath = usePathname();
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState<string>(launch?.detailedDescription ?? '');
  const [editTagline, setEditTagline] = useState<string>(launch?.tagline ?? '');
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('');

  const { launch: realtimeLaunch } = useLaunchUpdates({ projectId });
  const currentLaunch = realtimeLaunch || launch;

  const { timeRemaining, isExpired } = useCountdown(
    currentLaunch?.status === 'scheduled' ? currentLaunch.launchDate : null,
  );

  // Validate gitRepoUrl and gitHost before using them in queries
  const isValidRepoUrl = Boolean(project?.gitRepoUrl && project.gitRepoUrl.trim() !== '');
  const isValidGitHost = isValidProvider(project?.gitHost);

  // Fetch repository data
  const repoQuery = useQuery(
    trpc.repository.getRepo.queryOptions(
      {
        url: project?.gitRepoUrl as string,
        provider: project?.gitHost as (typeof projectProviderEnum.enumValues)[number],
      },
      {
        enabled: isValidRepoUrl && isValidGitHost,
        retry: false,
      },
    ),
  );

  const repoDataQuery = useQuery(
    trpc.repository.getRepoData.queryOptions(
      {
        url: project?.gitRepoUrl as string,
        provider: project?.gitHost as (typeof projectProviderEnum.enumValues)[number],
      },
      {
        enabled: !!repoQuery.data && isValidRepoUrl && isValidGitHost,
        retry: false,
      },
    ),
  );

  const voteMutation = useMutation({
    ...trpc.launches.voteProject.mutationOptions(),
    onSuccess: () => {
      toast.success('Vote recorded!');
      // Refetch launch data to update vote count
      queryClient.invalidateQueries({
        queryKey: trpc.launches.getLaunchByProjectId.queryKey({ projectId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.launches.getTodayLaunches.queryKey(),
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: trpc.launches.getYesterdayLaunches.queryKey(),
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: trpc.launches.getAllLaunches.queryKey(),
        exact: false,
      });
    },
    onError: () => {
      toast.error('Failed to vote. Please try again.');
    },
  });

  const removeLaunchMutation = useMutation({
    ...trpc.launches.removeLaunch.mutationOptions(),
    onSuccess: () => {
      toast.success('Launch removed successfully!');
      queryClient.invalidateQueries({
        queryKey: trpc.launches.getTodayLaunches.queryKey({ limit: 50 }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.launches.getYesterdayLaunches.queryKey({ limit: 50 }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.launches.getLaunchesByDateRange.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.launches.getLaunchByProjectId.queryKey({ projectId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.launches.getUserScheduledLaunches.queryKey(),
      });
      router.push('/launches');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove launch. Please try again.');
    },
  });

  const editDescriptionMutation = useMutation({
    ...trpc.launches.updateLaunchDescription.mutationOptions(),
    onSuccess: () => {
      toast.success('Launch description updated');
      queryClient.invalidateQueries({
        queryKey: trpc.launches.getLaunchByProjectId.queryKey({ projectId }),
      });
      setEditOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update description. Please try again.');
    },
  });

  const editScheduledMutation = useMutation({
    ...trpc.launches.updateScheduledLaunchDetails.mutationOptions(),
    onSuccess: () => {
      toast.success('Launch updated');
      queryClient.invalidateQueries({
        queryKey: trpc.launches.getLaunchByProjectId.queryKey({ projectId }),
      });
      setEditOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update launch. Please try again.');
    },
  });

  const handleVote = async () => {
    if (!session?.user) {
      router.push(`/login?redirect=${currentPath}`);
      toast.error('Please login to vote');
      return;
    }
    voteMutation.mutate({ projectId });
  };

  const handleRemoveLaunch = () => {
    setShowRemoveModal(true);
  };

  const handleConfirmRemoval = () => {
    const projectName = getProjectName();
    if (confirmationInput === projectName) {
      removeLaunchMutation.mutate({ projectId });
      setShowRemoveModal(false);
      setConfirmationInput('');
    } else {
      toast.error(`Please type "${projectName}" to confirm removal`);
    }
  };

  const handleCancelRemoval = () => {
    setShowRemoveModal(false);
    setConfirmationInput('');
  };

  const getProjectName = () => {
    return currentLaunch?.name || project?.name || 'project-name';
  };

  function adjustMinutes(minutesToAdd: number) {
    // Base from editDate/editTime if present, else from current scheduled date
    let base =
      currentLaunch?.status === 'scheduled' && currentLaunch.launchDate
        ? new Date(currentLaunch.launchDate)
        : new Date();
    if (editDate) {
      const candidate = new Date(`${editDate}T${editTime || '00:00'}:00`);
      if (!isNaN(candidate.getTime())) base = candidate;
    }
    base.setMinutes(base.getMinutes() + minutesToAdd);

    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, '0');
    const dd = String(base.getDate()).padStart(2, '0');
    const HH = String(base.getHours()).padStart(2, '0');
    const MM = String(base.getMinutes()).padStart(2, '0');
    setEditDate(`${yyyy}-${mm}-${dd}`);
    setEditTime(`${HH}:${MM}`);
  }

  const isOwner = session?.user?.id === currentLaunch.owner?.id;

  const repoData = repoQuery.data;
  const repoStats = repoDataQuery.data;
  const contributors = repoStats?.contributors;
  const issuesCount = repoStats?.issuesCount || 0;
  const pullRequestsCount = repoStats?.pullRequestsCount || 0;

  return (
    <div className="flex flex-col gap-4 lg:col-span-1">
      {/* Main Info Card */}
      <div className="border border-neutral-800 bg-neutral-900/50 p-4 md:p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Launch Info</h2>

        {/* Launch Status */}
        {currentLaunch.status === 'scheduled' && !isExpired && (
          <div className="mb-4 flex items-center gap-2 rounded-none border border-orange-500/20 bg-orange-500/10 px-3 py-2">
            <Clock className="h-4 w-4 text-orange-400" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-orange-400">Launches in:</span>
              <span className="text-sm font-bold text-orange-300">{timeRemaining}</span>
            </div>
          </div>
        )}

        {/* Vote Button */}
        <div className="mb-6">
          <Button
            variant={currentLaunch.hasVoted ? 'default' : 'outline'}
            size="lg"
            className={`flex h-12 w-full items-center justify-center gap-3 rounded-none ${
              currentLaunch.hasVoted ? 'bg-orange-500 hover:bg-orange-600' : ''
            }`}
            onClick={handleVote}
            disabled={voteMutation.isPending}
          >
            <ArrowUp className="h-5 w-5" />
            <span className="text-xl font-bold">{currentLaunch.voteCount}</span>
            <span className="text-sm">VOTES</span>
          </Button>
        </div>

        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-neutral-300">Details</h3>
          <div className="space-y-2 text-sm">
            {currentLaunch.launchDate && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">
                  {currentLaunch.status === 'scheduled' && !isExpired
                    ? 'Scheduled For'
                    : 'Launch Date'}
                </span>
                <span className="text-neutral-300">
                  {currentLaunch.status === 'scheduled' && !isExpired
                    ? formatDistanceToNow(new Date(currentLaunch.launchDate), { addSuffix: true })
                    : `${formatDistanceToNow(new Date(currentLaunch.launchDate))} ago`}
                </span>
              </div>
            )}
            {currentLaunch.owner?.name && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Owner</span>
                <span className="text-neutral-300">{currentLaunch.owner.name}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Status</span>
              <div className="flex items-center gap-1">
                {currentLaunch.status === 'scheduled' && !isExpired ? (
                  <>
                    <Clock className="h-3 w-3 text-orange-400" />
                    <span className="text-orange-400">Scheduled</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-400" />
                    <span className="text-green-400">Live</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-6 bg-neutral-700/40" />

        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-neutral-300">Repository Stats</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-neutral-400">
                <Star className="h-4 w-4" />
                <span className="text-sm">Stars</span>
              </div>
              <span className="text-sm font-medium">
                {repoData?.stargazers_count || repoData?.star_count || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-neutral-400">
                <GitFork className="h-4 w-4" />
                <span className="text-sm">Forks</span>
              </div>
              <span className="text-sm font-medium">{repoData?.forks_count || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-neutral-400">
                <Users className="h-4 w-4" />
                <span className="text-sm">Contributors</span>
              </div>
              <span className="text-sm font-medium">{contributors?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-neutral-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Open Issues</span>
              </div>
              <span className="text-sm font-medium">{issuesCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-neutral-400">
                <GitPullRequest className="h-4 w-4" />
                <span className="text-sm">Open PRs</span>
              </div>
              <span className="text-sm font-medium">{pullRequestsCount}</span>
            </div>
          </div>
        </div>

        {/* Tags */}
        {currentLaunch.tags && currentLaunch.tags.length > 0 && (
          <>
            <Separator className="my-6 bg-neutral-700/40" />
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-medium text-neutral-300">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {currentLaunch.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="rounded-none bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:bg-neutral-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="space-y-3">
          <Button variant="outline" className="w-full gap-2 rounded-none" asChild>
            <Link href={`/projects/${projectId}`}>
              <ExternalLink className="h-4 w-4" />
              View Project
            </Link>
          </Button>
          {isOwner && (
            <>
              <Button
                variant="outline"
                className="w-full gap-2 rounded-none"
                onClick={() => {
                  setEditValue(currentLaunch?.detailedDescription ?? '');
                  setEditTagline(currentLaunch?.tagline ?? '');
                  if (currentLaunch?.status === 'scheduled' && currentLaunch.launchDate) {
                    const d = new Date(currentLaunch.launchDate);
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    const HH = String(d.getHours()).padStart(2, '0');
                    const MM = String(d.getMinutes()).padStart(2, '0');
                    setEditDate(`${yyyy}-${mm}-${dd}`);
                    setEditTime(`${HH}:${MM}`);
                  } else {
                    setEditDate('');
                    setEditTime('');
                  }
                  setEditOpen(true);
                }}
              >
                {currentLaunch.status === 'scheduled' ? 'Edit Launch' : 'Edit Description'}
              </Button>
              <Button
                variant="destructive"
                className="w-full gap-2 rounded-none"
                onClick={handleRemoveLaunch}
                disabled={removeLaunchMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                {removeLaunchMutation.isPending ? 'Removing...' : 'Remove Launch'}
              </Button>
            </>
          )}
        </div>
      </div>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-none sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {currentLaunch.status === 'scheduled'
                ? 'Edit Scheduled Launch'
                : 'Edit Launch Description'}
            </DialogTitle>
            <DialogDescription>
              {currentLaunch.status === 'scheduled'
                ? 'You can update the tagline and description before it goes live.'
                : 'Only the description can be updated while live. Markdown is supported.'}
            </DialogDescription>
          </DialogHeader>

          {currentLaunch.status === 'scheduled' && (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-neutral-300">Tagline</label>
              <Input
                value={editTagline}
                onChange={(e) => setEditTagline(e.target.value)}
                placeholder="Concise one-line tagline"
                className="rounded-none"
              />
              <p className="mt-1 text-xs text-neutral-400">10–100 characters.</p>
            </div>
          )}

          {currentLaunch.status === 'scheduled' && (
            <div className="mb-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[260px]">
                  <label className="mb-2 block text-sm font-medium text-neutral-300">Date</label>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="rounded-none"
                  />
                </div>
                <div className="min-w-[200px]">
                  <label className="mb-2 block text-sm font-medium text-neutral-300">Time</label>
                  <Input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="rounded-none"
                  />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="rounded-none"
                    onClick={() => adjustMinutes(5)}
                    type="button"
                  >
                    +5 min
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-none"
                    onClick={() => adjustMinutes(10)}
                    type="button"
                  >
                    +10 min
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-none"
                    onClick={() => adjustMinutes(30)}
                    type="button"
                  >
                    +30 min
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-none"
                    onClick={() => adjustMinutes(60)}
                    type="button"
                  >
                    +1 hour
                  </Button>
                </div>
              </div>
            </div>
          )}

          <MarkdownTextarea
            value={editValue}
            onChange={setEditValue}
            placeholder="Write your launch description..."
            className="rounded-none"
          />

          <div className="flex justify-end gap-3">
            <Button variant="ghost" className="rounded-none" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-none"
              disabled={
                (currentLaunch.status === 'scheduled'
                  ? editScheduledMutation.isPending ||
                    editTagline.length < 10 ||
                    editTagline.length > 100
                  : editDescriptionMutation.isPending) || (editValue?.length ?? 0) < 25
              }
              onClick={() => {
                if (currentLaunch.status === 'scheduled') {
                  const launchDate = editDate
                    ? new Date(`${editDate}T${editTime || '00:00'}:00`)
                    : undefined;
                  editScheduledMutation.mutate({
                    projectId,
                    tagline: editTagline,
                    detailedDescription: editValue ?? '',
                    launchDate,
                    launchTime: editTime || undefined,
                  });
                } else {
                  editDescriptionMutation.mutate({
                    projectId,
                    detailedDescription: editValue ?? '',
                  });
                }
              }}
            >
              {(
                currentLaunch.status === 'scheduled'
                  ? editScheduledMutation.isPending
                  : editDescriptionMutation.isPending
              )
                ? 'Saving...'
                : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showRemoveModal} onOpenChange={setShowRemoveModal}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="h-5 w-5" />
              Remove Launch
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              This will permanently remove the launch and this action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm text-neutral-300">
                Type{' '}
                <span className="font-mono font-semibold text-red-400">{getProjectName()}</span> to
                confirm removal:
              </p>
              <Input
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && confirmationInput === getProjectName()) {
                    handleConfirmRemoval();
                  } else if (e.key === 'Escape') {
                    handleCancelRemoval();
                  }
                }}
                placeholder={getProjectName()}
                className="rounded-none bg-red-500/10 text-white placeholder:text-red-400/60 focus:ring-offset-0 focus-visible:ring-0"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="destructive"
                className="rounded-none"
                onClick={handleConfirmRemoval}
                disabled={confirmationInput !== getProjectName() || removeLaunchMutation.isPending}
              >
                {removeLaunchMutation.isPending ? 'Removing...' : 'Remove Launch'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
