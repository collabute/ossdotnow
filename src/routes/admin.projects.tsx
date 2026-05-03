'use client';

import { createFileRoute } from '@tanstack/react-router';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Eye, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import Link from '@/components/ui/link';
import NumberFlow from '@number-flow/react';
import type { Project } from '@/lib/api-types';
import { RouteErrorState, RoutePendingState } from '@/components/layout/route-boundaries';
import {
  projectApprovalStatuses,
  projectStatuses,
  projectTags,
  projectTypes,
} from '@/lib/project-options';
import { useTRPC } from '@/hooks/use-trpc';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/projects')({
  validateSearch: (search: Record<string, unknown>) => ({
    approvalStatus:
      typeof search.approvalStatus === 'string' ? search.approvalStatus : 'all',
  }),
  component: AdminProjectsDashboard,
  pendingComponent: () => <RoutePendingState label="Loading project review queue" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Project review could not load"
      description="The admin project queue is unavailable right now."
    />
  ),
});

function AdminProjectsDashboard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { approvalStatus } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setApprovalStatus = (status: string) =>
    navigate({
      search: (previous) => ({
        ...previous,
        approvalStatus: status,
      }),
    });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [projectToReject, setProjectToReject] = useState<Project | null>(null);

  const {
    data: projects,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.projects.getProjects.queryOptions({ approvalStatus: 'all' }));

  const invalidateProjects = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.projects.getProjects.queryKey({ approvalStatus: 'all' }),
    });
  };

  const { mutate: acceptProject } = useMutation({
    ...trpc.projects.acceptProject.mutationOptions(),
    onSuccess: () => {
      toast.success('Project approved');
      invalidateProjects();
    },
    onError: (error) => {
      toast.error(error.message || 'Could not approve project');
    },
  });

  const { mutate: rejectProject, isPending: isRejecting } = useMutation({
    ...trpc.projects.rejectProject.mutationOptions(),
    onSuccess: () => {
      toast.success('Project rejected');
      setProjectToReject(null);
      invalidateProjects();
    },
    onError: (error) => {
      toast.error(error.message || 'Could not reject project');
    },
  });

  if (isLoading) return <RoutePendingState label="Loading project review queue" />;
  if (isError) {
    return (
      <RouteErrorState
        error={new Error('Project review queue failed to load.')}
        reset={() => {
          void refetch();
        }}
        title="Project review could not load"
        description="The admin project queue is unavailable right now."
      />
    );
  }
  if (!projects) return <EmptyAdminState title="No projects found" />;

  const handleAccept = (projectId: string) => {
    acceptProject({ projectId });
  };

  const handleReject = (projectId: string, reason: string) => {
    rejectProject({ projectId, reason });
  };

  const tabs = [...projectApprovalStatuses, 'all'] as const;

  const filteredProjects = projects
    .filter((project) => approvalStatus === 'all' || project.approvalStatus === approvalStatus)
    .filter((project) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        project.name.toLowerCase().includes(searchLower) ||
        (project.gitRepoUrl?.toLowerCase().includes(searchLower) ?? false)
      );
    })
    .filter((project) => statusFilter === 'all' || project.status === statusFilter)
    .filter((project) => typeFilter === 'all' || project.type === typeFilter)
    .filter((project) => tagFilter === 'all' || project.tags?.includes(tagFilter as any));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">Review, approve, and manage project submissions</p>
      </div>

      <Tabs className="space-y-4" defaultValue={approvalStatus}>
        <TabsList className="bg-muted/30">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="w-28"
              onClick={() => setApprovalStatus(tab)}
            >
              <span className="capitalize">{tab}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Project Management</CardTitle>
                <CardDescription>
                  {tab === 'all' ? (
                    <span>
                      Showing all <NumberFlow value={filteredProjects.length} /> projects.
                    </span>
                  ) : (
                    <span>
                      Showing <NumberFlow value={filteredProjects.length} /> {tab} projects.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Input
                      placeholder="Search projects..."
                      className="w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {projectStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {projectTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={tagFilter} onValueChange={setTagFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tags</SelectItem>
                        {projectTags.map((tag) => (
                          <SelectItem key={tag} value={tag}>
                            {tag}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      disabled={
                        searchQuery === '' &&
                        statusFilter === 'all' &&
                        typeFilter === 'all' &&
                        tagFilter === 'all'
                      }
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                        setTypeFilter('all');
                        setTagFilter('all');
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <ProjectsTable
                  projects={filteredProjects.filter(
                    (project) =>
                      project.approvalStatus === (tab as Project['approvalStatus']) ||
                      tab === 'all',
                  )}
                  handleAccept={handleAccept}
                  handleReject={setProjectToReject}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      <RejectProjectDialog
        project={projectToReject}
        isPending={isRejecting}
        onClose={() => setProjectToReject(null)}
        onReject={(reason) => {
          if (!projectToReject) return;
          handleReject(projectToReject.id, reason);
        }}
      />
    </div>
  );
}

function EmptyAdminState({ title }: { title: string }) {
  return (
    <div className="border border-border p-6">
      <p className="text-sm text-muted-foreground">{title}</p>
    </div>
  );
}

function ProjectsTable({
  projects,
  handleAccept,
  handleReject,
}: {
  projects: Project[];
  handleAccept: (projectId: string) => void;
  handleReject: (project: Project) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project Name</TableHead>
          <TableHead>Claimed</TableHead>
          <TableHead>Repo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Approval</TableHead>
          <TableHead>Reviewed</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <TableRow key={project.id}>
            <TableCell className="font-medium">{project.name}</TableCell>
            <TableCell>
              <Badge variant="secondary">{project.ownerId ? 'Claimed' : 'Unclaimed'}</Badge>
            </TableCell>
            <TableCell>{project.gitRepoUrl || 'N/A'}</TableCell>
            <TableCell>
              <p>{project.status}</p>
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  project.approvalStatus === 'approved'
                    ? 'default'
                    : project.approvalStatus === 'rejected'
                      ? 'destructive'
                      : 'outline'
                }
                className={
                  project.approvalStatus === 'approved'
                    ? 'bg-green-500'
                    : project.approvalStatus === 'pending'
                      ? 'bg-orange-500'
                      : ''
                }
              >
                {project.approvalStatus}
              </Badge>
              {project.approvalStatus === 'rejected' && project.rejectionReason && (
                <p className="text-muted-foreground mt-2 max-w-80 text-xs leading-5">
                  {project.rejectionReason}
                </p>
              )}
            </TableCell>
            <TableCell>
              {project.reviewedAt ? (
                <div className="text-sm">
                  <p>{new Date(project.reviewedAt).toLocaleDateString()}</p>
                  {project.reviewedById && (
                    <p className="text-muted-foreground text-xs">
                      by {project.reviewedById.slice(0, 8)}
                    </p>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">Not reviewed</span>
              )}
            </TableCell>
            <TableCell>{project.type}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                {project?.tags?.map((tag: string) => (
                  <Badge variant="outline" key={tag}>
                    {tag}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {project.approvalStatus === 'pending' && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-green-600"
                      onClick={() => handleAccept(project.id)}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => handleReject(project)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {project.approvalStatus === 'approved' && (
                  <Button variant="secondary" size="sm" asChild>
                    <Link target="_blank" href={`/projects/${project.id}`}>
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/projects/${project.id}`}>
                    <Eye className="mr-1 h-4 w-4" />
                    Review
                  </Link>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RejectProjectDialog({
  project,
  isPending,
  onClose,
  onReject,
}: {
  project: Project | null;
  isPending: boolean;
  onClose: () => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (project) {
      setReason(project.rejectionReason ?? '');
    }
  }, [project]);

  const trimmedReason = reason.trim();

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
          <DialogTitle>Reject Project</DialogTitle>
          <DialogDescription>
            Add a clear reason so the owner knows what to fix before resubmitting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rejection-reason">Rejection reason</Label>
          <Textarea
            id="rejection-reason"
            className="min-h-32 rounded-none"
            value={reason}
            disabled={isPending}
            placeholder="Explain what needs to change before this project can be approved."
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">Minimum 10 characters.</p>
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
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Reject Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
