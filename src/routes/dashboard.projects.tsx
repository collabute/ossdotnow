import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from '@/components/ui/link';
import { useTRPC } from '@/hooks/use-trpc';
import { cn } from '@/lib/utils';
import type { MyProject } from '@/lib/api-types';
import { requireOwnerAccount } from '@/lib/route-guards';
import { RouteErrorState, RoutePendingState } from '@/components/layout/route-boundaries';

export const Route = createFileRoute('/dashboard/projects')({
  beforeLoad: async () => {
    await requireOwnerAccount();
  },
  component: DashboardProjectsPage,
  pendingComponent: () => <RoutePendingState label="Loading your projects" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Your projects could not load"
      description="Your project dashboard is unavailable right now. Try again from the dashboard."
    />
  ),
});

const statusOrder = ['pending', 'approved', 'rejected'] as const;
const statusCopy: Record<
  (typeof statusOrder)[number],
  {
    label: string;
    empty: string;
  }
> = {
  pending: {
    label: 'Pending',
    empty: 'No projects are waiting for review.',
  },
  approved: {
    label: 'Approved',
    empty: 'Approved projects will appear here after review.',
  },
  rejected: {
    label: 'Rejected',
    empty: 'Rejected projects and review notes will appear here.',
  },
};

function DashboardProjectsPage() {
  const location = useLocation();
  const isProjectsIndex = location.pathname.replace(/\/$/, '') === '/dashboard/projects';
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [projectToDelete, setProjectToDelete] = useState<MyProject | null>(null);
  const { data: projects = [], isLoading } = useQuery({
    ...trpc.projects.getMyProjects.queryOptions(),
    enabled: isProjectsIndex,
  });

  const { mutate: deleteProject, isPending: isDeleting } = useMutation({
    ...trpc.projects.deleteMyProject.mutationOptions(),
    onSuccess: () => {
      toast.success('Project deleted');
      setProjectToDelete(null);
      queryClient.invalidateQueries({ queryKey: trpc.projects.getMyProjects.queryKey() });
    },
    onError: (error) => {
      toast.error(error.message || 'Could not delete project');
    },
  });

  const { mutate: resubmitProject, isPending: isResubmitting } = useMutation({
    ...trpc.projects.resubmitMyProject.mutationOptions(),
    onSuccess: () => {
      toast.success('Project resubmitted for review');
      queryClient.invalidateQueries({ queryKey: trpc.projects.getMyProjects.queryKey() });
    },
    onError: (error) => {
      toast.error(error.message || 'Could not resubmit project');
    },
  });

  if (!isProjectsIndex) {
    return <Outlet />;
  }

  if (isLoading) {
    return <ProjectsSkeleton />;
  }

  const projectsByStatus = statusOrder.reduce(
    (groups, status) => {
      groups[status] = projects.filter((project) => project.approvalStatus === status);
      return groups;
    },
    {} as Record<(typeof statusOrder)[number], MyProject[]>,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-medium">My projects</h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Track review state, resubmit rejected projects, and keep approved listings ready for
            discovery.
          </p>
        </div>
        <Button className="w-full rounded-none sm:w-auto" asChild>
          <Link href="/dashboard/projects/new">
            <Plus className="h-4 w-4" />
            New project
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="border border-border/70 bg-card/40 p-6">
          <h3 className="text-xl font-medium">No projects yet</h3>
          <p className="text-muted-foreground mt-2 text-sm">
            Submit your first repository to start the approval flow.
          </p>
        </div>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-3" aria-label="Project review summary">
            {statusOrder.map((status) => (
              <StatusSummaryCard
                key={status}
                status={status}
                count={projectsByStatus[status].length}
              />
            ))}
          </section>

          <div className="space-y-7">
            {statusOrder.map((status) => (
              <ProjectGroup
                key={status}
                status={status}
                projects={projectsByStatus[status]}
                isDeleting={isDeleting}
                isResubmitting={isResubmitting}
                onDelete={setProjectToDelete}
                onResubmit={(id) => resubmitProject({ id })}
              />
            ))}
          </div>
        </>
      )}
      <DeleteProjectDialog
        project={projectToDelete}
        isPending={isDeleting}
        onClose={() => setProjectToDelete(null)}
        onConfirm={() => {
          if (projectToDelete) {
            deleteProject({ id: projectToDelete.id });
          }
        }}
      />
    </div>
  );
}

function ProjectGroup({
  status,
  projects,
  isDeleting,
  isResubmitting,
  onDelete,
  onResubmit,
}: {
  status: MyProject['approvalStatus'];
  projects: MyProject[];
  isDeleting: boolean;
  isResubmitting: boolean;
  onDelete: (project: MyProject) => void;
  onResubmit: (id: string) => void;
}) {
  const statusKey = status as keyof typeof statusCopy;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-medium">{statusCopy[statusKey].label}</h3>
        <Badge variant="outline" className="min-w-8 rounded-none px-2 py-1">
          {projects.length}
        </Badge>
      </div>

      {projects.length === 0 ? (
        <p className="bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
          {statusCopy[statusKey].empty}
        </p>
      ) : (
        <div className="divide-y divide-border/70 border border-border/70 bg-card/40">
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              isDeleting={isDeleting}
              isResubmitting={isResubmitting}
              onDelete={onDelete}
              onResubmit={onResubmit}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function StatusSummaryCard({
  status,
  count,
}: {
  status: (typeof statusOrder)[number];
  count: number;
}) {
  return (
    <div className="flex min-h-28 flex-col justify-between border border-border/70 bg-card/50 p-5">
      <div className="flex items-center gap-2">
        <StatusDot status={status} />
        <p className="text-sm font-medium text-muted-foreground">{statusCopy[status].label}</p>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight">{count}</p>
    </div>
  );
}

function ProjectRow({
  project,
  isDeleting,
  isResubmitting,
  onDelete,
  onResubmit,
}: {
  project: MyProject;
  isDeleting: boolean;
  isResubmitting: boolean;
  onDelete: (project: MyProject) => void;
  onResubmit: (id: string) => void;
}) {
  const status = project.approvalStatus;

  return (
    <article className="p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <h4 className="truncate text-lg font-medium leading-none">{project.name}</h4>
          <StatusBadge status={status} />
          <span className="hidden h-4 w-px bg-border/80 sm:block" aria-hidden="true" />
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {formatRepository(project.gitRepoUrl)}
          </p>
        </div>

        <ProjectStatusTimeline project={project} />

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {status === 'rejected' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              disabled={isResubmitting}
              onClick={() => onResubmit(project.id)}
            >
              <RotateCcw className="h-4 w-4" />
              Resubmit
            </Button>
          )}
          <Button variant="outline" size="sm" className="rounded-none" asChild>
            <Link href={`/dashboard/projects/${project.id}/edit`}>
              <Edit className="h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-none text-destructive hover:text-destructive"
            disabled={isDeleting}
            onClick={() => onDelete(project)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {status === 'rejected' && project.rejectionReason && (
        <div className="mt-3 border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive">
          <span className="font-medium">Review reason: </span>
          {project.rejectionReason}
        </div>
      )}
    </article>
  );
}

function ProjectStatusTimeline({ project }: { project: MyProject }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground lg:justify-end lg:whitespace-nowrap">
      <MetadataItem label="Submitted" value={formatProjectDate(project.createdAt)} />
      {project.reviewedAt && (
        <MetadataItem
          label="Reviewed"
          value={`${formatProjectDate(project.reviewedAt)} as ${project.approvalStatus}`}
        />
      )}
      <MetadataItem label="Updated" value={formatProjectDate(project.updatedAt)} />
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground/80">{value}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: MyProject['approvalStatus'] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-none px-2 py-1 text-xs capitalize',
        status === 'pending' && 'border-amber-400/20 bg-amber-400/10 text-amber-200',
        status === 'approved' && 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
        status === 'rejected' && 'border-rose-400/20 bg-rose-400/10 text-rose-200',
      )}
    >
      {status}
    </Badge>
  );
}

function StatusDot({ status }: { status: MyProject['approvalStatus'] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'size-2 rounded-full',
        status === 'pending' && 'bg-amber-300',
        status === 'approved' && 'bg-emerald-300',
        status === 'rejected' && 'bg-rose-300',
      )}
    />
  );
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="h-7 w-36 animate-pulse bg-muted" />
          <div className="h-4 w-96 max-w-full animate-pulse bg-muted" />
        </div>
        <div className="h-9 w-32 animate-pulse bg-muted" />
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        {statusOrder.map((status) => (
          <div key={status} className="min-h-28 border border-border/70 bg-card/50 p-5">
            <div className="h-4 w-24 animate-pulse bg-muted" />
            <div className="mt-5 h-8 w-10 animate-pulse bg-muted" />
          </div>
        ))}
      </section>

      <div className="space-y-4">
        <div className="h-6 w-32 animate-pulse bg-muted" />
        <div className="h-28 border border-border/70 bg-card/40" />
      </div>
    </div>
  );
}

function formatProjectDate(value: string | Date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatRepository(repoUrl: string) {
  return repoUrl
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');
}

function DeleteProjectDialog({
  project,
  isPending,
  onClose,
  onConfirm,
}: {
  project: MyProject | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={Boolean(project)}
      onOpenChange={(open) => {
        if (!open && !isPending) {
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-none">
        <DialogHeader>
          <DialogTitle>Delete project?</DialogTitle>
          <DialogDescription>
            This soft-deletes {project?.name ?? 'this project'} from your dashboard and removes it
            from public discovery.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" className="rounded-none" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-none"
            disabled={isPending}
            onClick={onConfirm}
          >
            <Trash2 className="h-4 w-4" />
            Delete project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
