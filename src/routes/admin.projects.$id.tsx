'use client';

import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  GitBranch,
  Inbox,
  Loader2,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Link from '@/components/ui/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  RouteErrorState,
  RouteNotFoundState,
  RoutePendingState,
} from '@/components/layout/route-boundaries';
import { useTRPC } from '@/hooks/use-trpc';
import type { RouterOutputs } from '@/lib/api-types';

export const Route = createFileRoute('/admin/projects/$id')({
  component: AdminProjectDetailPage,
  notFoundComponent: () => (
    <RouteNotFoundState
      title="Admin project not found"
      description="This project review record is not available."
    />
  ),
  pendingComponent: () => <RoutePendingState label="Loading admin project detail" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Admin project could not load"
      description="The project review detail is unavailable right now."
    />
  ),
});

type AdminProjectDetail = RouterOutputs['projects']['getAdminProjectDetail'];

function AdminProjectDetailPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { id } = Route.useParams();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery(trpc.projects.getAdminProjectDetail.queryOptions({ projectId: id }));

  const invalidateProject = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.projects.getAdminProjectDetail.queryKey({ projectId: id }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.projects.getProjects.queryKey({ approvalStatus: 'all' }),
    });
  };

  const approveProject = useMutation({
    ...trpc.projects.acceptProject.mutationOptions(),
    onSuccess: () => {
      toast.success('Project approved');
      invalidateProject();
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || 'Could not approve project');
    },
  });
  const rejectProject = useMutation({
    ...trpc.projects.rejectProject.mutationOptions(),
    onSuccess: () => {
      toast.success('Project rejected');
      setRejectDialogOpen(false);
      invalidateProject();
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || 'Could not reject project');
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Alert className="rounded-none">
        <AlertTriangle className="h-4 w-4" />
        <div>
          <p className="font-medium">Project could not be loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error?.message || 'Refresh the page or return to the project list.'}
          </p>
        </div>
      </Alert>
    );
  }

  const { project } = data;
  const githubStats = project.githubStats;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-none capitalize">
              {project.approvalStatus}
            </Badge>
            <Badge variant={data.claimStatus.claimed ? 'secondary' : 'outline'} className="rounded-none">
              {data.claimStatus.claimed ? 'Claimed' : 'Unclaimed'}
            </Badge>
            {project.deletedAt ? (
              <Badge variant="destructive" className="rounded-none">
                Deleted
              </Badge>
            ) : null}
          </div>
          <h1 className="break-words text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{project.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-none" asChild>
            <Link href="/admin/projects?approvalStatus=all">Back to projects</Link>
          </Button>
          {project.approvalStatus !== 'approved' ? (
            <Button
              className="rounded-none"
              disabled={approveProject.isPending}
              onClick={() => approveProject.mutate({ projectId: project.id })}
            >
              {approveProject.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Approve
            </Button>
          ) : null}
          {project.approvalStatus !== 'rejected' ? (
            <Button
              variant="destructive"
              className="rounded-none"
              disabled={rejectProject.isPending}
              onClick={() => setRejectDialogOpen(true)}
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          ) : null}
        </div>
      </div>

      {githubStats?.fetchStatus === 'failed' ? (
        <Alert variant="destructive" className="rounded-none">
          <AlertTriangle className="h-4 w-4" />
          <div>
            <p className="font-medium">GitHub data could not be refreshed</p>
            <p className="mt-1 text-sm">{githubStats.fetchError || 'Unknown GitHub API error.'}</p>
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard label="Owner" value={data.owner?.name ?? 'Unclaimed'} icon={UserRound} />
        <SummaryCard
          label="Repository"
          value={project.gitRepoUrl}
          icon={GitBranch}
          href={githubStats?.repoHtmlUrl || `https://github.com/${project.gitRepoUrl}`}
        />
        <SummaryCard
          label="Reviewer"
          value={data.reviewer?.name ?? 'Not reviewed'}
          icon={ShieldCheck}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Project data</CardTitle>
            <CardDescription>Submission details used for public discovery.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailRow label="Status" value={project.status} />
            <DetailRow label="Type" value={project.type} />
            <DetailRow label="Host" value={project.gitHost ?? 'unknown'} />
            <DetailRow label="Public" value={project.isPublic ? 'Yes' : 'No'} />
            <DetailRow
              label="Opportunities"
              value={[
                project.isLookingForContributors ? 'contributors' : null,
                project.isLookingForInvestors ? 'investors' : null,
                project.isHiring ? 'hiring' : null,
              ]
                .filter(Boolean)
                .join(', ') || 'None'}
            />
            <div>
              <p className="text-sm font-medium">Tags</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(project.tags ?? []).length > 0 ? (
                  project.tags?.map((tag: string) => (
                    <Badge key={tag} variant="outline" className="rounded-none">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No tags</p>
                )}
              </div>
            </div>
            {project.rejectionReason ? (
              <Alert className="rounded-none bg-transparent">
                <div>
                  <p className="font-medium">Latest rejection reason</p>
                  <p className="mt-1 text-sm text-muted-foreground">{project.rejectionReason}</p>
                </div>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GitHub repository</CardTitle>
            <CardDescription>Cached repo data and API status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailRow label="Fetch status" value={githubStats?.fetchStatus ?? 'not fetched'} />
            <DetailRow label="Stars" value={githubStats?.stargazersCount?.toString() ?? '0'} />
            <DetailRow label="Forks" value={githubStats?.forksCount?.toString() ?? '0'} />
            <DetailRow label="Issues" value={githubStats?.openIssuesCount?.toString() ?? '0'} />
            <DetailRow label="Language" value={githubStats?.language ?? 'unknown'} />
            <DetailRow
              label="Last fetched"
              value={githubStats?.lastFetchedAt ? formatDate(githubStats.lastFetchedAt) : 'Never'}
            />
            {githubStats?.fetchError ? (
              <p className="break-words text-sm text-destructive">{githubStats.fetchError}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <ReviewHistory events={data.reviewEvents} />
      <InterestTable items={data.interests} />
      <ReportsTable items={data.reports} />

      <RejectProjectDialog
        open={rejectDialogOpen}
        isPending={rejectProject.isPending}
        initialReason={project.rejectionReason ?? ''}
        onClose={() => setRejectDialogOpen(false)}
        onReject={(reason) => rejectProject.mutate({ projectId: project.id, reason })}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: string;
  icon: typeof UserRound;
  href?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {href ? (
          <Link
            href={href}
            target="_blank"
            className="inline-flex min-w-0 items-center gap-2 break-all text-lg font-medium hover:underline"
          >
            {value}
            <ExternalLink className="h-4 w-4 shrink-0" />
          </Link>
        ) : (
          <p className="break-words text-lg font-medium">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <p className="text-sm font-medium">{label}</p>
      <p className="break-words text-right text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

function ReviewHistory({ events }: { events: AdminProjectDetail['reviewEvents'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submission history</CardTitle>
        <CardDescription>Review decisions recorded for this project.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No review events yet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((item: any) => (
              <div key={item.event.id} className="border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={item.event.action === 'approved' ? 'secondary' : 'destructive'}
                    className="rounded-none capitalize"
                  >
                    {item.event.action}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    by {item.admin.name} · {formatDate(item.event.createdAt)}
                  </p>
                </div>
                {item.event.reason ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.event.reason}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InterestTable({ items }: { items: AdminProjectDetail['interests'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contributor and investor leads</CardTitle>
        <CardDescription>Interest sent from public project pages.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leads yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => (
                <TableRow key={item.interest.id}>
                  <TableCell>
                    <p className="font-medium">{item.user.name}</p>
                    <p className="text-xs text-muted-foreground">{item.user.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-none capitalize">
                      {item.interest.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.interest.status}</TableCell>
                  <TableCell className="max-w-md whitespace-normal">
                    {item.interest.message ?? 'No message'}
                  </TableCell>
                  <TableCell>{formatDate(item.interest.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ReportsTable({ items }: { items: AdminProjectDetail['reports'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Moderation reports</CardTitle>
        <CardDescription>User-submitted reports for this project.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports for this project.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => (
                <TableRow key={item.report.id}>
                  <TableCell>{item.report.reason}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-none capitalize">
                      {item.report.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.user?.email ?? 'Anonymous'}</TableCell>
                  <TableCell className="max-w-md whitespace-normal">
                    {item.report.details ?? 'No details'}
                  </TableCell>
                  <TableCell>{formatDate(item.report.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RejectProjectDialog({
  open,
  initialReason,
  isPending,
  onClose,
  onReject,
}: {
  open: boolean;
  initialReason: string;
  isPending: boolean;
  onClose: () => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState(initialReason);

  useEffect(() => {
    if (open) {
      setReason(initialReason);
    }
  }, [initialReason, open]);

  const trimmedReason = reason.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isPending) {
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-none">
        <DialogHeader>
          <DialogTitle>Reject project</DialogTitle>
          <DialogDescription>
            Add a clear reason so the owner knows what to fix before resubmitting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="admin-project-rejection-reason">Rejection reason</Label>
          <Textarea
            id="admin-project-rejection-reason"
            className="min-h-32 rounded-none"
            value={reason}
            disabled={isPending}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">Minimum 10 characters.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-none" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="rounded-none"
            disabled={isPending || trimmedReason.length < 10}
            onClick={() => onReject(trimmedReason)}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Reject project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return 'Unknown';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
