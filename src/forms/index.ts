import { z } from 'zod/v4';

import { projectStatuses, projectTags, projectTypes } from '@/lib/project-options';

const webUrlMessage = 'Enter a valid http(s) URL.';

function isSafeWebUrl(value: string) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const optionalWebUrl = z.string().trim().refine(isSafeWebUrl, {
  message: webUrlMessage,
});

export const projectForm = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().min(1, 'Project description is required'),
  logoUrl: optionalWebUrl.optional(),
  gitRepoUrl: z
    .string()
    .refine((val) => !val || val === '' || /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(val), {
      message: 'Invalid GitHub repository format. Use: username/repository',
    })
    .min(1, 'Repository URL is required'),
  gitHost: z.enum(['github', 'gitlab']),
  status: z.enum(projectStatuses),
  type: z.enum(projectTypes),
  tags: z.array(z.enum(projectTags)),
  isLookingForContributors: z.boolean(),
  isLookingForInvestors: z.boolean(),
  isHiring: z.boolean(),
  isPublic: z.boolean(),
  hasBeenAcquired: z.boolean(),
  socialLinks: z
    .object({
      twitter: optionalWebUrl.optional(),
      discord: optionalWebUrl.optional(),
      linkedin: optionalWebUrl.optional(),
      website: optionalWebUrl.optional(),
    })
    .optional(),
});
