'use client';

import {
  AlertCircle,
  Clock,
  Folder,
  FolderPlus,
  RefreshCcw,
  UserPlus,
  Users,
  Database,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useTRPC } from '@/hooks/use-trpc';
import { toast } from 'sonner';

function useDashboard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useQuery(trpc.admin.dashboard.queryOptions());

  const updateRepoIds = useMutation(
    trpc.projects.updateRepoIds.mutationOptions({
      onSuccess: (data) => {
        toast.success('Repository IDs Updated', {
          description: `Updated: ${data.totals.updated}, Failed: ${data.totals.failed}, Skipped: ${data.totals.skipped}`,
        });
        queryClient.invalidateQueries({ queryKey: ['admin.dashboard'] });
      },
      onError: () => {
        toast.error('Error', {
          description: 'Failed to update repository IDs',
        });
      },
    }),
  );

  return {
    data,
    updateRepoIds,
  };
}

export default function AdminDashboard() {
  const { data, updateRepoIds } = useDashboard();

  const latestProjects = data?.latestProjects;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage users, projects, categories, and system settings
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.counts.users || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <Folder className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.counts.projects || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.counts.pendingProjects || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Waitlist</CardTitle>
            <AlertCircle className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.counts.earlyAccess || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {latestProjects?.map((item) => (
                <div key={item.id} className="flex items-center">
                  <div className="ml-4 space-y-1">
                    <p className="text-sm leading-none font-normal">
                      New project submitted:{' '}
                      <span className="font-medium">
                        {item.name} {`(${item.gitRepoUrl})`}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Submitted {formatDistanceToNow(item.createdAt)} ago
                    </p>
                  </div>
                  <div className="ml-auto font-medium">
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start" variant="outline">
              <UserPlus className="mr-2 h-4 w-4" />
              Add New Admin
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <FolderPlus className="mr-2 h-4 w-4" />
              Create Category
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Sync GitHub Data
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => updateRepoIds.mutate({ gitHost: 'all' })}
              disabled={updateRepoIds.isPending}
            >
              <Database className="mr-2 h-4 w-4" />
              {updateRepoIds.isPending ? 'Updating Repo IDs...' : 'Update Repository IDs'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
