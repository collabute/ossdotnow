import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import {
  getNotificationsForUser,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@workspace/db/services';

export const notificationsRouter = createTRPCRouter({
  /**
   * Get all notifications for the current user
   */
  getAll: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        unreadOnly: z.boolean().default(false),
      }).optional().default({})
    )
    .query(async ({ ctx, input }) => {
      return await getNotificationsForUser(ctx.user.id, {
        limit: input.limit,
        offset: input.offset,
        unreadOnly: input.unreadOnly,
      });
    }),

  /**
   * Get count of unread notifications for the current user
   */
  getUnreadCount: protectedProcedure
    .query(async ({ ctx }) => {
      return await getUnreadNotificationCount(ctx.user.id);
    }),

  /**
   * Mark a specific notification as read
   */
  markAsRead: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await markNotificationAsRead(input.id, ctx.user.id);
    }),

  /**
   * Mark all notifications as read for the current user
   */
  markAllAsRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      return await markAllNotificationsAsRead(ctx.user.id);
    }),
});
