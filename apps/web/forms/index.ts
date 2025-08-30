import { createInsertSchema } from 'drizzle-zod';
import { project } from '@workspace/db/schema';
import { z } from 'zod/v4';

export const waitlistForm = z.object({
  email: z.email(),
});

export const loginForm = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const earlySubmissionForm = createInsertSchema(project)
  .omit({
    id: true,
    ownerId: true,
    statusId: true,
    typeId: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    repoId: true,
  })
  .extend({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().min(1, 'Project description is required'),
    gitRepoUrl: z
      .string()
      .refine((val) => !val || val === '' || /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(val), {
        message: 'Invalid GitHub repository format. Use: username/repository',
      })
      .min(1, 'Repository URL is required'),
    socialLinks: z
      .object({
        twitter: z.url('Invalid URL format').optional().or(z.literal('')),
        discord: z.url('Invalid URL format').optional().or(z.literal('')),
        linkedin: z.url('Invalid URL format').optional().or(z.literal('')),
        website: z.url('Invalid URL format').optional().or(z.literal('')),
      })
      .optional(),
    status: z.string().min(1, 'Project status is required').optional(),
    type: z.string().min(1, 'Project type is required').optional(),
    tags: z.array(z.string()).default([]).optional(),
  });

export const submisionForm = createInsertSchema(project)
  .omit({
    id: true,
    ownerId: true,
    statusId: true,
    typeId: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    repoId: true,
  })
  .extend({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().min(1, 'Project description is required'),
    gitRepoUrl: z
      .string()
      .refine((val) => !val || val === '' || /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(val), {
        message: 'Invalid GitHub repository format. Use: username/repository',
      })
      .min(1, 'Repository URL is required'),
    socialLinks: z
      .object({
        twitter: z.url('Invalid URL format').optional().or(z.literal('')),
        discord: z.url('Invalid URL format').optional().or(z.literal('')),
        linkedin: z.url('Invalid URL format').optional().or(z.literal('')),
        website: z.url('Invalid URL format').optional().or(z.literal('')),
      })
      .optional(),
    status: z.string().min(1, 'Project status is required').optional(),
    type: z.string().min(1, 'Project type is required').optional(),
    tags: z.array(z.string()).default([]).optional(),
  });
