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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Mail, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RouteErrorState, RoutePendingState } from '@/components/layout/route-boundaries';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/hooks/use-trpc';
import { useState } from 'react';

export const Route = createFileRoute('/admin/waitlist')({
  component: AdminWaitlistDashboard,
  pendingComponent: () => <RoutePendingState label="Loading archived waitlist" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Archived waitlist could not load"
      description="The archived waitlist history is unavailable right now."
    />
  ),
});

type User = {
  id: string;
  email: string;
  joinedAt: Date;
};

function AdminWaitlistDashboard() {
  const trpc = useTRPC();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: waitlistData,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.earlyAccess.getWaitlist.queryOptions());

  if (isLoading) return <RoutePendingState label="Loading archived waitlist" />;
  if (isError) {
    return (
      <RouteErrorState
        error={new Error('Archived waitlist failed to load.')}
        reset={() => {
          void refetch();
        }}
        title="Archived waitlist could not load"
        description="The archived waitlist history is unavailable right now."
      />
    );
  }
  if (!waitlistData) {
    return (
      <div className="border border-border p-6">
        <p className="text-sm text-muted-foreground">No archived waitlist entries found.</p>
      </div>
    );
  }

  const filteredWaitlist = waitlistData.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    return user.email.toLowerCase().includes(searchLower);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Archived Waitlist</h1>
        <p className="text-muted-foreground">
          Read-only history from the early access launch period
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Waitlist History</CardTitle>
          <CardDescription>
            {searchQuery
              ? `Showing ${filteredWaitlist.length} of ${waitlistData.length} waitlist entries`
              : `Total ${waitlistData.length} entries in waitlist`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Search className="text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-blue-600">
                <Mail className="mr-1 h-3 w-3" />
                {waitlistData.length} Total
              </Badge>
            </div>
          </div>

          <WaitlistTable users={filteredWaitlist} />
        </CardContent>
      </Card>
    </div>
  );
}

function WaitlistTable({ users }: { users: User[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Submitted</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.email}</TableCell>
            <TableCell>
              <Badge variant="outline">
                Archived
              </Badge>
            </TableCell>
            <TableCell>{new Date(user.joinedAt).toLocaleDateString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
