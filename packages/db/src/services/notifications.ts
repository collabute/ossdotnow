import { notification, type notificationTypeEnum } from '../schema/notifications';
import { eq, and, desc, count, lt } from 'drizzle-orm';
import { db } from '../index';

export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    projectId?: string;
    commentId?: string;
    launchId?: string;
    [key: string]: any;
  };
}

export interface GetNotificationsOptions {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

/**
 * Creates a new notification for a user
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    const [newNotification] = await db
      .insert(notification)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data,
      })
      .returning();

    return newNotification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
}

/**
 * Gets notifications for a specific user
 */
export async function getNotificationsForUser(
  userId: string,
  options: GetNotificationsOptions = {},
) {
  const { limit = 50, offset = 0, unreadOnly = false } = options;

  const whereConditions = unreadOnly
    ? and(eq(notification.userId, userId), eq(notification.read, false))
    : eq(notification.userId, userId);

  return await db.query.notification.findMany({
    where: whereConditions,
    orderBy: [desc(notification.createdAt)],
    limit,
    offset,
  });
}

/**
 * Marks a specific notification as read
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  const [updatedNotification] = await db
    .update(notification)
    .set({
      read: true,
      updatedAt: new Date(),
    })
    .where(and(eq(notification.id, notificationId), eq(notification.userId, userId)))
    .returning();

  return updatedNotification;
}

/**
 * Marks all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  const updatedNotifications = await db
    .update(notification)
    .set({
      read: true,
      updatedAt: new Date(),
    })
    .where(eq(notification.userId, userId))
    .returning();

  return updatedNotifications;
}

/**
 * Gets the count of unread notifications for a user
 */
export async function getUnreadNotificationCount(userId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.read, false)));

  return result?.count ?? 0;
}

/**
 * Deletes old read notifications (cleanup utility)
 * Keeps notifications newer than the specified days
 */
export async function cleanupOldNotifications(daysToKeep: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const deletedNotifications = await db
    .delete(notification)
    .where(and(eq(notification.read, true), lt(notification.createdAt, cutoffDate)))
    .returning();

  return deletedNotifications;
}
