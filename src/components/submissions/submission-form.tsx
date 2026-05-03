'use client';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Github,
  Loader2,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';
import { MultiSelect } from '@/components/ui/multi-select';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DialogFooter } from '@/components/ui/dialog';
import { track as vercelTrack } from '@vercel/analytics/react';
import { Textarea } from '@/components/ui/textarea';
import {
  RepositorySearch,
  type RepositorySearchResult,
} from '@/components/submissions/repository-search';
import { LogoUploadField } from '@/components/submissions/logo-upload-field';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { track as databuddyTrack } from '@databuddy/sdk';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import Link from '@/components/ui/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectTags } from '@/lib/project-options';
// import { UploadDropzone } from '@/lib/uploadthing';
import { projectForm } from '@/forms';
import { authClient } from '@/lib/auth-client';
import { useTRPC } from '@/hooks/use-trpc';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { RouterOutputs } from '@/lib/api-types';
import { z } from 'zod/v4';

type ProjectSubmissionFormData = z.infer<typeof projectForm>;
type ProjectSuggestions = RouterOutputs['github']['suggestProjectFields']['suggestions'];

const draftStorageKey = 'ossdotnow:project-submission-draft:v1';

const defaultProjectFormValues = {
  name: '',
  description: '',
  logoUrl: '',
  gitRepoUrl: '',
  gitHost: 'github',
  status: 'early-stage',
  type: 'other',
  socialLinks: {
    twitter: '',
    discord: '',
    linkedin: '',
    website: '',
  },
  tags: [],
  isLookingForContributors: false,
  isLookingForInvestors: false,
  isHiring: false,
  isPublic: true,
  hasBeenAcquired: false,
} satisfies ProjectSubmissionFormData;

type ProjectSubmissionDraft = {
  formValues: ProjectSubmissionFormData;
  selectedRepository: RepositorySearchResult | null;
  selectedPlatforms: string[];
  currentStep: number;
  completedSteps: number[];
  suggestionMessage: string | null;
  savedAt: string;
};

function getNestedErrorMessage(errors: unknown, path: string) {
  let current = errors as Record<string, unknown> | undefined;

  for (const segment of path.split('.')) {
    current = current?.[segment] as Record<string, unknown> | undefined;
  }

  const message = current?.message;
  return typeof message === 'string' ? message : undefined;
}

function useProjectSubmission() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation(
    trpc.projects.createProject.mutationOptions({
      onSuccess: () => {
        setSuccess(true);
        setError(null);
        queryClient.invalidateQueries({ queryKey: trpc.projects.getMyProjects.queryKey() });

        vercelTrack('project_submission_success');
        databuddyTrack('project_submission_success');
      },
      onError: (err) => {
        const errorMessage = err.message || 'Something went wrong. Please try again.';
        setError(errorMessage);
        toast.error(errorMessage);
        vercelTrack('project_submission_error', { error: errorMessage });
        databuddyTrack('project_submission_error', { error: errorMessage });
      },
    }),
  );

  const clearError = () => setError(null);

  return {
    mutate,
    success,
    error,
    isLoading: isPending,
    clearError,
  };
}

export default function SubmissionForm() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<RepositorySearchResult | null>(null);
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null);
  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const { mutate, success, error, isLoading, clearError } = useProjectSubmission();
  const trpc = useTRPC();
  const { data: currentUser } = useQuery(trpc.user.me.queryOptions());
  const { data: providerStatus } = useQuery(trpc.system.providerStatus.queryOptions());
  const hasGitHub = currentUser?.connectedProviders.includes('github') ?? false;
  const isGitHubConfigured = providerStatus?.github.oauthConfigured ?? true;

  const form = useForm<ProjectSubmissionFormData>({
    resolver: zodResolver(projectForm),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: defaultProjectFormValues,
  });

  const { trigger } = form;
  const watchedValues = form.watch();

  function applyProjectSuggestions(suggestions: ProjectSuggestions, source: 'ai' | 'heuristic') {
    if (!form.getValues('name')) {
      form.setValue('name', suggestions.name, { shouldValidate: true, shouldDirty: true });
    }

    if (!form.getValues('description')) {
      form.setValue('description', suggestions.description, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }

    form.setValue('status', suggestions.status, { shouldValidate: true, shouldDirty: true });
    form.setValue('type', suggestions.type, { shouldValidate: true, shouldDirty: true });
    form.setValue('tags', suggestions.tags, { shouldValidate: true, shouldDirty: true });
    form.setValue('isLookingForContributors', suggestions.isLookingForContributors, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue('isHiring', suggestions.isHiring, { shouldValidate: true, shouldDirty: true });

    setSuggestionMessage(
      source === 'ai'
        ? `AI suggested ${suggestions.type} with ${suggestions.tags.join(', ') || 'no tags'}.`
        : `Repository metadata suggested ${suggestions.type} with ${suggestions.tags.join(', ') || 'no tags'}.`,
    );
  }

  const { mutate: suggestProjectFields, isPending: isSuggesting } = useMutation(
    trpc.github.suggestProjectFields.mutationOptions({
      onSuccess: (result) => {
        applyProjectSuggestions(result.suggestions, result.source);
      },
      onError: () => {
        setSuggestionMessage('Repository selected. Suggestions could not be generated.');
      },
    }),
  );

  function runProjectSuggestions(repoFullName = selectedRepository?.fullName ?? form.getValues('gitRepoUrl')) {
    const repo = repoFullName.trim();

    if (!repo) {
      toast.error('Select a GitHub repository first.');
      return;
    }

    setSuggestionMessage(null);
    suggestProjectFields({ repo });
  }

  function handleRepositorySelect(repository: RepositorySearchResult) {
    setSelectedRepository(repository);
    setSuggestionMessage(null);

    form.setValue('gitRepoUrl', repository.fullName, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue('gitHost', 'github', { shouldValidate: true, shouldDirty: true });
    form.setValue('name', repository.name, { shouldValidate: true, shouldDirty: true });

    if (repository.description) {
      form.setValue('description', repository.description, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }

    if (repository.owner.avatarUrl) {
      form.setValue('logoUrl', repository.owner.avatarUrl, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }

    if (repository.homepage?.startsWith('http')) {
      form.setValue('socialLinks.website', repository.homepage, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setSelectedPlatforms((previous) => new Set([...previous, 'website']));
    }

    void form.trigger(['gitRepoUrl', 'gitHost', 'name', 'description']);
    runProjectSuggestions(repository.fullName);
  }

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(draftStorageKey);
      if (!rawDraft) {
        return;
      }

      const draft = JSON.parse(rawDraft) as Partial<ProjectSubmissionDraft>;

      form.reset({
        ...defaultProjectFormValues,
        ...draft.formValues,
        socialLinks: {
          ...defaultProjectFormValues.socialLinks,
          ...draft.formValues?.socialLinks,
        },
      });
      setSelectedRepository(draft.selectedRepository ?? null);
      setSelectedPlatforms(new Set(draft.selectedPlatforms ?? []));
      setCurrentStep(Math.max(0, Math.min(draft.currentStep ?? 0, steps.length - 1)));
      setCompletedSteps(draft.completedSteps ?? []);
      setSuggestionMessage(draft.suggestionMessage ?? null);
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    } finally {
      setIsDraftHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  useEffect(() => {
    if (!isDraftHydrated || success) return;

    const hasMeaningfulDraft =
      currentStep > 0 ||
      completedSteps.length > 0 ||
      Boolean(selectedRepository) ||
      Boolean(watchedValues.gitRepoUrl || watchedValues.name || watchedValues.description);

    if (!hasMeaningfulDraft) {
      window.localStorage.removeItem(draftStorageKey);
      return;
    }

    const draft: ProjectSubmissionDraft = {
      formValues: {
        ...defaultProjectFormValues,
        ...watchedValues,
        socialLinks: {
          ...defaultProjectFormValues.socialLinks,
          ...watchedValues.socialLinks,
        },
      },
      selectedRepository,
      selectedPlatforms: Array.from(selectedPlatforms),
      currentStep,
      completedSteps,
      suggestionMessage,
      savedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  }, [
    completedSteps,
    currentStep,
    isDraftHydrated,
    selectedPlatforms,
    selectedRepository,
    success,
    suggestionMessage,
    watchedValues,
  ]);

  useEffect(() => {
    if (success) {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [success]);

  useEffect(() => {
    const subscription = form.watch(() => {
      if (error) {
        clearError();
      }
    });
    return () => subscription.unsubscribe();
  }, [form, error, clearError]);

  const steps = [
    {
      id: 'repository-information',
      title: 'Repository Information',
      description: 'Where is your code hosted?',
      fields: ['gitRepoUrl', 'gitHost'] as (keyof ProjectSubmissionFormData)[],
    },
    {
      id: 'basic-information',
      title: 'Basic Information',
      description: 'Tell us about your project',
      fields: ['name', 'description', 'logoUrl'] as (keyof ProjectSubmissionFormData)[],
    },
    {
      id: 'project-details',
      title: 'Project Details',
      description: 'What are you interested in?',
      fields: ['status', 'type', 'tags'] as (keyof ProjectSubmissionFormData)[],
    },
    {
      id: 'extra-information',
      title: 'Extra Information',
      description: 'Tell us more about yourself',
      fields: ['isLookingForContributors', 'isHiring'] as (keyof ProjectSubmissionFormData)[],
    },
  ];

  const socialPlatforms = [
    { value: 'website' as const, label: 'Website', placeholder: 'https://example.com' },
    { value: 'twitter' as const, label: 'Twitter', placeholder: 'https://twitter.com/username' },
    {
      value: 'linkedin' as const,
      label: 'LinkedIn',
      placeholder: 'https://linkedin.com/in/username',
    },
    {
      value: 'discord' as const,
      label: 'Discord',
      placeholder: 'https://discord.gg/username',
    },
  ];

  function handleProjectSubmission(formData: ProjectSubmissionFormData) {
    mutate(formData);
  }

  const needsGitHubConnection = error?.toLowerCase().includes('connect your github account');

  async function connectGitHub() {
    if (!isGitHubConfigured) {
      toast.error('GitHub OAuth is not configured for this environment.');
      return;
    }

    setIsConnectingGitHub(true);
    const callbackURL = typeof window === 'undefined' ? '/dashboard/projects/new' : window.location.href;
    const { error: linkError } = await authClient.linkSocial({
      provider: 'github',
      callbackURL,
      errorCallbackURL: callbackURL,
    });

    if (linkError) {
      toast.error(linkError.message || 'Could not connect GitHub');
      setIsConnectingGitHub(false);
      return;
    }

    setIsConnectingGitHub(false);
  }

  const nextStep = async () => {
    const currentStepFields = steps[currentStep]?.fields;
    if (!currentStepFields) return;

    let fieldsToValidate: string[] = [...currentStepFields];

    if (currentStep === 3) {
      const socialLinkFields = Array.from(selectedPlatforms).map(
        (platform) => `socialLinks.${platform}`,
      );
      fieldsToValidate = [...fieldsToValidate, ...socialLinkFields];
    }

    const isStepValid = await trigger(fieldsToValidate as any);

    if (currentStep === 0) {
      const gitRepoUrl = form.getValues('gitRepoUrl');
      if (!gitRepoUrl || gitRepoUrl.trim() === '') {
        toast.error('Please select a GitHub repository before continuing.');
        return;
      }
    }

    if (isStepValid) {
      const errors = form.formState.errors;
      const hasErrors = fieldsToValidate.some((field) => {
        const fieldParts = field.split('.');
        let error: any = errors;
        for (const part of fieldParts) {
          error = error?.[part];
        }
        return !!error;
      });

      if (!hasErrors) {
        if (!completedSteps.includes(currentStep)) {
          setCompletedSteps([...completedSteps, currentStep]);
        }
        setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
      } else {
        toast.error('Please fill in all required fields correctly.');
      }
    } else {
      toast.error('Please fill in all required fields.');
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  function discardDraft() {
    window.localStorage.removeItem(draftStorageKey);
    form.reset(defaultProjectFormValues);
    setSelectedRepository(null);
    setSelectedPlatforms(new Set());
    setCurrentStep(0);
    setCompletedSteps([]);
    setSuggestionMessage(null);
    clearError();
    toast.success('Draft discarded');
  }

  const progress = ((currentStep + 1) / steps.length) * 100;
  const currentStepFields = steps[currentStep]?.fields ?? [];
  const visibleValidationFields =
    currentStep === 3
      ? [
          ...currentStepFields,
          ...Array.from(selectedPlatforms).map((platform) => `socialLinks.${platform}`),
        ]
      : currentStepFields;
  const currentStepErrors = visibleValidationFields
    .map((field) => getNestedErrorMessage(form.formState.errors, field))
    .filter((message): message is string => Boolean(message));
  const hasDraftState =
    currentStep > 0 ||
    completedSteps.length > 0 ||
    Boolean(selectedRepository) ||
    Boolean(watchedValues.gitRepoUrl || watchedValues.name || watchedValues.description);

  return success ? (
    <div className="flex flex-col items-center justify-center space-y-4 py-8">
      <CheckCircle className="h-16 w-16 text-green-500" />
      <h3 className="text-xl font-semibold">Project submitted for review</h3>
      <p className="text-muted-foreground text-center">
        Your project is pending admin approval. It will appear publicly after approval.
      </p>
      <Button className="rounded-none" asChild>
        <Link href="/dashboard/projects">Back to my projects</Link>
      </Button>
    </div>
  ) : (
    <>
      <Progress value={progress} className="w-full" />
      {hasDraftState && (
        <div className="border-border flex flex-col gap-3 border bg-transparent p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            Draft saved locally. You can refresh and continue this submission.
          </p>
          <Button type="button" variant="outline" className="rounded-none" onClick={discardDraft}>
            Discard draft
          </Button>
        </div>
      )}
      {!hasGitHub && (
        <div className="border-border flex flex-col gap-3 border bg-transparent p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Github className="h-5 w-5 shrink-0" />
            <p className="text-muted-foreground text-sm leading-6">
              {isGitHubConfigured
                ? 'Connect GitHub before submitting duplicate or previously imported repositories so we can verify ownership.'
                : 'GitHub OAuth is not configured in this environment, so ownership verification is unavailable.'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 rounded-none"
            disabled={isConnectingGitHub || !isGitHubConfigured}
            onClick={connectGitHub}
          >
            {isConnectingGitHub ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Github className="h-4 w-4" />
            )}
            Connect GitHub
          </Button>
        </div>
      )}
      {error && (
        <div className="bg-destructive/10 text-destructive flex flex-col gap-3 rounded-md p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
          {needsGitHubConnection && (
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={isConnectingGitHub || !isGitHubConfigured}
              onClick={connectGitHub}
            >
              {isConnectingGitHub ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Github className="h-4 w-4" />
              )}
              Connect GitHub
            </Button>
          )}
        </div>
      )}
      {currentStepErrors.length > 0 && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive space-y-2 border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            Fix these fields before continuing
          </div>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {currentStepErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <Form {...form}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (currentStep !== steps.length - 1) {
              await nextStep();
              return;
            }
            const isValid = await form.trigger();
            if (isValid) {
              form.handleSubmit(handleProjectSubmission)(e);
            } else {
              toast.error('Please fix all validation errors before submitting.');
            }
          }}
          className="space-y-6 text-left"
        >
          {currentStep === 0 && (
            <div className="space-y-4">
              <input type="hidden" {...form.register('gitHost')} />
              <FormField
                control={form.control}
                name="gitRepoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GitHub Repository</FormLabel>
                    <FormControl>
                      <RepositorySearch
                        selectedRepository={selectedRepository}
                        onRepositorySelect={(repository) => {
                          field.onChange(repository.fullName);
                          handleRepositorySelect(repository);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      {field.value
                        ? `Selected ${field.value}`
                        : 'Search by repository name, owner, or keyword.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(isSuggesting || suggestionMessage || selectedRepository) && (
                <div className="border-border flex flex-col gap-3 border bg-[#161616] p-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                  {isSuggesting ? (
                    <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-[#C69DF8]" />
                  ) : (
                    <Sparkles className="mt-0.5 h-4 w-4 text-[#C69DF8]" />
                  )}
                    <div className="space-y-1">
                      <p className="text-muted-foreground">
                        {isSuggesting
                          ? 'Analyzing repository metadata...'
                          : suggestionMessage ??
                            'Autofill can suggest category, tags, and opportunity fields from the repository.'}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Re-running autofill updates classification fields and only fills empty title
                        or description fields.
                      </p>
                    </div>
                  </div>
                  {selectedRepository && !isSuggesting && (
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 rounded-none"
                      onClick={() => runProjectSuggestions()}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Re-run
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input
                        className="border-border z-10 rounded-none border !bg-[#1D1D1D]/100 text-base placeholder:text-[#9f9f9f]"
                        placeholder="My Awesome Project"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The name of your project.{' '}
                      {form.getValues('gitRepoUrl') &&
                        'This was auto-filled from your repository, but you can change it if needed.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Description</FormLabel>
                    <FormControl>
                      <Textarea
                        className="border-border z-10 rounded-none border !bg-[#1D1D1D]/100 text-base placeholder:text-[#9f9f9f]"
                        placeholder="Describe your project..."
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Provide a clear, concise description of what your project does and its main
                      features.{' '}
                      {form.getValues('gitRepoUrl') &&
                        'This was auto-filled from your repository, but you can enhance it if needed.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo</FormLabel>
                    <FormControl>
                      <LogoUploadField
                        value={field.value}
                        onChange={(url) => field.onChange(url)}
                      />
                    </FormControl>
                    <FormDescription>
                      Use a custom project logo, or keep the GitHub owner avatar.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="border-border z-10 w-full rounded-none border !bg-[#1D1D1D]/100 text-base">
                          <SelectValue placeholder="Select project status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-none">
                        <SelectItem className="rounded-none" value="active">
                          Active - Currently being developed
                        </SelectItem>
                        <SelectItem className="rounded-none" value="inactive">
                          Inactive - Not currently maintained
                        </SelectItem>
                        <SelectItem className="rounded-none" value="early-stage">
                          Early Stage - Just getting started
                        </SelectItem>
                        <SelectItem className="rounded-none" value="beta">
                          Beta - Testing with limited users
                        </SelectItem>
                        <SelectItem className="rounded-none" value="production-ready">
                          Production Ready - Stable for use
                        </SelectItem>
                        <SelectItem className="rounded-none" value="experimental">
                          Experimental - Proof of concept
                        </SelectItem>
                        <SelectItem className="rounded-none" value="cancelled">
                          Cancelled - No longer pursuing
                        </SelectItem>
                        <SelectItem className="rounded-none" value="paused">
                          Paused - Temporarily on hold
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Indicate the current development stage of your project. This helps set
                      appropriate expectations.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="border-border z-10 w-full rounded-none border !bg-[#1D1D1D]/100 text-base">
                          <SelectValue placeholder="Select project type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-none">
                        <SelectItem className="rounded-none" value="fintech">
                          Fintech
                        </SelectItem>
                        <SelectItem className="rounded-none" value="healthtech">
                          Healthtech
                        </SelectItem>
                        <SelectItem className="rounded-none" value="edtech">
                          Edtech
                        </SelectItem>
                        <SelectItem className="rounded-none" value="ecommerce">
                          E-commerce
                        </SelectItem>
                        <SelectItem className="rounded-none" value="productivity">
                          Productivity
                        </SelectItem>
                        <SelectItem className="rounded-none" value="social">
                          Social
                        </SelectItem>
                        <SelectItem className="rounded-none" value="entertainment">
                          Entertainment
                        </SelectItem>
                        <SelectItem className="rounded-none" value="developer-tools">
                          Developer Tools
                        </SelectItem>
                        <SelectItem className="rounded-none" value="content-management">
                          Content Management
                        </SelectItem>
                        <SelectItem className="rounded-none" value="analytics">
                          Analytics
                        </SelectItem>
                        <SelectItem className="rounded-none" value="other">
                          Other
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the category that best describes your project&apos;s primary focus
                      area.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Tags</FormLabel>
                    <FormControl>
                      <MultiSelect
                        className="border-border z-10 rounded-none border !bg-[#1D1D1D]/100 text-base placeholder:text-[#9f9f9f]"
                        placeholder="Select tags..."
                        options={projectTags.map((tag) => ({
                          label: tag,
                          value: tag,
                        }))}
                        selected={field.value ?? []}
                        onChange={(value) => {
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>Add tags to help categorize your project.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {currentStep === 3 && (
            <>
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Social Links</h3>
                <p className="text-muted-foreground text-sm">
                  Add links to help people connect with your project and team.
                </p>

                <MultiSelect
                  className="border-border z-10 rounded-none border !bg-[#1D1D1D]/100 text-base placeholder:text-[#9f9f9f]"
                  onChange={(value) => {
                    setSelectedPlatforms(new Set(value));
                  }}
                  options={socialPlatforms}
                  selected={Array.from(selectedPlatforms)}
                />

                <div className="space-y-4">
                  {socialPlatforms.map(
                    (platform) =>
                      selectedPlatforms.has(platform.value) && (
                        <FormField
                          key={platform.value}
                          control={form.control}
                          name={`socialLinks.${platform.value}`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{platform.label} URL</FormLabel>
                              <FormControl>
                                <Input
                                  className="border-border z-10 rounded-none border !bg-[#1D1D1D]/100 text-base placeholder:text-[#9f9f9f]"
                                  placeholder={platform.placeholder}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {platform.value === 'website' &&
                                  "Your project's official website or documentation"}
                                {platform.value === 'twitter' &&
                                  'Twitter/X profile for project updates and announcements'}
                                {platform.value === 'linkedin' &&
                                  'LinkedIn profile for professional networking'}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ),
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Project Options</h3>
                <p className="text-muted-foreground text-sm">
                  Let the community know how they can get involved with your project.
                </p>

                <FormField
                  control={form.control}
                  name="isLookingForContributors"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-y-0 space-x-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Looking for Contributors</FormLabel>
                        <FormDescription>
                          Enable this if you&apos;re actively seeking developers to contribute code,
                          documentation, or other improvements to your project.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isHiring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-y-0 space-x-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Currently Hiring</FormLabel>
                        <FormDescription>
                          Enable this if your project or organization has open positions and
                          you&apos;re looking to hire team members.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <div className="flex justify-between gap-4 pt-6 pb-20">
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                onClick={prevStep}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>

              {currentStep === steps.length - 1 ? (
                <Button type="submit" className="rounded-none" disabled={isLoading || success}>
                  {isLoading ? 'Submitting...' : 'Submit Project'}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    nextStep();
                  }}
                  className="rounded-none"
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
