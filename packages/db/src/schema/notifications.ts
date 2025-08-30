import { pgTable, text, timestamp, uuid, boolean, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth';

export const notificationTypeEnum = pgEnum('notification_type', [
  'launch_scheduled',
  'launch_live',
  'comment_received'
]);

export const notification = pgTable(
  'notification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    data: jsonb('data').$type<{
      projectId?: string;
      commentId?: string;
      launchId?: string;
      [key: string]: any;
    }>(),
    read: boolean('read').default(false).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('notification_user_id_idx').on(t.userId),
    index('notification_read_idx').on(t.read),
    index('notification_type_idx').on(t.type),
    index('notification_created_at_idx').on(t.createdAt.desc()),
  ],
);

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, {
    fields: [notification.userId],
    references: [user.id],
  }),
}));
