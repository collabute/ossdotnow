'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import { Bell, Calendar, MessageSquare, CheckCheck } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { Button } from '@workspace/ui/components/button';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@workspace/ui/lib/utils';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface NotificationItemProps {
  notification: {
    id: string;
    type: 'launch_scheduled' | 'launch_live' | 'comment_received';
    title: string;
    message: string;
    read: boolean;
    createdAt: Date;
    data?: {
      projectId?: string;
      commentId?: string;
      launchId?: string;
      [key: string]: unknown;
    } | null;
  };
  onMarkAsRead: (id: string) => void;
}

function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const router = useRouter();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'launch_scheduled':
      case 'launch_live':
        return <Calendar className="h-4 w-4 text-blue-400" />;
      case 'comment_received':
        return <MessageSquare className="h-4 w-4 text-green-400" />;
      default:
        return <Bell className="h-4 w-4 text-yellow-400" />;
    }
  };

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }

      // Navigate based on notification type
    if (notification.data?.projectId) {
      if (notification.type === 'comment_received') {
        router.push(`/launches/${notification.data.projectId}#comments`);
      } else {
        router.push(`/launches/${notification.data.projectId}`);
      }
    }
  };

  const timeAgo = formatDistanceToNow(notification.createdAt, { addSuffix: false });
  const displayTime = timeAgo.includes('less than') ? 'now' : timeAgo;

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-none border-b border-neutral-800 px-4 py-3 last:border-b-0 hover:bg-neutral-800/50',
        !notification.read && 'bg-neutral-800/30',
      )}
    >
      {/* Icon */}
      {getNotificationIcon(notification.type)}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'mb-1 text-sm leading-5',
                !notification.read ? 'font-medium text-white' : 'text-neutral-300',
              )}
            >
              {notification.title}
            </p>
            <p className="text-sm leading-5 text-neutral-400">{notification.message}</p>
          </div>

          {/* Time and unread indicator */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="text-xs text-neutral-500">{displayTime}</span>
            {!notification.read && <div className="h-2 w-2 rounded-full bg-blue-500" />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationsDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading, hasError } =
    useNotifications();
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  if (isLoading) {
    return null;
  }

  const shouldShowCaughtUpState =
    unreadCount === 0 && notifications.length > 0 && !showAllNotifications;

  const displayNotifications = shouldShowCaughtUpState ? [] : notifications;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) {
          setShowAllNotifications(false);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative rounded-none border-0 p-2 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          title={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        >
          <Bell className="h-6 w-6" />
          {unreadCount > 0 && (
            <div className="absolute top-1 right-1 h-1 w-1 rounded-full bg-green-500"></div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-80 rounded-none border-neutral-800 bg-neutral-900 sm:w-96"
        side="bottom"
        align="end"
        sideOffset={4}
        alignOffset={0}
        avoidCollisions={true}
        collisionPadding={16}
      >
        {/* Header */}
        <div className="p-3 pb-1">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Notifications</h3>
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" onClick={markAllAsRead} className="gap-2 rounded-none border">
                <CheckCheck className="h-4 w-4" />
                Mark all as read
              </Button>
            )}
          </div>

          {/* Tab Buttons - Show when there are unread notifications OR when showing all notifications */}
          {(unreadCount > 0 || showAllNotifications) && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllNotifications(false)}
                className={cn(
                  'rounded-none px-4',
                  !showAllNotifications && 'border border-neutral-600',
                )}
              >
                Unread
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllNotifications(true)}
                className={cn(
                  'rounded-none px-4',
                  showAllNotifications && 'border border-neutral-600',
                )}
              >
                All
              </Button>
            </div>
          )}
        </div>

        <div className="scrollbar-hide max-h-80 overflow-y-auto">
          {hasError ? (
            <div className="px-3 py-6 text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-red-500" />
              <p className="mb-2 text-sm text-red-400">Failed to load notifications</p>
              <p className="text-xs text-neutral-500">Please try again or check your connection</p>
            </div>
          ) : shouldShowCaughtUpState ? (
            <div className="px-3 py-6 text-center">
              <Bell className="mx-auto mb-3 h-8 w-8 text-green-500" />
              <p className="mb-3 text-sm text-neutral-300">
                You&apos;re all caught up on what&apos;s new!
              </p>
              <Button
                variant="ghost"
                onClick={() => setShowAllNotifications(true)}
                className="gap-2 rounded-none border"
              >
                Show all notifications
              </Button>
            </div>
          ) : displayNotifications.length > 0 ? (
            (unreadCount > 0 && !showAllNotifications
              ? displayNotifications.filter((n) => !n.read)
              : displayNotifications
            ).map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
              />
            ))
          ) : (
            <div className="px-3 py-6 text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-neutral-600" />
              <p className="text-sm text-neutral-400">No notifications yet</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
