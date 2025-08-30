import { useQuery, useMutation } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { useTRPC } from './use-trpc';
import { toast } from 'sonner';

const POLLING_INTERVAL = 30000; // 30 seconds

export function useNotifications() {
  const trpc = useTRPC();

  //data fetching
  const notificationsQuery = useQuery({
    ...trpc.notifications.getAll.queryOptions({ limit: 50 }),
    refetchInterval: POLLING_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const unreadCountQuery = useQuery({
    ...trpc.notifications.getUnreadCount.queryOptions(),
    refetchInterval: POLLING_INTERVAL,
    refetchIntervalInBackground: false,
  });

  //mutations
  const markAsReadMutation = useMutation(
    trpc.notifications.markAsRead.mutationOptions({
      onSuccess: () => {
        notificationsQuery.refetch();
        unreadCountQuery.refetch();
      },
      onError: () => {
        toast.error('Failed to mark notification as read');
      },
    }),
  );

  const markAllAsReadMutation = useMutation(
    trpc.notifications.markAllAsRead.mutationOptions({
      onSuccess: () => {
        notificationsQuery.refetch();
        unreadCountQuery.refetch();
        toast.success('All notifications marked as read');
      },
      onError: () => {
        toast.error('Failed to mark all notifications as read');
      },
    }),
  );

  const markAsRead = useCallback(
    (notificationId: string) => {
      markAsReadMutation.mutate({ id: notificationId });
    },
    [markAsReadMutation],
  );

  const markAllAsRead = useCallback(() => {
    const unreadCount = unreadCountQuery.data ?? 0;
    if (unreadCount > 0) {
      markAllAsReadMutation.mutate();
    }
  }, [markAllAsReadMutation, unreadCountQuery.data]);

  const refetch = useCallback(() => {
    notificationsQuery.refetch();
    unreadCountQuery.refetch();
  }, [notificationsQuery, unreadCountQuery]);

  // Visibility handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetch]);

  //returning values
  return {
    //data
    notifications: notificationsQuery.data ?? [],
    unreadCount: unreadCountQuery.data ?? 0,
    isLoading: notificationsQuery.isLoading,

    //error states
    hasError: notificationsQuery.isError || unreadCountQuery.isError,
    error: notificationsQuery.error || unreadCountQuery.error,

    //actions
    markAsRead,
    markAllAsRead,
    refetch,

    //loading states
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
  };
}
