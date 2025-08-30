import {
  categoryProjectStatuses,
  categoryProjectTypes,
  categoryTags,
  projectApprovalStatusEnum,
} from '@workspace/db/schema';
import { adminProcedure, createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';
import { account, project, projectClaim, projectTagRelations } from '@workspace/db/schema';
import { and, asc, count, desc, eq, or, ilike, inArray, gte, lte } from 'drizzle-orm';
import { APPROVAL_STATUS, resolveAllIds } from '../utils/project-helpers';
import { projectProviderEnum } from '@workspace/db/schema';
import { PROVIDER_URL_PATTERNS } from '../utils/constants';
import { getActiveDriver } from '../driver/utils';
import { createInsertSchema } from 'drizzle-zod';
import type { createTRPCContext } from '../trpc';
import type { Context } from '../driver/utils';
import { TRPCError } from '@trpc/server';
import { sql } from 'drizzle-orm';
import { z } from 'zod/v4';

const createProjectInput = createInsertSchema(project)
  .omit({
    statusId: true,
    typeId: true,
    repoId: true,
  })
  .extend({
    status: z.string().min(1, 'Project status is required'),
    type: z.string().min(1, 'Project type is required'),
    tags: z.array(z.string()).default([]),
    approvalStatus: z.enum(projectApprovalStatusEnum.enumValues),
  });

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

interface VerifyGitHubOwnershipContext {
  db: TRPCContext['db'];
  session: {
    userId: string;
  };
}

export interface DebugPermissionsResult {
  currentUser: string;
  repoOwner: string;
  repoOwnerType: string;
  isDirectOwner: boolean;
  repoPermission?: string;
  repoPermissionDetails?: {
    permission: string;
    user?: Record<string, unknown> | null;
    [key: string]: unknown;
  };
  repoPermissionError?: string;
  orgMembership?:
    | {
        role: string;
        state: string;
      }
    | string;
  orgMembershipError?: string;
}

// Helper to fetch repository metrics from GitHub or GitLab using drivers
async function fetchRepoMetric(
  gitRepoUrl: string | null,
  gitHost: string | null,
  metric: 'stars' | 'forks',
  ctx: any,
): Promise<number | null> {
  if (!gitRepoUrl || !gitHost) {
    return null;
  }

  try {
    let identifier: string;
    if (gitRepoUrl.startsWith('http')) {
      const urlParts = gitRepoUrl.split('/');
      identifier = urlParts.slice(-2).join('/');
    } else {
      identifier = gitRepoUrl;
    }

    try {
      const driver = await getActiveDriver(gitHost as 'github' | 'gitlab', ctx);
      const repo = await driver.getRepo(identifier);

      if (metric === 'forks') {
        return typeof repo.forks_count === 'number' ? repo.forks_count : null;
      } else {
        if (gitHost === 'github') {
          return typeof repo.stargazers_count === 'number' ? repo.stargazers_count : null;
        } else if (gitHost === 'gitlab') {
          return typeof repo.star_count === 'number' ? repo.star_count : null;
        }
      }
    } catch (repoError) {
      console.error(`Failed to fetch ${metric} for ${identifier}:`, repoError);
      return null;
    }

    return null;
  } catch (e) {
    console.error(`Failed to fetch ${metric} for ${gitRepoUrl}:`, e);
    return null;
  }
}

export const projectsRouter = createTRPCRouter({
  updateRepoIds: adminProcedure
    .input(
      z.object({
        gitHost: z.enum(['github', 'gitlab', 'all']).optional().default('all'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results = {
        github: { updated: 0, failed: 0, skipped: 0 },
        gitlab: { updated: 0, failed: 0, skipped: 0 },
      };

      try {
        if (input.gitHost === 'github' || input.gitHost === 'all') {
          const githubDriver = await getActiveDriver('github', ctx as Context);
          results.github = await githubDriver.updateRepoIds({ db: ctx.db });
        }

        if (input.gitHost === 'gitlab' || input.gitHost === 'all') {
          const gitlabDriver = await getActiveDriver('gitlab', ctx as Context);
          results.gitlab = await gitlabDriver.updateRepoIds({ db: ctx.db });
        }

        return {
          success: true,
          results,
          totals: {
            updated: results.github.updated + results.gitlab.updated,
            failed: results.github.failed + results.gitlab.failed,
            skipped: results.github.skipped + results.gitlab.skipped,
          },
        };
      } catch (error) {
        console.error('Error updating repo IDs:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update repo IDs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  getProjectsAdmin: adminProcedure
    .input(
      z.object({
        approvalStatus: z.enum(['approved', 'rejected', 'pending', 'all']).optional(),
        searchQuery: z.string().optional(),
        statusFilter: z.string().optional(),
        typeFilter: z.string().optional(),
        tagFilter: z.string().optional(),
        providerFilter: z.string().optional(),
        sortBy: z.enum(['recent', 'name', 'stars', 'forks']).optional().default('recent'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const {
        approvalStatus,
        searchQuery,
        statusFilter,
        typeFilter,
        tagFilter,
        providerFilter,
        sortBy,
      } = input;

      const conditions = [];

      if (approvalStatus && approvalStatus !== 'all') {
        conditions.push(eq(project.approvalStatus, approvalStatus));
      }

      // Note: Admin version includes private projects, unlike public version

      if (searchQuery) {
        conditions.push(
          or(
            ilike(project.name, `%${searchQuery}%`),
            ilike(project.gitRepoUrl, `%${searchQuery}%`),
          ),
        );
      }

      if (providerFilter && providerFilter !== 'all') {
        conditions.push(
          eq(project.gitHost, providerFilter as (typeof projectProviderEnum.enumValues)[number]),
        );
      }

      const query = ctx.db
        .select({
          project: project,
          status: categoryProjectStatuses,
          type: categoryProjectTypes,
          tagCount: sql<number>`count(distinct ${projectTagRelations.tagId})`.as('tagCount'),
        })
        .from(project)
        .leftJoin(categoryProjectStatuses, eq(project.statusId, categoryProjectStatuses.id))
        .leftJoin(categoryProjectTypes, eq(project.typeId, categoryProjectTypes.id))
        .leftJoin(projectTagRelations, eq(project.id, projectTagRelations.projectId))
        .leftJoin(categoryTags, eq(projectTagRelations.tagId, categoryTags.id))
        .groupBy(project.id, categoryProjectStatuses.id, categoryProjectTypes.id);

      if (statusFilter && statusFilter !== 'all') {
        conditions.push(eq(categoryProjectStatuses.name, statusFilter));
      }

      if (typeFilter && typeFilter !== 'all') {
        conditions.push(eq(categoryProjectTypes.name, typeFilter));
      }

      if (tagFilter && tagFilter !== 'all') {
        conditions.push(eq(categoryTags.name, tagFilter));
      }

      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      const countQuery = ctx.db
        .select({ totalCount: sql<number>`count(distinct ${project.id})` })
        .from(project)
        .leftJoin(categoryProjectStatuses, eq(project.statusId, categoryProjectStatuses.id))
        .leftJoin(categoryProjectTypes, eq(project.typeId, categoryProjectTypes.id))
        .leftJoin(projectTagRelations, eq(project.id, projectTagRelations.projectId))
        .leftJoin(categoryTags, eq(projectTagRelations.tagId, categoryTags.id));

      if (conditions.length > 0) {
        countQuery.where(and(...conditions));
      }

      const [totalCountResult] = await countQuery;

      const orderByClause = [];
      // if (!searchQuery) {
      //   orderByClause.push(desc(project.isPinned));
      // }

      if (searchQuery) {
        const lowerSearchQuery = searchQuery.toLowerCase();

        orderByClause.push(desc(ilike(project.name, searchQuery)));

        orderByClause.push(desc(ilike(project.name, `${searchQuery}%`)));

        orderByClause.push(desc(ilike(project.name, `%${searchQuery}%`)));

        orderByClause.push(desc(ilike(project.gitRepoUrl, `%${searchQuery}%`)));
      }

      switch (sortBy) {
        case 'name':
          orderByClause.push(asc(project.name));
          break;
        case 'stars':
          // TODO: Implement stars sorting once project stars data is available
          // This requires fetching stars count from GitHub/GitLab APIs and storing in database
          // For now, fallback to recent
          orderByClause.push(desc(project.starsCount));
          break;
        case 'forks':
          // TODO: Implement forks sorting once project forks data is available
          // This requires fetching forks count from GitHub/GitLab APIs and storing in database
          // For now, fallback to recent
          orderByClause.push(desc(project.forksCount));
          break;
        default:
          orderByClause.push(desc(project.createdAt));
          break;
      }

      const projectResults = await query.orderBy(...orderByClause);

      const projectIds = projectResults.map((r) => r.project.id);
      const tagRelations =
        projectIds.length > 0
          ? await ctx.db.query.projectTagRelations.findMany({
              where: inArray(projectTagRelations.projectId, projectIds),
              with: {
                tag: true,
              },
            })
          : [];

      const tagsByProject = tagRelations.reduce(
        (acc, rel) => {
          if (!acc[rel.projectId]) {
            acc[rel.projectId] = [];
          }
          acc[rel.projectId]?.push(rel);
          return acc;
        },
        {} as Record<string, typeof tagRelations>,
      );

      const projects = projectResults.map((r) => ({
        ...r.project,
        status: r.status,
        type: r.type,
        tagRelations: tagsByProject[r.project.id] || [],
      }));

      return projects;
    }),
  // API procedure to get only featured (pinned) projects
  featuredProjects: publicProcedure
    .input(
      z.object({
        sortBy: z.enum(['recent', 'name', 'stars', 'forks']).optional().default('recent'),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(4),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { sortBy, page, pageSize } = input;
      const offset = (page - 1) * pageSize;
      const orderByClause = [];
      switch (sortBy) {
        case 'name':
          orderByClause.push(asc(project.name));
          break;
        case 'stars':
          orderByClause.push(desc(project.starsCount));
          break;
        case 'forks':
          orderByClause.push(desc(project.forksCount));
          break;
        default:
          orderByClause.push(desc(project.createdAt));
          break;
      }
      // Only pinned and approved projects
      const conditions = [eq(project.isPinned, true), eq(project.approvalStatus, 'approved')];
      const query = ctx.db
        .select({
          project: project,
          status: categoryProjectStatuses,
          type: categoryProjectTypes,
          tagCount: sql<number>`count(distinct ${projectTagRelations.tagId})`.as('tagCount'),
        })
        .from(project)
        .leftJoin(categoryProjectStatuses, eq(project.statusId, categoryProjectStatuses.id))
        .leftJoin(categoryProjectTypes, eq(project.typeId, categoryProjectTypes.id))
        .leftJoin(projectTagRelations, eq(project.id, projectTagRelations.projectId))
        .leftJoin(categoryTags, eq(projectTagRelations.tagId, categoryTags.id))
        .where(and(...conditions))
        .groupBy(project.id, categoryProjectStatuses.id, categoryProjectTypes.id)
        .orderBy(...orderByClause)
        .limit(pageSize)
        .offset(offset);
      const projectResults = await query;
      const projectIds = projectResults.map((r) => r.project.id);
      const tagRelations =
        projectIds.length > 0
          ? await ctx.db.query.projectTagRelations.findMany({
              where: inArray(projectTagRelations.projectId, projectIds),
              with: {
                tag: true,
              },
            })
          : [];
      const tagsByProject = tagRelations.reduce(
        (acc, rel) => {
          if (!acc[rel.projectId]) {
            acc[rel.projectId] = [];
          }
          acc[rel.projectId]?.push(rel);
          return acc;
        },
        {} as Record<string, typeof tagRelations>,
      );
      const projects = projectResults.map((r) => ({
        ...r.project,
        status: r.status,
        type: r.type,
        tagRelations: tagsByProject[r.project.id] || [],
      }));
      return projects;
    }),
  getProjects: publicProcedure
    .input(
      z.object({
        approvalStatus: z.enum(['approved', 'rejected', 'pending', 'all']).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        searchQuery: z.string().optional(),
        statusFilter: z.string().optional(),
        typeFilter: z.string().optional(),
        tagFilter: z.string().optional(),
        providerFilter: z.string().optional(),
        sortBy: z.enum(['recent', 'name', 'stars', 'forks']).optional().default('recent'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const {
        page,
        pageSize,
        approvalStatus,
        searchQuery,
        statusFilter,
        typeFilter,
        tagFilter,
        providerFilter,
        sortBy,
      } = input;
      const offset = (page - 1) * pageSize;

      const conditions = [];

      if (approvalStatus && approvalStatus !== 'all') {
        conditions.push(eq(project.approvalStatus, approvalStatus));
      }

      // Filter out private projects from public listings
      conditions.push(eq(project.isRepoPrivate, false));

      if (searchQuery) {
        conditions.push(
          or(
            ilike(project.name, `%${searchQuery}%`),
            ilike(project.gitRepoUrl, `%${searchQuery}%`),
          ),
        );
      }

      if (providerFilter && providerFilter !== 'all') {
        conditions.push(
          eq(project.gitHost, providerFilter as (typeof projectProviderEnum.enumValues)[number]),
        );
      }

      const query = ctx.db
        .select({
          project: project,
          status: categoryProjectStatuses,
          type: categoryProjectTypes,
          tagCount: sql<number>`count(distinct ${projectTagRelations.tagId})`.as('tagCount'),
        })
        .from(project)
        .leftJoin(categoryProjectStatuses, eq(project.statusId, categoryProjectStatuses.id))
        .leftJoin(categoryProjectTypes, eq(project.typeId, categoryProjectTypes.id))
        .leftJoin(projectTagRelations, eq(project.id, projectTagRelations.projectId))
        .leftJoin(categoryTags, eq(projectTagRelations.tagId, categoryTags.id))
        .groupBy(project.id, categoryProjectStatuses.id, categoryProjectTypes.id);

      if (statusFilter && statusFilter !== 'all') {
        conditions.push(eq(categoryProjectStatuses.name, statusFilter));
      }

      if (typeFilter && typeFilter !== 'all') {
        conditions.push(eq(categoryProjectTypes.name, typeFilter));
      }

      if (tagFilter && tagFilter !== 'all') {
        conditions.push(eq(categoryTags.name, tagFilter));
      }

      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      const countQuery = ctx.db
        .select({ totalCount: sql<number>`count(distinct ${project.id})` })
        .from(project)
        .leftJoin(categoryProjectStatuses, eq(project.statusId, categoryProjectStatuses.id))
        .leftJoin(categoryProjectTypes, eq(project.typeId, categoryProjectTypes.id))
        .leftJoin(projectTagRelations, eq(project.id, projectTagRelations.projectId))
        .leftJoin(categoryTags, eq(projectTagRelations.tagId, categoryTags.id));

      if (conditions.length > 0) {
        countQuery.where(and(...conditions));
      }

      const [totalCountResult] = await countQuery;

      const orderByClause = [];
      // if (!searchQuery) {
      //   orderByClause.push(desc(project.isPinned));
      // }

      if (searchQuery) {
        const lowerSearchQuery = searchQuery.toLowerCase();

        orderByClause.push(desc(ilike(project.name, searchQuery)));

        orderByClause.push(desc(ilike(project.name, `${searchQuery}%`)));

        orderByClause.push(desc(ilike(project.name, `%${searchQuery}%`)));

        orderByClause.push(desc(ilike(project.gitRepoUrl, `%${searchQuery}%`)));
      }

      switch (sortBy) {
        case 'name':
          orderByClause.push(asc(project.name));
          break;
        case 'stars':
          // TODO: Add stars count to project data
          // For now, fallback to recent
          orderByClause.push(desc(project.starsCount));
          break;
        case 'forks':
          // TODO: Add forks count to project data
          // For now, fallback to recent
          orderByClause.push(desc(project.forksCount));
          break;
        case 'recent':
        default:
          orderByClause.push(desc(project.createdAt));
          break;
      }

      let projectResults = await query
        .orderBy(...orderByClause)
        .limit(pageSize)
        .offset(offset);

      // On-demand star and fork count update with caching and parallel fetch
      const CACHE_THRESHOLD_MINUTES = 3;
      const now = new Date();
      let needsRequery = false;
      // Update outdated stars
      const outdatedStars = projectResults.filter((r) => {
        const updatedAt = r.project.starsUpdatedAt;
        if (!updatedAt) return true;
        const diff = (now.getTime() - new Date(updatedAt).getTime()) / 60000;
        return diff > CACHE_THRESHOLD_MINUTES;
      });
      if (outdatedStars.length > 0) {
        const results = await Promise.allSettled(
          outdatedStars.map(async (r) => {
            const stars = await fetchRepoMetric(
              r.project.gitRepoUrl ?? null,
              r.project.gitHost ?? null,
              'stars',
              ctx,
            );
            if (typeof stars === 'number') {
              await ctx.db
                .update(project)
                .set({ starsCount: stars, starsUpdatedAt: new Date() })
                .where(eq(project.id, r.project.id));
              needsRequery = true;
            }
          }),
        );
        // Log any failures for monitoring
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const projectId = outdatedStars[index]?.project?.id ?? 'unknown';
            console.error(`Failed to update stars for project ${projectId}:`, result.reason);
          }
        });
      }
      // Update outdated forks
      const outdatedForks = projectResults.filter((r) => {
        const updatedAt = r.project.forksUpdatedAt;
        if (!updatedAt) return true;
        const diff = (now.getTime() - new Date(updatedAt).getTime()) / 60000;
        return diff > CACHE_THRESHOLD_MINUTES;
      });
      if (outdatedForks.length > 0) {
        const results = await Promise.allSettled(
          outdatedForks.map(async (r) => {
            const forks = await fetchRepoMetric(
              r.project.gitRepoUrl ?? null,
              r.project.gitHost ?? null,
              'forks',
              ctx,
            );
            if (typeof forks === 'number') {
              await ctx.db
                .update(project)
                .set({ forksCount: forks, forksUpdatedAt: new Date() })
                .where(eq(project.id, r.project.id));
              needsRequery = true;
            }
          }),
        );
        // Log any failures for monitoring
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const projectId = outdatedForks[index]?.project?.id ?? 'unknown';
            console.error(`Failed to update forks for project ${projectId}:`, result.reason);
          }
        });
      }
      if (needsRequery) {
        projectResults = await query
          .orderBy(...orderByClause)
          .limit(pageSize)
          .offset(offset);
      }

      const projectIds = projectResults.map((r) => r.project.id);
      const tagRelations =
        projectIds.length > 0
          ? await ctx.db.query.projectTagRelations.findMany({
              where: inArray(projectTagRelations.projectId, projectIds),
              with: {
                tag: true,
              },
            })
          : [];

      const tagsByProject = tagRelations.reduce(
        (acc, rel) => {
          if (!acc[rel.projectId]) {
            acc[rel.projectId] = [];
          }
          acc[rel.projectId]?.push(rel);
          return acc;
        },
        {} as Record<string, typeof tagRelations>,
      );

      const projects = projectResults.map((r) => ({
        ...r.project,
        status: r.status,
        type: r.type,
        tagRelations: tagsByProject[r.project.id] || [],
      }));

      const totalCount = totalCountResult?.totalCount ?? 0;
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        data: projects,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        },
      };
    }),
  getProjectsByDateRange: publicProcedure
    .input(
      z.object({
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        approvalStatus: z
          .enum(['approved', 'rejected', 'pending', 'all'])
          .optional()
          .default('approved'),
        searchQuery: z.string().optional(),
        statusFilter: z.string().optional(),
        typeFilter: z.string().optional(),
        tagFilter: z.string().optional(),
        providerFilter: z.string().optional(),
        sortBy: z.enum(['recent', 'name', 'stars', 'forks']).optional().default('recent'),
        dateField: z.enum(['createdAt', 'updatedAt']).optional().default('createdAt'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const {
        startDate,
        endDate,
        page,
        pageSize,
        approvalStatus,
        searchQuery,
        statusFilter,
        typeFilter,
        tagFilter,
        providerFilter,
        sortBy,
        dateField,
      } = input;

      if (startDate > endDate) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Start date must be before or equal to end date',
        });
      }

      const offset = (page - 1) * pageSize;
      const conditions = [];

      const dateColumn = dateField === 'updatedAt' ? project.updatedAt : project.createdAt;
      conditions.push(gte(dateColumn, startDate));
      conditions.push(lte(dateColumn, endDate));

      if (approvalStatus && approvalStatus !== 'all') {
        conditions.push(eq(project.approvalStatus, approvalStatus));
      }

      conditions.push(eq(project.isRepoPrivate, false));

      if (searchQuery) {
        conditions.push(
          or(
            ilike(project.name, `%${searchQuery}%`),
            ilike(project.gitRepoUrl, `%${searchQuery}%`),
          ),
        );
      }
      if (providerFilter && providerFilter !== 'all') {
        conditions.push(
          eq(project.gitHost, providerFilter as (typeof projectProviderEnum.enumValues)[number]),
        );
      }

      const query = ctx.db
        .select({
          project: project,
          status: categoryProjectStatuses,
          type: categoryProjectTypes,
          tagCount: sql<number>`count(distinct ${projectTagRelations.tagId})`.as('tagCount'),
        })
        .from(project)
        .leftJoin(categoryProjectStatuses, eq(project.statusId, categoryProjectStatuses.id))
        .leftJoin(categoryProjectTypes, eq(project.typeId, categoryProjectTypes.id))
        .leftJoin(projectTagRelations, eq(project.id, projectTagRelations.projectId))
        .leftJoin(categoryTags, eq(projectTagRelations.tagId, categoryTags.id))
        .groupBy(project.id, categoryProjectStatuses.id, categoryProjectTypes.id);

      if (statusFilter && statusFilter !== 'all') {
        conditions.push(eq(categoryProjectStatuses.name, statusFilter));
      }

      if (typeFilter && typeFilter !== 'all') {
        conditions.push(eq(categoryProjectTypes.name, typeFilter));
      }

      if (tagFilter && tagFilter !== 'all') {
        conditions.push(eq(categoryTags.name, tagFilter));
      }

      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      const countQuery = ctx.db
        .select({ totalCount: sql<number>`count(distinct ${project.id})` })
        .from(project)
        .leftJoin(categoryProjectStatuses, eq(project.statusId, categoryProjectStatuses.id))
        .leftJoin(categoryProjectTypes, eq(project.typeId, categoryProjectTypes.id))
        .leftJoin(projectTagRelations, eq(project.id, projectTagRelations.projectId))
        .leftJoin(categoryTags, eq(projectTagRelations.tagId, categoryTags.id));

      if (conditions.length > 0) {
        countQuery.where(and(...conditions));
      }

      const [totalCountResult] = await countQuery;

      const orderByClause = [];

      if (searchQuery) {
        orderByClause.push(desc(ilike(project.name, searchQuery)));
        orderByClause.push(desc(ilike(project.name, `${searchQuery}%`)));
        orderByClause.push(desc(ilike(project.name, `%${searchQuery}%`)));
        orderByClause.push(desc(ilike(project.gitRepoUrl, `%${searchQuery}%`)));
      }

      switch (sortBy) {
        case 'name':
          orderByClause.push(asc(project.name));
          break;
        case 'stars':
          orderByClause.push(desc(project.starsCount));
          break;
        case 'forks':
          orderByClause.push(desc(project.forksCount));
          break;
        case 'recent':
        default:
          orderByClause.push(desc(dateColumn));
          break;
      }

      let projectResults = await query
        .orderBy(...orderByClause)
        .limit(pageSize)
        .offset(offset);
      const CACHE_THRESHOLD_MINUTES = 3;
      const now = new Date();
      let needsRequery = false;
      const outdatedStars = projectResults.filter((r) => {
        const updatedAt = r.project.starsUpdatedAt;
        if (!updatedAt) return true;
        const diff = (now.getTime() - new Date(updatedAt).getTime()) / 60000;
        return diff > CACHE_THRESHOLD_MINUTES;
      });
      if (outdatedStars.length > 0) {
        const results = await Promise.allSettled(
          outdatedStars.map(async (r) => {
            const stars = await fetchRepoMetric(
              r.project.gitRepoUrl ?? null,
              r.project.gitHost ?? null,
              'stars',
              ctx,
            );
            if (typeof stars === 'number') {
              await ctx.db
                .update(project)
                .set({ starsCount: stars, starsUpdatedAt: new Date() })
                .where(eq(project.id, r.project.id));
              needsRequery = true;
            }
          }),
        );

        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const projectId = outdatedStars[index]?.project?.id ?? 'unknown';
            console.error(`Failed to update stars for project ${projectId}:`, result.reason);
          }
        });
      }

      const outdatedForks = projectResults.filter((r) => {
        const updatedAt = r.project.forksUpdatedAt;
        if (!updatedAt) return true;
        const diff = (now.getTime() - new Date(updatedAt).getTime()) / 60000;
        return diff > CACHE_THRESHOLD_MINUTES;
      });
      if (outdatedForks.length > 0) {
        const results = await Promise.allSettled(
          outdatedForks.map(async (r) => {
            const forks = await fetchRepoMetric(
              r.project.gitRepoUrl ?? null,
              r.project.gitHost ?? null,
              'forks',
              ctx,
            );
            if (typeof forks === 'number') {
              await ctx.db
                .update(project)
                .set({ forksCount: forks, forksUpdatedAt: new Date() })
                .where(eq(project.id, r.project.id));
              needsRequery = true;
            }
          }),
        );

        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const projectId = outdatedForks[index]?.project?.id ?? 'unknown';
            console.error(`Failed to update forks for project ${projectId}:`, result.reason);
          }
        });
      }
      if (needsRequery) {
        projectResults = await query
          .orderBy(...orderByClause)
          .limit(pageSize)
          .offset(offset);
      }

      const projectIds = projectResults.map((r) => r.project.id);
      const tagRelations =
        projectIds.length > 0
          ? await ctx.db.query.projectTagRelations.findMany({
              where: inArray(projectTagRelations.projectId, projectIds),
              with: {
                tag: true,
              },
            })
          : [];

      const tagsByProject = tagRelations.reduce(
        (acc, rel) => {
          if (!acc[rel.projectId]) {
            acc[rel.projectId] = [];
          }
          acc[rel.projectId]?.push(rel);
          return acc;
        },
        {} as Record<string, typeof tagRelations>,
      );

      const projects = projectResults.map((r) => ({
        ...r.project,
        status: r.status,
        type: r.type,
        tagRelations: tagsByProject[r.project.id] || [],
      }));

      const totalCount = totalCountResult?.totalCount ?? 0;
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        data: projects,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        },
        dateRange: {
          startDate,
          endDate,
          dateField,
        },
      };
    }),
  getProjectsByUserId: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, userId } = input;
      const offset = (page - 1) * pageSize;

      const conditions = [eq(project.ownerId, userId)];

      if (!ctx.session?.userId || ctx.session.userId !== userId) {
        conditions.push(eq(project.isRepoPrivate, false));
      }

      const whereClause = and(...conditions);

      const [totalCountResult] = await ctx.db
        .select({ totalCount: count() })
        .from(project)
        .where(whereClause)
        .limit(1);

      const projects = await ctx.db.query.project.findMany({
        where: whereClause,
        orderBy: [asc(project.name)],
        limit: pageSize,
        offset,
        with: {
          status: true,
          type: true,
          tagRelations: {
            with: {
              tag: true,
            },
          },
        },
      });

      const totalCount = totalCountResult?.totalCount ?? 0;

      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        data: projects,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        },
      };
    }),
  getProject: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    return ctx.db.query.project.findFirst({
      where: eq(project.id, input.id),
      with: {
        status: true,
        type: true,
        tagRelations: {
          with: {
            tag: true,
          },
        },
      },
    });
  }),
  addProject: protectedProcedure.input(createProjectInput).mutation(async ({ ctx, input }) => {
    const { statusId, typeId, tagIds } = await resolveAllIds(ctx.db, {
      status: input.status,
      type: input.type,
      tags: input.tags,
    });

    let repoId = '';

    if (input.gitRepoUrl && input.gitHost) {
      try {
        const gitHost = input.gitHost as 'github' | 'gitlab';
        const driver = await getActiveDriver(gitHost, ctx as Context);

        const match = input.gitRepoUrl.match(PROVIDER_URL_PATTERNS[gitHost]);
        if (match) {
          const [, owner, repo] = match;
          if (owner && repo) {
            const repoIdentifier = `${owner}/${repo}`;

            const repoData = await driver.getRepo(repoIdentifier);

            if (repoData && typeof repoData.id !== 'undefined') {
              repoId = repoData.id.toString();
              console.log(`Fetched repo_id ${repoId} for ${input.gitRepoUrl}`);
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching repo_id for ${input.gitRepoUrl}:`, error);
      }
    }

    if (!repoId) {
      repoId = input.gitRepoUrl || 'pending';
    }

    return await ctx.db.transaction(async (tx) => {
      const [newProject] = await tx
        .insert(project)
        .values({
          ...input,
          ownerId: ctx.session.userId,
          statusId,
          typeId,
          repoId,
        })
        .returning();

      if (tagIds.length > 0 && newProject?.id) {
        const tagRelations = tagIds.map((tagId: string) => ({
          projectId: newProject.id as string,
          tagId: tagId as string,
        }));
        await tx.insert(projectTagRelations).values(tagRelations);
      }

      return newProject;
    });
  }),
  updateProject: adminProcedure
    .input(createProjectInput.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const projectId = input.id;

      const { statusId, typeId, tagIds } = await resolveAllIds(ctx.db, {
        status: input.status,
        type: input.type,
        tags: input.tags,
      });

      return await ctx.db.transaction(async (tx) => {
        const [updatedProject] = await tx
          .update(project)
          .set({
            ...input,
            statusId,
            typeId,
          })
          .where(eq(project.id, projectId))
          .returning();

        if (!updatedProject) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found',
          });
        }
        await tx.delete(projectTagRelations).where(eq(projectTagRelations.projectId, projectId));

        if (tagIds.length > 0) {
          const tagRelations = tagIds.map((tagId: string) => ({
            projectId: projectId,
            tagId: tagId as string,
          }));
          await tx.insert(projectTagRelations).values(tagRelations);
        }

        return updatedProject;
      });
    }),
  acceptProject: adminProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Add audit trail logging
      // Example: await logAdminAction({
      //   action: 'project_approved',
      //   projectId: input.projectId,
      //   adminId: ctx.user.id,
      //   timestamp: new Date()
      // });
      const [updatedProject] = await ctx.db
        .update(project)
        .set({ approvalStatus: APPROVAL_STATUS.APPROVED })
        .where(eq(project.id, input.projectId))
        .returning();

      if (!updatedProject) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      return updatedProject;
    }),
  rejectProject: adminProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Add audit trail logging
      // Example: await logAdminAction({
      //   action: 'project_rejected',
      //   projectId: input.projectId,
      //   adminId: ctx.user.id,a
      //   timestamp: new Date()
      // });
      const [updatedProject] = await ctx.db
        .update(project)
        .set({ approvalStatus: APPROVAL_STATUS.REJECTED })
        .where(eq(project.id, input.projectId))
        .returning();

      if (!updatedProject) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      return updatedProject;
    }),
  pinProject: adminProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updatedProject] = await ctx.db
        .update(project)
        .set({ isPinned: true })
        .where(eq(project.id, input.projectId))
        .returning();

      if (!updatedProject) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      return updatedProject;
    }),
  unpinProject: adminProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updatedProject] = await ctx.db
        .update(project)
        .set({ isPinned: false })
        .where(eq(project.id, input.projectId))
        .returning();

      if (!updatedProject) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      return updatedProject;
    }),
  deleteProject: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session.userId) throw new Error('User not authenticated');

      const [deletedProject] = await ctx.db
        .update(project)
        .set({ deletedAt: new Date() })
        .where(and(eq(project.id, input.id), eq(project.ownerId, ctx.session.userId)))
        .returning();

      if (!deletedProject) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or not owned by you',
        });
      }

      return deletedProject;
    }),
  claimProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const projectToClaim = await ctx.db.query.project.findFirst({
        where: eq(project.id, input.projectId),
      });

      if (!projectToClaim) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      if (projectToClaim.ownerId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This project has already been claimed',
        });
      }

      if (!projectToClaim.gitRepoUrl) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This project does not have a repository URL',
        });
      }

      const provider = projectToClaim.gitHost as (typeof projectProviderEnum.enumValues)[number];

      const driver = await getActiveDriver(provider, ctx as Context);

      const userId = ctx.session.userId;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to claim a project',
        });
      }

      const userAccount = await ctx.db
        .select({ accessToken: account.accessToken })
        .from(account)
        .where(and(eq(account.userId, userId), eq(account.providerId, provider)))
        .limit(1);

      if (!userAccount[0]?.accessToken) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: `Please connect your ${provider} account to claim this project`,
        });
      }

      const match = projectToClaim.gitRepoUrl.match(PROVIDER_URL_PATTERNS[provider]);
      if (!match) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid ${provider} repository URL format`,
        });
      }

      const [, owner, repo] = match;

      if (!owner || !repo || !ctx) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Could not extract owner and repository name from URL',
        });
      }

      try {
        if (!ctx.session?.userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Session not found or invalid',
          });
        }

        const verifyContext: VerifyGitHubOwnershipContext = {
          db: ctx.db,
          session: { userId: ctx.session.userId },
        };

        const result = await driver.verifyOwnership(
          `${owner}/${repo}`,
          verifyContext,
          input.projectId,
        );
        return result;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error('API error during claim verification:', error);
        try {
          await ctx.db.insert(projectClaim).values({
            projectId: input.projectId,
            userId: ctx.session.userId!,
            success: false,
            verificationMethod: `${provider}_api_error`,
            verificationDetails: {
              error: error instanceof Error ? error.message : String(error),
              provider,
              repositoryUrl: projectToClaim.gitRepoUrl,
            },
            errorReason: `API error during ${provider} verification: ${error instanceof Error ? error.message : String(error)}`,
          });
        } catch (dbError) {
          console.error('Failed to record claim attempt:', dbError);
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to verify ${provider} ownership. Please try again.`,
        });
      }
    }),
  canClaimProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const projectToCheck = await ctx.db.query.project.findFirst({
        where: eq(project.id, input.projectId),
      });

      if (!projectToCheck) {
        return { canClaim: false, reason: 'Project not found' };
      }

      const provider = projectToCheck.gitHost as (typeof projectProviderEnum.enumValues)[number];

      if (projectToCheck.ownerId) {
        return { canClaim: false, reason: 'Project already claimed' };
      }

      if (!projectToCheck.gitRepoUrl) {
        return { canClaim: false, reason: `No ${provider} repository URL` };
      }

      const userId = ctx.session.userId;
      if (!userId) {
        return { canClaim: false, reason: 'Not logged in' };
      }

      const userAccount = await ctx.db
        .select({ accessToken: account.accessToken })
        .from(account)
        .where(and(eq(account.userId, userId), eq(account.providerId, provider)))
        .limit(1);

      if (!userAccount[0]?.accessToken) {
        return {
          canClaim: false,
          reason: `${provider} account not connected`,
          needsAuth: true,
        };
      }

      return {
        canClaim: true,
        projectName: projectToCheck.name,
        gitRepoUrl: projectToCheck.gitRepoUrl,
      };
    }),
  debugRepositoryPermissions: protectedProcedure
    .input(z.object({ repoUrl: z.string(), projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      if (!userId) {
        return { error: 'Not logged in' };
      }

      const projectToCheck = await ctx.db.query.project.findFirst({
        where: eq(project.id, input.projectId),
      });

      if (!projectToCheck) {
        return { error: 'Project not found' };
      }

      const provider = projectToCheck.gitHost as (typeof projectProviderEnum.enumValues)[number];

      const userAccount = await ctx.db
        .select({ accessToken: account.accessToken })
        .from(account)
        .where(and(eq(account.userId, userId), eq(account.providerId, provider)))
        .limit(1);

      if (!userAccount[0]?.accessToken) {
        return { error: `${provider} account not connected` };
      }

      const match = input.repoUrl.match(PROVIDER_URL_PATTERNS[provider]);
      if (!match) {
        return { error: `Invalid ${provider} repository URL format` };
      }
      const [, owner, repo] = match;

      const driver = await getActiveDriver(provider, ctx as Context);

      if (!owner || !repo) {
        return { error: 'Invalid repository format' };
      }

      try {
        const currentUser = await driver.getCurrentUser();
        const repoData = await driver.getRepo(`${owner}/${repo}`);

        const result: DebugPermissionsResult = {
          currentUser: currentUser.username,
          repoOwner: repoData.owner.login,
          repoOwnerType: repoData.owner.type,
          isDirectOwner: repoData.owner.login === currentUser.username,
        };

        try {
          const repoPermissions = await driver.getRepoPermissions(`${owner}/${repo}`);

          result.repoPermission = repoPermissions.permission;
          result.repoPermissionDetails = repoPermissions;
        } catch (e) {
          result.repoPermission = 'none';
          result.repoPermissionError = e instanceof Error ? e.message : String(e);
        }

        if (repoData.owner.type === 'Organization') {
          try {
            const membership = await driver.getOrgMembership(
              repoData.owner.login,
              currentUser.username,
            );
            result.orgMembership = {
              role: membership.role,
              state: membership.state,
            };
          } catch (e) {
            result.orgMembership = 'not a member';
            result.orgMembershipError = e instanceof Error ? e.message : String(e);
          }
        }

        return result;
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) } as const;
      }
    }),

  refreshRepoStatus: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const foundProject = await ctx.db.query.project.findFirst({
        where: eq(project.id, input.projectId),
      });

      if (!foundProject) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      if (foundProject.ownerId !== ctx.session.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only refresh status of your own projects',
        });
      }

      // Early validation: Check if project has required repository fields
      if (!foundProject.gitHost || !foundProject.gitRepoUrl) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Project must have both gitHost and gitRepoUrl configured to refresh repository status',
        });
      }

      // Validate gitHost is supported
      const supportedHosts = ['github', 'gitlab'] as const;
      if (!supportedHosts.includes(foundProject.gitHost as any)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unsupported git host: ${foundProject.gitHost}. Supported hosts: ${supportedHosts.join(', ')}`,
        });
      }

      // Validate repository URL format early
      const urlPattern =
        PROVIDER_URL_PATTERNS[foundProject.gitHost as keyof typeof PROVIDER_URL_PATTERNS];
      if (!urlPattern) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `No URL pattern configured for git host: ${foundProject.gitHost}`,
        });
      }

      const match = foundProject.gitRepoUrl.match(urlPattern);
      if (!match) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid ${foundProject.gitHost} repository URL format. Expected format: ${foundProject.gitHost === 'github' ? 'https://github.com/owner/repo' : 'https://gitlab.com/owner/repo'}`,
        });
      }

      const [, owner, repo] = match;
      if (!owner || !repo) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Could not extract owner and repository name from URL',
        });
      }

      const repoIdentifier = `${owner}/${repo}`;

      try {
        // Get the driver for the git host
        const driver = await getActiveDriver(
          foundProject.gitHost as 'github' | 'gitlab',
          ctx as Context,
        );

        // Fetch repository data
        const repoData = await driver.getRepo(repoIdentifier);
        const isRepoPrivate = repoData.isPrivate || false;

        // Update the project's privacy status if it has changed
        if (foundProject.isRepoPrivate !== isRepoPrivate) {
          await ctx.db
            .update(project)
            .set({
              isRepoPrivate,
              updatedAt: new Date(),
            })
            .where(eq(project.id, input.projectId));

          return {
            success: true,
            wasPrivate: foundProject.isRepoPrivate,
            isNowPrivate: isRepoPrivate,
            statusChanged: true,
          };
        }

        return {
          success: true,
          wasPrivate: foundProject.isRepoPrivate,
          isNowPrivate: isRepoPrivate,
          statusChanged: false,
        };
      } catch (error) {
        // Log error details for debugging
        console.error('Error refreshing repository status:', {
          projectId: input.projectId,
          gitHost: foundProject.gitHost,
          gitRepoUrl: foundProject.gitRepoUrl,
          repoIdentifier,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Handle specific error types
        if (error instanceof TRPCError) {
          throw error;
        }

        // Check for specific error conditions
        if (error instanceof Error) {
          // Repository not found or access denied
          if (error.message.includes('Not Found') || error.message.includes('404')) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Repository '${repoIdentifier}' not found or is inaccessible`,
            });
          }

          // Authentication/authorization errors
          if (
            error.message.includes('Unauthorized') ||
            error.message.includes('401') ||
            error.message.includes('403')
          ) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: `Authentication failed for ${foundProject.gitHost}. Please check your credentials and permissions.`,
            });
          }

          // Rate limiting errors
          if (error.message.includes('rate limit') || error.message.includes('429')) {
            throw new TRPCError({
              code: 'TOO_MANY_REQUESTS',
              message: `${foundProject.gitHost} rate limit exceeded. Please try again later.`,
            });
          }

          // Network or connection errors
          if (
            error.message.includes('ENOTFOUND') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout')
          ) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Network error connecting to ${foundProject.gitHost}. Please try again later.`,
            });
          }

          // Driver initialization errors
          if (error.message.includes('driver') || error.message.includes('Driver')) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to initialize ${foundProject.gitHost} driver. Please contact support.`,
            });
          }

          // Generic error with details
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to refresh repository status: ${error.message}`,
          });
        }

        // Fallback for non-Error objects
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while refreshing repository status',
        });
      }
    }),

  getContributors: publicProcedure
    .input(z.object({ url: z.string(), provider: z.enum(['github', 'gitlab']) }))
    .query(async ({ ctx, input }) => {
      const driver = await getActiveDriver(input.provider, ctx as Context);

      const contributors = await driver.getContributors(input.url);

      return contributors;
    }),

  getUnSubmitted: publicProcedure
    .input(
      z.object({
        provider: z.enum(['github', 'gitlab']),
        username: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { provider, username, userId } = input;
      const driver = await getActiveDriver(provider, ctx as Context);
      const unSubmitted = await driver.getUnsubmittedRepos(ctx as Context, username, userId);
      return unSubmitted;
    }),
});
