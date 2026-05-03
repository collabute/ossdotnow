'use client';

import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, Search, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { RouteErrorState, RoutePendingState } from '@/components/layout/route-boundaries';
import { useTRPC } from '@/hooks/use-trpc';
import type { RouterOutputs } from '@/lib/api-types';
import { userRoles } from '@/lib/project-options';

export const Route = createFileRoute('/admin/users')({
  validateSearch: (search: Record<string, unknown>) => ({
    role: typeof search.role === 'string' ? search.role : 'all',
  }),
  component: AdminUsersDashboard,
  pendingComponent: () => <RoutePendingState label="Loading users" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Users could not load"
      description="User management is unavailable right now."
    />
  ),
});

type AdminUser = RouterOutputs['users']['getUsers'][number];
type UserRole = (typeof userRoles)[number];

function AdminUsersDashboard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { role } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setRole = (nextRole: string) =>
    navigate({
      search: (previous) => ({
        ...previous,
        role: nextRole,
      }),
    });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [userToSuspend, setUserToSuspend] = useState<AdminUser | null>(null);

  const tabs = [...userRoles, 'all'] as const;

  const currentAdmin = useQuery(trpc.user.me.queryOptions());
  const {
    data: users,
    isLoading,
    isError,
    refetch,
  } = useQuery(
    trpc.users.getUsers.queryOptions({
      limit: 100,
      offset: 0,
    }),
  );

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: trpc.users.getUsers.queryKey() });
  };
  const updateRole = useMutation({
    ...trpc.users.updateUserRole.mutationOptions(),
    onSuccess: () => {
      toast.success('User role updated');
      invalidateUsers();
    },
    onError: (error) => {
      toast.error(error.message || 'Could not update role');
    },
  });
  const suspendUser = useMutation({
    ...trpc.users.suspendUser.mutationOptions(),
    onSuccess: () => {
      toast.success('User suspended');
      setUserToSuspend(null);
      invalidateUsers();
    },
    onError: (error) => {
      toast.error(error.message || 'Could not suspend user');
    },
  });
  const unsuspendUser = useMutation({
    ...trpc.users.unsuspendUser.mutationOptions(),
    onSuccess: () => {
      toast.success('User unsuspended');
      invalidateUsers();
    },
    onError: (error) => {
      toast.error(error.message || 'Could not unsuspend user');
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <RouteErrorState
        error={new Error('User management failed to load.')}
        reset={() => {
          void refetch();
        }}
        title="Users could not load"
        description="User management is unavailable right now."
      />
    );
  }
  if (!users) {
    return (
      <div className="border border-border p-6">
        <p className="text-sm text-muted-foreground">No users found.</p>
      </div>
    );
  }

  const filteredUsers = users
    .filter((user) => role === 'all' || user.role === role)
    .filter((user) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      );
    });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Manage user accounts, roles, and permissions</p>
      </div>

      <Tabs className="space-y-4" defaultValue={role}>
        <TabsList className="bg-muted/30">
          {tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="w-28" onClick={() => setRole(tab)}>
              <span className="capitalize">{tab}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  {tab === 'all'
                    ? `Showing all ${filteredUsers.length} users`
                    : `Showing ${filteredUsers.length} ${tab} users`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Search className="text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-64"
                    />
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Account Type</TableHead>
                      <TableHead>Connected</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Projects</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentUsers.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        currentAdminId={currentAdmin.data?.id}
                        isUpdatingRole={updateRole.isPending}
                        isSuspending={suspendUser.isPending && userToSuspend?.id === user.id}
                        isUnsuspending={unsuspendUser.isPending}
                        onRoleChange={(nextRole) =>
                          updateRole.mutate({ userId: user.id, role: nextRole })
                        }
                        onSuspend={() => setUserToSuspend(user)}
                        onUnsuspend={() => unsuspendUser.mutate({ userId: user.id })}
                      />
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">
                    Showing {filteredUsers.length === 0 ? 0 : startIndex + 1}-
                    {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} users
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => prev - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <SuspendUserDialog
        user={userToSuspend}
        isPending={suspendUser.isPending}
        onClose={() => setUserToSuspend(null)}
        onSuspend={(reason) => {
          if (!userToSuspend) return;
          suspendUser.mutate({ userId: userToSuspend.id, reason });
        }}
      />
    </div>
  );
}

function UserRow({
  user,
  currentAdminId,
  isUpdatingRole,
  isSuspending,
  isUnsuspending,
  onRoleChange,
  onSuspend,
  onUnsuspend,
}: {
  user: AdminUser;
  currentAdminId: string | undefined;
  isUpdatingRole: boolean;
  isSuspending: boolean;
  isUnsuspending: boolean;
  onRoleChange: (role: UserRole) => void;
  onSuspend: () => void;
  onUnsuspend: () => void;
}) {
  const isSelf = user.id === currentAdminId;
  const isBanned = Boolean(user.banned);

  return (
    <TableRow>
      <TableCell className="min-w-56">
        <p className="font-medium">{user.name}</p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
        {!user.emailVerified ? (
          <p className="mt-1 text-xs text-amber-600">Email not verified</p>
        ) : null}
      </TableCell>
      <TableCell>
        <Select
          value={user.role}
          disabled={isSelf || isUpdatingRole}
          onValueChange={(value) => onRoleChange(value as UserRole)}
        >
          <SelectTrigger className="w-36 rounded-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {userRoles.map((role) => (
              <SelectItem key={role} value={role}>
                <span className="capitalize">{role}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isSelf ? <p className="mt-1 text-xs text-muted-foreground">Self-protected</p> : null}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="rounded-none capitalize">
          {user.accountType ?? 'not set'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex max-w-56 flex-wrap gap-1">
          {user.connectedProviders.length > 0 ? (
            user.connectedProviders.map((provider: string) => (
              <Badge key={provider} variant="secondary" className="rounded-none">
                {provider}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">None</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant={isBanned ? 'destructive' : 'outline'}
          className={isBanned ? 'rounded-none' : 'rounded-none text-green-600'}
        >
          {isBanned ? 'Suspended' : 'Active'}
        </Badge>
        {user.banReason ? (
          <p className="mt-1 max-w-48 text-xs leading-5 text-muted-foreground">{user.banReason}</p>
        ) : null}
      </TableCell>
      <TableCell>{user.ownedProjectCount}</TableCell>
      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
      <TableCell className="text-right">
        {isBanned ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-none"
            disabled={isUnsuspending}
            onClick={onUnsuspend}
          >
            {isUnsuspending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Unsuspend
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            className="rounded-none"
            disabled={isSelf || isSuspending}
            onClick={onSuspend}
          >
            {isSuspending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            Suspend
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function SuspendUserDialog({
  user,
  isPending,
  onClose,
  onSuspend,
}: {
  user: AdminUser | null;
  isPending: boolean;
  onClose: () => void;
  onSuspend: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (user) {
      setReason('');
    }
  }, [user]);

  const trimmedReason = reason.trim();

  return (
    <Dialog
      open={Boolean(user)}
      onOpenChange={(open) => {
        if (!open && !isPending) {
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-none">
        <DialogHeader>
          <DialogTitle>Suspend user</DialogTitle>
          <DialogDescription>
            This revokes active sessions and blocks access until an admin unsuspends the account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="suspend-reason">Reason</Label>
          <Textarea
            id="suspend-reason"
            className="min-h-28 rounded-none"
            value={reason}
            disabled={isPending}
            placeholder="Explain why this account is being suspended."
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">Minimum 3 characters.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-none" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="rounded-none"
            disabled={isPending || trimmedReason.length < 3}
            onClick={() => onSuspend(trimmedReason)}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Suspend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
