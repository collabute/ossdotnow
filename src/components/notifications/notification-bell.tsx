'use client';

import { Bell, CheckCheck, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from '@/components/ui/link';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useLiveNotifications, type LiveNotification } from '@/hooks/use-live-notifications';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const { notifications, unreadCount, isLoading, markAllRead, markRead } =
    useLiveNotifications();
  const latestNotifications = notifications.slice(0, 5);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative ml-2 rounded-none"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,420px)] rounded-none p-0">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <p className="font-medium">Notifications</p>
            <p className="text-muted-foreground text-xs">
              {unreadCount ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-none"
            disabled={unreadCount === 0}
            onClick={markAllRead}
          >
            <CheckCheck className="h-4 w-4" />
            Mark read
          </Button>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : latestNotifications.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No notifications yet. Project review and interest events will appear here.
            </div>
          ) : (
            latestNotifications.map((notification) => (
              <NotificationPreview
                key={notification.id}
                notification={notification}
                onRead={() => markRead(notification.id)}
              />
            ))
          )}
        </div>

        <div className="border-t border-border p-3">
          <Button variant="outline" className="w-full rounded-none" asChild>
            <Link href="/dashboard/notifications">View notification center</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationPreview({
  notification,
  onRead,
}: {
  notification: LiveNotification;
  onRead: () => void;
}) {
  return (
    <Link
      href={notification.href}
      className={cn(
        'block border-b border-border p-4 transition-colors last:border-b-0 hover:bg-accent',
        !notification.isRead && 'bg-accent/40',
      )}
      onClick={onRead}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-1 h-2 w-2 shrink-0 rounded-full',
            notificationToneClass(notification.tone),
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-medium">{notification.title}</p>
            {!notification.isRead ? (
              <Badge variant="secondary" className="rounded-none">
                New
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {notification.description}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatNotificationDate(notification.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function notificationToneClass(tone: LiveNotification['tone']) {
  if (tone === 'success') return 'bg-emerald-500';
  if (tone === 'warning') return 'bg-amber-500';
  if (tone === 'danger') return 'bg-destructive';
  return 'bg-primary';
}

function formatNotificationDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}
