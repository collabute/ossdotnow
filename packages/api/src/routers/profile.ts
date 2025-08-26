import {
  account,
  project,
  projectClaim,
  projectComment,
  projectLaunch,
  projectVote,
  user,
  endorsement,
} from '@workspace/db/schema';
import { getActiveDriver, type Context } from '../driver/utils';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { desc, eq, or } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

type ActivityItem = {
  id: string;
  type:
    | 'project_created'
    | 'comment'
    | 'upvote'
    | 'project_launch'
    | 'project_claim'
    | 'endorsement_given'
    | 'endorsement_received';
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
  endorserName?: string;
  endorsedUserName?: string;
  endorsementType?: string;
  data: unknown;
};

export const profileRouter = createTRPCRouter({
  getProfile: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
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

    const userAccount = await ctx.db.query.account.findFirst({
      where: eq(account.userId, targetId),
    });

    if (!userAccount || !userAccount.providerId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User account or provider not found',
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

      const [userProjects, userComments, userVotes, userClaims, userEndorsements] =
        await Promise.all([
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

          ctx.db.query.endorsement.findMany({
            where: or(eq(endorsement.endorserId, userId), eq(endorsement.endorsedUserId, userId)),
            orderBy: [desc(endorsement.createdAt)],
            limit: 20,
            with: {
              endorser: true,
              endorsedUser: true,
              project: true,
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
        ...userEndorsements.map((e) => {
          const isEndorser = e.endorserId === userId;
          const projectInfo = e.project || (e.projectName ? { name: e.projectName, id: '' } : null);

          return {
            id: e.id,
            type: isEndorser ? ('endorsement_given' as const) : ('endorsement_received' as const),
            timestamp: e.createdAt,
            title: isEndorser
              ? `Endorsed ${e.endorsedUser.name || 'a user'}`
              : `Received endorsement from ${e.endorser.name || 'a user'}`,
            description: e.content.length > 100 ? e.content.substring(0, 100) + '...' : e.content,
            projectName: projectInfo?.name || '',
            projectId: projectInfo?.id || '',
            projectLogoUrl: e.project?.logoUrl || null,
            endorserName: e.endorser.name,
            endorsedUserName: e.endorsedUser.name,
            endorsementType: e.type,
            data: e,
          };
        }),
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
