import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';
import { endorsement, project } from '@workspace/db/schema';
import { and, eq, desc, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import z from 'zod';

export const endorsementsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        endorsedUserId: z.string(),
        type: z.enum(['project', 'work', 'general']),
        content: z.string().min(10).max(1000),
        projectId: z.string().uuid().optional(),
        projectName: z.string().optional(),
        workDetails: z
          .object({
            company: z.string().optional(),
            role: z.string().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.endorsedUserId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot endorse yourself',
        });
      }

      const existingEndorsement = await ctx.db.query.endorsement.findFirst({
        where: and(
          eq(endorsement.endorserId, ctx.user.id),
          eq(endorsement.endorsedUserId, input.endorsedUserId),
        ),
      });

      if (existingEndorsement) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You have already endorsed this user',
        });
      }

      const newEndorsement = await ctx.db
        .insert(endorsement)
        .values({
          endorserId: ctx.user.id,
          endorsedUserId: input.endorsedUserId,
          type: input.type,
          content: input.content,
          projectId: input.projectId,
          projectName: input.projectName,
          workDetails: input.workDetails,
        })
        .returning();

      return newEndorsement[0];
    }),

  getEndorsements: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const endorsements = await ctx.db.query.endorsement.findMany({
        where: and(eq(endorsement.endorsedUserId, input.userId), eq(endorsement.isPublic, true)),
        with: {
          endorser: {
            columns: {
              id: true,
              name: true,
              username: true,
              image: true,
            },
          },
          project: {
            columns: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
        },
        orderBy: [desc(endorsement.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      const [totalResult] = await ctx.db
        .select({ total: count() })
        .from(endorsement)
        .where(and(eq(endorsement.endorsedUserId, input.userId), eq(endorsement.isPublic, true)));

      return {
        endorsements,
        total: totalResult?.total ?? 0,
      };
    }),

  getUserSharedProjects: protectedProcedure
    .input(
      z.object({
        targetUserId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userProjects = await ctx.db.query.project.findMany({
        where: eq(project.ownerId, ctx.user.id),
        columns: {
          id: true,
          name: true,
          logoUrl: true,
        },
      });

      const targetUserProjects = await ctx.db.query.project.findMany({
        where: eq(project.ownerId, input.targetUserId),
        columns: {
          id: true,
          name: true,
          logoUrl: true,
        },
      });

      const allProjects = [...userProjects, ...targetUserProjects];
      const uniqueProjects = Array.from(new Map(allProjects.map((p) => [p.id, p])).values());

      return uniqueProjects;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        content: z.string().min(10).max(1000),
        workDetails: z
          .object({
            company: z.string().optional(),
            role: z.string().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.endorsement.findFirst({
        where: eq(endorsement.id, input.id),
      });

      if (!existing || existing.endorserId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own endorsements',
        });
      }

      const updated = await ctx.db
        .update(endorsement)
        .set({
          content: input.content,
          workDetails: input.workDetails,
        })
        .where(eq(endorsement.id, input.id))
        .returning();

      return updated[0];
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.endorsement.findFirst({
        where: eq(endorsement.id, input.id),
      });

      if (!existing || existing.endorserId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own endorsements',
        });
      }

      await ctx.db.delete(endorsement).where(eq(endorsement.id, input.id));

      return { success: true };
    }),
});
