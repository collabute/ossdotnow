import { APPROVAL_STATUS, checkProjectDuplicate, resolveAllIds } from '../utils/project-helpers';
import { project, projectTagRelations, projectClaim } from '@workspace/db/schema';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { getRateLimiter } from '../utils/rate-limit';
import { getActiveDriver } from '../driver/utils';
import { invalidateCache } from '../utils/cache';
import { createInsertSchema } from 'drizzle-zod';
import { type Context } from '../driver/utils';
import { user } from '@workspace/db/schema';
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

async function checkUserOwnsProject(ctx: Context, gitRepoUrl: string) {
  const githubUrlRegex = /(?:https?:\/\/github\.com\/|^)([^/]+)\/([^/]+?)(?:\.git|\/|$)/;
  const match = gitRepoUrl.match(githubUrlRegex);
  let ownerId = null;
  const owner: string | undefined = match ? match[1] : undefined;

  if (typeof owner === 'string') {
    const userResult = await ctx.db.query.user.findFirst({
      where: eq(user.username, owner),
      columns: { id: true, username: true },
    });
    if (userResult) {
      ownerId = userResult.id;
      return { isOwner: true, ownerId, userResult, owner };
    } else {
      return {
        isOwner: false,
        owner,
      };
    }
  } else {
    return {
      isOwner: false,
      error: 'Invalid format. Use: username/repository',
    };
  }
}

export const submissionRouter = createTRPCRouter({
  checkDuplicateRepo: publicProcedure
    .input(z.object({ gitRepoUrl: z.string(), gitHost: z.string().optional(), }))
    .query(async ({ ctx, input }) => {
      // return await checkProjectDuplicate(ctx.db, input.gitRepoUrl);
      let repoId: string | undefined;if (input.gitHost) {
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
  checkUserOwnsProject: publicProcedure
    .input(z.object({ gitRepoUrl: z.string() }))
    .query(async ({ ctx, input }) => {
      return await checkUserOwnsProject(ctx, input.gitRepoUrl);
    }),
  addProject: publicProcedure.input(createProjectInput).mutation(async ({ ctx, input }) => {
    const limiter = getRateLimiter('submission');
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

    const duplicateCheck = await checkProjectDuplicate(ctx.db, input.gitRepoUrl, repoId || undefined);
    if (duplicateCheck.exists) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `This repository has already been submitted! The project "${duplicateCheck.projectName}" has ${duplicateCheck.statusMessage}. If you think this is an error, please contact support.`,
      });
    }
    

    const ownerCheck = await checkUserOwnsProject(ctx, input.gitRepoUrl);
    if (ownerCheck.error) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: ownerCheck.error,
      });
    }
    const ownerId = ownerCheck.ownerId;
    const { statusId, typeId, tagIds } = await resolveAllIds(ctx.db, {
      status: input.status,
      type: input.type,
      tags: input.tags,
    });

    // Wrap only the atomic database operations in a transaction
    return await ctx.db.transaction(async (tx) => {
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
          ownerId,
          approvalStatus: APPROVAL_STATUS.PENDING,
          statusId,
          typeId,
          isRepoPrivate,
        })
        .onConflictDoNothing({ target: project.gitRepoUrl })
        .returning();

      if (!newProject) {
        const existing = await tx
          .select({
            name: project.name,
            approvalStatus: project.approvalStatus,
          })
          .from(project)
          .where(eq(project.gitRepoUrl, input.gitRepoUrl))
          .limit(1);

        const statusMsg =
          existing[0]?.approvalStatus === 'approved'
            ? 'approved and is already listed'
            : existing[0]?.approvalStatus === 'pending'
              ? 'pending review'
              : 'been submitted but was rejected';

        throw new TRPCError({
          code: 'CONFLICT',
          message: `This repository has already been submitted! The project "${existing[0]?.name}" has ${statusMsg}. If you think this is an error, please contact support.`,
        });
      }
      if (tagIds.length > 0 && newProject?.id) {
        const tagRelations = tagIds.map((tagId: string) => ({
          projectId: newProject.id as string,
          tagId: tagId as string,
        }));
        await tx.insert(projectTagRelations).values(tagRelations);
      }
      if (ownerId && newProject?.id && ctx.session?.userId) {
        await tx.insert(projectClaim).values({
          projectId: newProject.id,
          userId: ctx.session.userId,
          success: true,
          verificationMethod: 'submission_username_match',
          verificationDetails: {
            verifiedAs: ownerCheck.userResult?.username || 'unknown',
            submissionMethod: 'auto_claim_during_submission',
            repositoryUrl: input.gitRepoUrl,
            matchedUsername: ownerCheck.owner,
          },
        });
      }

      invalidateCache(`${input.gitHost as 'github' | 'gitlab'}:unsubmitted:${ownerCheck.owner}`);
      const [totalCount] = await tx.select({ count: count() }).from(project);
      return {
        count: totalCount?.count ?? 0,
      };
    });
  }),
  getSubmissionsCount: publicProcedure.query(async ({ ctx }) => {
    const submissionsCount = await ctx.db.select({ count: count() }).from(project);

    if (!submissionsCount[0]) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get waitlist count',
      });
    }

    return {
      count: submissionsCount[0].count,
    };
  }),
});
