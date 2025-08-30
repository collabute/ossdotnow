import { APPROVAL_STATUS, checkProjectDuplicate, resolveAllIds } from '../utils/project-helpers';
import { project, projectTagRelations } from '@workspace/db/schema';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { getRateLimiter } from '../utils/rate-limit';
import { getActiveDriver } from '../driver/utils';
import { createInsertSchema } from 'drizzle-zod';
import { TRPCError } from '@trpc/server';
import { count, eq } from 'drizzle-orm';
import { getIp } from '../utils/ip';
import { z } from 'zod/v4';

const createProjectInput = createInsertSchema(project)
  .omit({
    id: true,
    ownerId: true,
    statusId: true,
    typeId: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
  })
  .extend({
    status: z.string().min(1, 'Project status is required'),
    type: z.string().min(1, 'Project type is required'),
    tags: z.array(z.string()).default([]),
  });

export const earlySubmissionRouter = createTRPCRouter({
  checkDuplicateRepo: publicProcedure
    .input(z.object({ gitRepoUrl: z.string(), gitHost: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      let repoId: string | undefined;
      if (input.gitHost) {
        try {
          const driver = await getActiveDriver(input.gitHost as 'github' | 'gitlab', ctx);
          const repoData = await driver.getRepo(input.gitRepoUrl);
          repoId = repoData.id?.toString();
        } catch (error) {
          console.warn('Could not fetch repo data for duplicate check:', error);
        }
      }
      return await checkProjectDuplicate(ctx.db, input.gitRepoUrl, repoId);
    }),

  addProject: publicProcedure.input(createProjectInput).mutation(async ({ ctx, input }) => {
    const limiter = getRateLimiter('early-access-waitlist');
    if (limiter) {
      const ip = getIp(ctx.headers);
      const safeIp = ip || `anonymous-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const { success } = await limiter.limit(safeIp);
      if (!success) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests. Please try again later.',
        });
      }
    }

    // Validate repository and get privacy status
    let isRepoPrivate = false;
    let repoId: string | null = null;
    if (input.gitHost && input.gitRepoUrl) {
      try {
        const driver = await getActiveDriver(input.gitHost as 'github' | 'gitlab', ctx);
        const repoData = await driver.getRepo(input.gitRepoUrl);
        isRepoPrivate = repoData.isPrivate || false;
        repoId = repoData.id?.toString() || null;
      } catch (error) {
        // If there's an error fetching the repo, we'll continue with the flow
        // This allows for cases where the repo might be temporarily unavailable
      }
    }

    // Check for duplicates BEFORE attempting insertion
    const duplicateCheck = await checkProjectDuplicate(
      ctx.db,
      input.gitRepoUrl,
      repoId || undefined,
    );
    if (duplicateCheck.exists) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `This repository has already been submitted! The project "${duplicateCheck.projectName}" has ${duplicateCheck.statusMessage}. If you think this is an error, please contact support.`,
      });
    }

    const { statusId, typeId, tagIds } = await resolveAllIds(ctx.db, {
      status: input.status,
      type: input.type,
      tags: input.tags,
    });

    return await ctx.db.transaction(async (tx) => {
      // Check if there's an existing project with the same URL that needs to be soft-deleted
      const existingProject = await tx.query.project.findFirst({
        where: eq(project.gitRepoUrl, input.gitRepoUrl),
      });

      if (existingProject) {
        await tx
          .update(project)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(project.id, existingProject.id));
      }

      const [newProject] = await tx
        .insert(project)
        .values({
          logoUrl: input.logoUrl,
          gitRepoUrl: input.gitRepoUrl,
          gitHost: input.gitHost,
          name: input.name,
          repoId: repoId!,
          description: input.description,
          socialLinks: input.socialLinks,
          isLookingForContributors: input.isLookingForContributors,
          isLookingForInvestors: input.isLookingForInvestors,
          isHiring: input.isHiring,
          isPublic: input.isPublic,
          hasBeenAcquired: input.hasBeenAcquired,
          acquiredBy: input.acquiredBy,
          ownerId: null,
          approvalStatus: APPROVAL_STATUS.PENDING,
          statusId,
          typeId,
          isRepoPrivate,
        })
        .returning();

      if (!newProject) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create project. Please try again.',
        });
      }

      if (tagIds.length > 0 && newProject?.id) {
        const tagRelations = tagIds.map((tagId: string) => ({
          projectId: newProject.id as string,
          tagId: tagId as string,
        }));
        await tx.insert(projectTagRelations).values(tagRelations);
      }

      const [totalCount] = await tx.select({ count: count() }).from(project);
      return {
        project: newProject,
        totalCount: totalCount?.count ?? 0,
      };
    });
  }),

  getEarlySubmissionsCount: publicProcedure.query(async ({ ctx }) => {
    const earlySubmissionsCount = await ctx.db.select({ count: count() }).from(project);
    if (!earlySubmissionsCount[0]) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get waitlist count',
      });
    }
    return {
      count: earlySubmissionsCount[0].count,
    };
  }),
});
