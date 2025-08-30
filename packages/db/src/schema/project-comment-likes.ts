import { pgTable, text, timestamp, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { projectComment } from './project-comments';
import { user } from './auth';

export const projectCommentLike = pgTable(
    'project_comment_like',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        commentId: uuid('comment_id')
            .references(() => projectComment.id, { onDelete: 'cascade' })
            .notNull(),
        userId: text('user_id')
            .references(() => user.id, { onDelete: 'cascade' })
            .notNull(),
        createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    },
    (t) => [
        index('project_comment_like_comment_id_idx').on(t.commentId),
        index('project_comment_like_user_id_idx').on(t.userId),
        // Unique constraint to prevent duplicate likes
        uniqueIndex('project_comment_like_unique_idx').on(t.commentId, t.userId),
    ],
);

export const projectCommentLikeRelations = relations(projectCommentLike, ({ one }) => ({
    comment: one(projectComment, {
        fields: [projectCommentLike.commentId],
        references: [projectComment.id],
    }),
    user: one(user, {
        fields: [projectCommentLike.userId],
        references: [user.id],
    }),
}));
