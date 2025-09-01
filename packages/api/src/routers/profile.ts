import {
  account,
  project,
  projectClaim,
  projectComment,
  projectLaunch,
  projectVote,
  user,
} from '@workspace/db/schema';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';
import { getActiveDriver, type Context } from '../driver/utils';
import { TRPCError } from '@trpc/server';
import { desc, eq, and } from 'drizzle-orm';
import { z } from 'zod';

type ActivityItem = {
  id: string;
  type: 'project_created' | 'comment' | 'upvote' | 'project_launch' | 'project_claim';
  timestamp: Date;
  title: string;
  description: string | null;
  projectName: string;
  projectId: string;
  projectLogoUrl?: string | null;
  commentContent?: string;
  tagline?: string;
  claimSuccess?: boolean;
  verificationMethod?: string;
  data: any;
};

export const profileRouter = createTRPCRouter({
  getProfile: publicProcedure.input(z.object({
    id: z.string(),
    provider: z.enum(['github', 'gitlab']).optional()
  })).query(async ({ ctx, input }) => {
    const targetId = input.id;

    const profileUser = await ctx.db.query.user.findFirst({
      where: eq(user.id, input.id),
    });

    if (!profileUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    // If provider is specified, look for that specific account
    // Otherwise, get the first available account (backward compatibility)
    const userAccount = input.provider
      ? await ctx.db.query.account.findFirst({
          where: and(eq(account.userId, targetId), eq(account.providerId, input.provider)),
        })
      : await ctx.db.query.account.findFirst({
          where: eq(account.userId, targetId),
        });

    if (!userAccount || !userAccount.providerId) {
      const providerMessage = input.provider ? ` for ${input.provider}` : '';
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `User account or provider not found${providerMessage}`,
      });
    }

    const driver = await getActiveDriver(
      userAccount.providerId as 'github' | 'gitlab',
      ctx as Context,
    );
    const userDetails = await driver.getUserDetails(profileUser.username);

    return {
      ...profileUser,
      git: userDetails,
      provider: userAccount.providerId,
    };
  }),
  getUserProviders: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const accounts = await ctx.db.query.account.findMany({
        where: eq(account.userId, input.id),
        columns: {
          providerId: true,
        },
      });

      return {
        providers: accounts.map(acc => acc.providerId),
      };
    }),
  gitDetails: publicProcedure
    .input(
      z.object({
        provider: z.enum(['github', 'gitlab']),
        username: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { provider, username } = input;

      try {
        const driver = await getActiveDriver(provider, ctx);
        const userDetails = await driver.getUserDetails(username);
        return userDetails;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user details',
        });
      }
    }),
  getRecentActivities: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { userId } = input;

      const [userProjects, userComments, userVotes, userClaims] = await Promise.all([
        ctx.db.query.project.findMany({
          where: eq(project.ownerId, userId),
          orderBy: [desc(project.createdAt)],
          limit: 20,
          with: {
            owner: true,
          },
        }),

        ctx.db.query.projectComment.findMany({
          where: eq(projectComment.userId, userId),
          orderBy: [desc(projectComment.createdAt)],
          limit: 20,
          with: {
            project: true,
            user: true,
          },
        }),

        ctx.db.query.projectVote.findMany({
          where: eq(projectVote.userId, userId),
          orderBy: [desc(projectVote.createdAt)],
          limit: 20,
          with: {
            project: true,
            user: true,
          },
        }),

        ctx.db.query.projectClaim.findMany({
          where: eq(projectClaim.userId, userId),
          orderBy: [desc(projectClaim.createdAt)],
          limit: 20,
          with: {
            project: true,
            user: true,
          },
        }),
      ]);

      const projectsWithLaunches = await ctx.db.query.projectLaunch.findMany({
        where: (launch, { inArray }) =>
          inArray(
            launch.projectId,
            userProjects.map((p) => p.id),
          ),
        orderBy: [desc(projectLaunch.launchDate)],
        with: {
          project: {
            with: {
              owner: true,
            },
          },
        },
      });

      const activities: ActivityItem[] = [
        ...userProjects.map((p) => ({
          id: p.id,
          type: 'project_created' as const,
          timestamp: p.createdAt,
          title: `Created project "${p.name}"`,
          description: p.description,
          projectName: p.name,
          projectId: p.id,
          projectLogoUrl: p.logoUrl,
          data: p,
        })),
        ...userComments.map((c) => ({
          id: c.id,
          type: 'comment' as const,
          timestamp: c.createdAt,
          title: `Commented on "${c.project.name}"`,
          description: c.content.length > 100 ? c.content.substring(0, 100) + '...' : c.content,
          projectName: c.project.name,
          projectId: c.project.id,
          commentContent: c.content,
          data: c,
        })),
        ...userVotes.map((v) => ({
          id: v.id,
          type: 'upvote' as const,
          timestamp: v.createdAt,
          title: `Upvoted "${v.project.name}"`,
          description: v.project.description,
          projectName: v.project.name,
          projectId: v.project.id,
          projectLogoUrl: v.project.logoUrl,
          data: v,
        })),
        ...userClaims.map((c) => ({
          id: c.id,
          type: 'project_claim' as const,
          timestamp: c.createdAt,
          title: `${c.success ? 'Successfully claimed' : 'Attempted to claim'} "${c.project.name}"`,
          description: c.success
            ? `Verified ownership via ${c.verificationMethod}`
            : `Failed: ${c.errorReason || 'Unknown error'}`,
          projectName: c.project.name,
          projectId: c.project.id,
          projectLogoUrl: c.project.logoUrl,
          claimSuccess: c.success,
          verificationMethod: c.verificationMethod,
          data: c,
        })),
        ...projectsWithLaunches.map((l) => ({
          id: l.id,
          type: 'project_launch' as const,
          timestamp: l.launchDate,
          title: `Launched "${l.project.name}"`,
          description: l.tagline || l.project.description,
          projectName: l.project.name,
          projectId: l.project.id,
          projectLogoUrl: l.project.logoUrl,
          tagline: l.tagline,
          data: l,
        })),
      ];

      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return activities.slice(0, 50);
    }),
  getUserContributions: publicProcedure
    .input(
      z.object({
        username: z.string(),
        provider: z.enum(['github', 'gitlab']),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { username, provider } = input;

      try {
        const driver = await getActiveDriver(provider, ctx);
        const contributions = await driver.getContributions(username);
        return contributions;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user contributions',
        });
      }
    }),
  getUserPullRequests: publicProcedure
    .input(
      z.object({
        username: z.string(),
        provider: z.enum(['github', 'gitlab']),
        state: z.enum(['open', 'closed', 'merged', 'all']).optional().default('all'),
        limit: z.number().min(1).max(100).optional().default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { username, provider, state, limit } = input;

      try {
        const driver = await getActiveDriver(provider, ctx);
        const pullRequests = await driver.getUserPullRequests(username, {
          state,
          limit,
        });

        return {
          pullRequests,
          count: pullRequests.length,
          provider,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user pull requests',
        });
      }
    }),
});
