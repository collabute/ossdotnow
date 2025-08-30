'use client';

import { projectApprovalStatusEnum, projectProviderEnum } from '@workspace/db/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDebouncedCallback } from 'use-debounce';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTRPC } from '@/hooks/use-trpc';
import { useForm } from 'react-hook-form';
import { Project } from '@/types/project';
import { toast } from 'sonner';
import { z } from 'zod/v4';

const editProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string(),
  gitRepoUrl: z.string().min(1, 'Repository URL is required'),
  gitHost: z.enum(projectProviderEnum.enumValues),
  repoId: z.string(),
  logoUrl: z.string(),
  approvalStatus: z.enum(projectApprovalStatusEnum.enumValues),
  status: z.string().min(1, 'Project status is required'),
  type: z.string().min(1, 'Project type is required'),
  tags: z.array(z.string()),
  socialLinks: z.object({
    twitter: z.string(),
    discord: z.string(),
    linkedin: z.string(),
    website: z.string(),
  }),
  isLookingForContributors: z.boolean(),
  isLookingForInvestors: z.boolean(),
  isHiring: z.boolean(),
  isPublic: z.boolean(),
  hasBeenAcquired: z.boolean(),
  isPinned: z.boolean(),
  isRepoPrivate: z.boolean(),
});

export type EditProjectFormData = z.infer<typeof editProjectSchema>;

interface ProjectEditFormProps {
  projectData: Project | null;
  projectId: string;
}

export function ProjectEditForm({ projectData, projectId }: ProjectEditFormProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const updateProjectMutation = useMutation({
    ...trpc.projects.updateProject.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.projects.getProjectsAdmin.queryKey({}),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.projects.getProject.queryKey({ id: projectId }),
      });
      toast.success('Project updated successfully');
      router.push('/admin/projects');
    },
    onError: (error) => {
      toast.error(`Failed to update project: ${error.message}`);
    },
  });

  const form = useForm({
    resolver: zodResolver(editProjectSchema),
    defaultValues: {
      name: '',
      description: '',
      gitRepoUrl: '',
      gitHost: 'github' as const,
      repoId: '',
      logoUrl: '',
      approvalStatus: 'pending' as const,
      status: '',
      type: '',
      tags: [],
      socialLinks: {
        twitter: '',
        discord: '',
        linkedin: '',
        website: '',
      },
      isLookingForContributors: false,
      isLookingForInvestors: false,
      isHiring: false,
      isPublic: false,
      hasBeenAcquired: false,
      isPinned: false,
      isRepoPrivate: false,
    },
  });

  // Repository validation state
  const [repoValidation, setRepoValidation] = useState<{
    isValidating: boolean;
    isValid: boolean | null;
    message: string | null;
  }>({
    isValidating: false,
    isValid: null,
    message: null,
  });

  // Confirmation dialog state
  const [showRepoChangeDialog, setShowRepoChangeDialog] = useState(false);
  const [pendingRepoChange, setPendingRepoChange] = useState<{
    gitRepoUrl: string;
    gitHost: (typeof projectProviderEnum.enumValues)[number];
  } | null>(null);

  const parseRepositoryUrl = (
    input: string,
  ): { repo: string; host: (typeof projectProviderEnum.enumValues)[number] } | null => {
    const trimmedInput = input.trim();

    const githubPatterns = [
      /^https?:\/\/github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?(?:\/.*)?$/,
      /^git@github\.com:([^/]+)\/([^/\s]+?)(?:\.git)?$/,
      /^github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?(?:\/.*)?$/,
    ];

    const gitlabPatterns = [
      /^https?:\/\/gitlab\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?(?:\/.*)?$/,
      /^git@gitlab\.com:([^/]+)\/([^/\s]+?)(?:\.git)?$/,
      /^gitlab\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?(?:\/.*)?$/,
    ];

    for (const pattern of githubPatterns) {
      const match = trimmedInput.match(pattern);
      if (match?.[1] && match?.[2]) {
        return {
          repo: `${match[1]}/${match[2]}`,
          host: 'github',
        };
      }
    }

    for (const pattern of gitlabPatterns) {
      const match = trimmedInput.match(pattern);
      if (match?.[1] && match?.[2]) {
        return {
          repo: `${match[1]}/${match[2]}`,
          host: 'gitlab',
        };
      }
    }

    return null;
  };

  const validateRepository = useCallback(
    async (repoUrl: string, gitHost: string) => {
      if (!repoUrl || repoUrl.trim() === '') {
        setRepoValidation({
          isValidating: false,
          isValid: null,
          message: null,
        });
        return;
      }

      const formatRegex = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/;
      if (!formatRegex.test(repoUrl)) {
        setRepoValidation({
          isValidating: false,
          isValid: false,
          message: 'Invalid format. Use: username/repository',
        });
        return;
      }

      setRepoValidation({
        isValidating: true,
        isValid: null,
        message: null,
      });

      try {
        const result = await queryClient.fetchQuery(
          trpc.repository.getRepo.queryOptions({
            url: repoUrl,
            provider: gitHost as (typeof projectProviderEnum.enumValues)[number],
          }),
        );

        if (result) {
          setRepoValidation({
            isValidating: false,
            isValid: true,
            message: result.isPrivate
              ? 'Private repository detected. Admin cannot modify private repos without proper credentials.'
              : 'Repository found and available!',
          });
          form.setValue('repoId', result.id.toString());
        }
      } catch (error) {
        console.error('Repository validation error:', error);
        setRepoValidation({
          isValidating: false,
          isValid: false,
          message: 'Repository not found or unable to access',
        });
      }
    },
    [queryClient, trpc, form],
  );

  const debouncedValidateRepo = useDebouncedCallback((repoUrl: string, gitHost: string) => {
    validateRepository(repoUrl, gitHost);
  }, 500);

  const handleRepoChange = (
    newRepoUrl: string,
    newGitHost: (typeof projectProviderEnum.enumValues)[number],
  ) => {
    const currentRepoUrl = form.getValues('gitRepoUrl');
    const currentGitHost = form.getValues('gitHost');

    if (newRepoUrl !== currentRepoUrl || newGitHost !== currentGitHost) {
      if (projectData?.isRepoPrivate) {
        toast.error(
          'Cannot modify repository URL for private repositories without proper credentials.',
        );
        return;
      }

      form.setValue('gitRepoUrl', newRepoUrl);
      form.setValue('gitHost', newGitHost);
      debouncedValidateRepo(newRepoUrl, newGitHost);
    } else {
      form.setValue('gitRepoUrl', newRepoUrl);
      form.setValue('gitHost', newGitHost);
      debouncedValidateRepo(newRepoUrl, newGitHost);
    }
  };

  const confirmRepoChange = () => {
    if (pendingRepoChange) {
      form.setValue('gitRepoUrl', pendingRepoChange.gitRepoUrl);
      form.setValue('gitHost', pendingRepoChange.gitHost);

      setShowRepoChangeDialog(false);
      setPendingRepoChange(null);

      const formData = form.getValues();
      updateProjectMutation.mutate({
        id: projectId,
        ...formData,
      });
    }
  };

  const cancelRepoChange = () => {
    setShowRepoChangeDialog(false);
    setPendingRepoChange(null);
  };

  const onSubmit = (data: EditProjectFormData) => {
    const originalRepoUrl = projectData?.gitRepoUrl;
    const originalGitHost = projectData?.gitHost;

    if (data.gitRepoUrl !== originalRepoUrl || data.gitHost !== originalGitHost) {
      if (projectData?.isRepoPrivate) {
        toast.error(
          'Cannot modify repository URL for private repositories without proper credentials.',
        );
        return;
      }

      setPendingRepoChange({ gitRepoUrl: data.gitRepoUrl, gitHost: data.gitHost });
      setShowRepoChangeDialog(true);
      return;
    }

    updateProjectMutation.mutate({
      id: projectId,
      ...data,
    });
  };

  return {
    form,
    repoValidation,
    showRepoChangeDialog,
    pendingRepoChange,
    updateProjectMutation,
    parseRepositoryUrl,
    handleRepoChange,
    confirmRepoChange,
    cancelRepoChange,
    onSubmit,
  };
}
