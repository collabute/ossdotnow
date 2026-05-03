'use client';

import { createFileRoute } from '@tanstack/react-router';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RouteErrorState, RoutePendingState } from '@/components/layout/route-boundaries';
import Link from '@/components/ui/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useLiveNotifications,
  type LiveNotification,
} from '@/hooks/use-live-notifications';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/dashboard/notifications')({
  component: DashboardNotifications,
  pendingComponent: () => <RoutePendingState label="Loading notifications" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Notifications could not load"
      description="Your notification center is unavailable right now."
    />
  ),
});

type NotificationFilter = 'all' | 'unread' | 'read';

function DashboardNotifications() {
  const {
    notifications,
    unreadCount,
    readCount,
    isLoading,
    markAllRead,
    markRead,
    markUnread,
  } = useLiveNotifications();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter((notification) => !notification.isRead);
    if (filter === 'read') return notifications.filter((notification) => notification.isRead);
    return notifications;
  }, [filter, notifications]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <h2 className="text-xl font-medium">Notification center</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Project review, ownership, and interest events from your live dashboard.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-fit rounded-none"
          disabled={unreadCount === 0}
          onClick={markAllRead}
        >
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </Button>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <NotificationMetric label="Total" value={notifications.length} />
        <NotificationMetric label="Unread" value={unreadCount} />
        <NotificationMetric label="Read" value={readCount} />
      </section>

      <section className="border border-border">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {notificationFilters.map((item) => (
              <Button
                key={item.value}
                type="button"
                variant={filter === item.value ? 'default' : 'outline'}
                className="rounded-none"
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {filteredNotifications.length} visible notification
            {filteredNotifications.length === 1 ? '' : 's'}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground">
            No notifications in this view yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNotifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onRead={() => markRead(notification.id)}
                  onUnread={() => markUnread(notification.id)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

const notificationFilters: Array<{ value: NotificationFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

function NotificationMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-medium">{value}</p>
    </div>
  );
}

function NotificationRow({
  notification,
  onRead,
  onUnread,
}: {
  notification: LiveNotification;
  onRead: () => void;
  onUnread: () => void;
}) {
  return (
    <TableRow className={cn(!notification.isRead && 'bg-accent/40')}>
      <TableCell>
        <Badge variant={notification.isRead ? 'outline' : 'secondary'} className="rounded-none">
          {notification.isRead ? 'Read' : 'Unread'}
        </Badge>
      </TableCell>
      <TableCell className="min-w-[280px] whitespace-normal">
        <Link
          href={notification.href}
          className="font-medium hover:underline"
          onClick={onRead}
        >
          {notification.title}
        </Link>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
          {notification.description}
        </p>
      </TableCell>
      <TableCell className="max-w-[220px] truncate">{notification.sourceLabel}</TableCell>
      <TableCell>{formatNotificationDate(notification.createdAt)}</TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-none"
          onClick={notification.isRead ? onUnread : onRead}
        >
          {notification.isRead ? 'Mark unread' : 'Mark read'}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function formatNotificationDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}
