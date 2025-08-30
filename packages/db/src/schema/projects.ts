import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { categoryTags, categoryProjectTypes, categoryProjectStatuses } from './categories';
import { projectCompetitors } from './project-competitors';
import { gitHostEnum } from './shared-enums';
import { competitor } from './competitors';
import { relations } from 'drizzle-orm';
import { user } from './auth';

export const acquisitionTypeEnum = pgEnum('acquisition_type', ['ipo', 'acquisition', 'other']);
export const projectApprovalStatusEnum = pgEnum('project_approval_status', [
  'pending',
  'approved',
  'rejected', 
]);

export const project = pgTable(
  'project',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id').references(() => user.id, { onDelete: 'set null' }),

    logoUrl: text('logo_url'),
    gitRepoUrl: text('git_repo_url').unique().notNull(),
    gitHost: gitHostEnum('git_host'),
    repoId: text("repo_id").notNull(),
    name: text('name').notNull(),
    description: text('description'),
    socialLinks: jsonb('social_links').$type<{
      twitter?: string;
      discord?: string;
      linkedin?: string;
      website?: string;
      [key: string]: string | undefined;
    }>(),

    approvalStatus: projectApprovalStatusEnum('approval_status').notNull().default('pending'),

    statusId: uuid('status_id')
      .references(() => categoryProjectStatuses.id, { onDelete: 'restrict' })
      .notNull(),
    typeId: uuid('type_id')
      .references(() => categoryProjectTypes.id, { onDelete: 'restrict' })
      .notNull(),

    isLookingForContributors: boolean('is_looking_for_contributors').notNull().default(false),
    isLookingForInvestors: boolean('is_looking_for_investors').notNull().default(false),
    isHiring: boolean('is_hiring').notNull().default(false),
    isPublic: boolean('is_public').notNull().default(false),
    hasBeenAcquired: boolean('has_been_acquired').notNull().default(false),
    isPinned: boolean('is_pinned').notNull().default(false),
    isRepoPrivate: boolean('is_repo_private').notNull().default(false),
    acquiredBy: uuid('acquired_by').references(() => competitor.id, { onDelete: 'set null' }),
    starsCount: integer('stars_count').notNull().default(0),
    starsUpdatedAt: timestamp('stars_updated_at', { mode: 'date', withTimezone: true }),
    forksCount: integer('forks_count').notNull().default(0),
    forksUpdatedAt: timestamp('forks_updated_at', { mode: 'date', withTimezone: true }),

    deletedAt: timestamp('deleted_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('project_status_id_idx').on(table.statusId),
    index('project_type_id_idx').on(table.typeId),
    index('project_stars_count_desc_idx').on(table.starsCount.desc()),
    index('project_forks_count_desc_idx').on(table.forksCount.desc()),
],
);
export const projectTagRelations = pgTable(
  'project_tag_relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .references(() => project.id, { onDelete: 'cascade' })
      .notNull(),
    tagId: uuid('tag_id')
      .references(() => categoryTags.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('project_tag_relations_project_id_idx').on(table.projectId),
    index('project_tag_relations_tag_id_idx').on(table.tagId),
    index('unique_project_tag').on(table.projectId, table.tagId),
  ],
);

export const projectRelations = relations(project, ({ one, many }) => ({
  owner: one(user, {
    fields: [project.ownerId],
    references: [user.id],
  }),
  status: one(categoryProjectStatuses, {
    fields: [project.statusId],
    references: [categoryProjectStatuses.id],
  }),
  type: one(categoryProjectTypes, {
    fields: [project.typeId],
    references: [categoryProjectTypes.id],
  }),
  tagRelations: many(projectTagRelations),
  competitors: many(projectCompetitors, { relationName: 'competitors' }),
  acquiringCompetitor: one(competitor, {
    fields: [project.acquiredBy],
    references: [competitor.id],
    relationName: 'acquirer',
  }),
  alternativeProjects: many(projectCompetitors, { relationName: 'alternative_projects' }),
  alternativeCompetitors: many(projectCompetitors, { relationName: 'alternative_competitors' }),
}));

export const projectTagRelationsRelations = relations(projectTagRelations, ({ one }) => ({
  project: one(project, {
    fields: [projectTagRelations.projectId],
    references: [project.id],
  }),
  tag: one(categoryTags, {
    fields: [projectTagRelations.tagId],
    references: [categoryTags.id],
  }),
}));
