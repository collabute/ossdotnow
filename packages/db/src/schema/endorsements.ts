import { pgTable, text, timestamp, uuid, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { project } from './projects';
import { user } from './auth';

export const endorsementTypeEnum = pgEnum('endorsement_type', ['project', 'work', 'general']);

export const endorsement = pgTable('endorsement', {
  id: uuid('id').primaryKey().defaultRandom(),
  endorserId: text('endorser_id')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  endorsedUserId: text('endorsed_user_id')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  projectId: uuid('project_id').references(() => project.id, { onDelete: 'set null' }),
  projectName: text('project_name'),

  type: endorsementTypeEnum('type').notNull(),
  content: text('content').notNull(),
  workDetails: jsonb('work_details').$type<{
    company?: string;
    role?: string;
    startDate?: string;
    endDate?: string;
  }>(),

  isPublic: boolean('is_public').notNull().default(true),

  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const endorsementRelations = relations(endorsement, ({ one }) => ({
  endorser: one(user, {
    fields: [endorsement.endorserId],
    references: [user.id],
    relationName: 'endorser',
  }),
  endorsedUser: one(user, {
    fields: [endorsement.endorsedUserId],
    references: [user.id],
    relationName: 'endorsedUser',
  }),
  project: one(project, {
    fields: [endorsement.projectId],
    references: [project.id],
  }),
}));
