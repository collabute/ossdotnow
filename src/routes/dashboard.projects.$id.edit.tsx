'use client';

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod/v4';

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
import { Checkbox } from '@/components/ui/checkbox';
import { MultiSelect } from '@/components/ui/multi-select';
import { LogoUploadField } from '@/components/submissions/logo-upload-field';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { projectForm } from '@/forms';
import { useTRPC } from '@/hooks/use-trpc';
import { projectStatuses, projectTags, projectTypes } from '@/lib/project-options';
import { requireOwnerAccount } from '@/lib/route-guards';
import {
  RouteErrorState,
  RouteNotFoundState,
  RoutePendingState,
} from '@/components/layout/route-boundaries';

export const Route = createFileRoute('/dashboard/projects/$id/edit')({
  beforeLoad: async () => {
    await requireOwnerAccount();
  },
  component: EditProjectPage,
  notFoundComponent: () => (
    <RouteNotFoundState
      title="Project not found"
      description="This project is not in your active submissions."
    />
  ),
  pendingComponent: () => <RoutePendingState label="Loading project editor" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Project editor could not load"
      description="The project editor is unavailable right now. Try again from your dashboard."
    />
  ),
});

type ProjectFormData = z.infer<typeof projectForm>;

function EditProjectPage() {
  const { id } = Route.useParams();
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projectQuery = useQuery(trpc.projects.getProject.queryOptions({ id }));

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectForm),
    defaultValues: {
      name: '',
      description: '',
      logoUrl: '',
      gitRepoUrl: '',
      gitHost: 'github',
      status: 'early-stage',
      type: 'other',
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
      isPublic: true,
      hasBeenAcquired: false,
    },
  });

  useEffect(() => {
    const project = projectQuery.data;
    if (!project) return;

    form.reset({
      name: project.name,
      description: project.description ?? '',
      logoUrl: project.logoUrl ?? '',
      gitRepoUrl: project.gitRepoUrl,
      gitHost: project.gitHost ?? 'github',
      status: project.status,
      type: project.type,
      tags: project.tags ?? [],
      socialLinks: {
        twitter: project.socialLinks?.twitter ?? '',
        discord: project.socialLinks?.discord ?? '',
        linkedin: project.socialLinks?.linkedin ?? '',
        website: project.socialLinks?.website ?? '',
      },
      isLookingForContributors: project.isLookingForContributors,
      isLookingForInvestors: project.isLookingForInvestors,
      isHiring: project.isHiring,
      isPublic: project.isPublic,
      hasBeenAcquired: project.hasBeenAcquired,
    });
  }, [form, projectQuery.data]);

  const { mutate, isPending } = useMutation({
    ...trpc.projects.updateMyProject.mutationOptions(),
    onSuccess: async () => {
      toast.success('Project changes submitted for review');
      queryClient.invalidateQueries({ queryKey: trpc.projects.getMyProjects.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.projects.getProject.queryKey({ id }) });
      await navigate({ to: '/dashboard/projects' });
    },
    onError: (error) => {
      toast.error(error.message || 'Could not update project');
    },
  });

  if (projectQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading project...
      </div>
    );
  }

  if (!projectQuery.data) {
    return <div className="text-muted-foreground">Project not found.</div>;
  }

  const project = projectQuery.data;
  const editReviewCopy =
    project.approvalStatus === 'approved'
      ? 'Saving changes will move this project back to pending review and hide it from public discovery until an admin approves it again.'
      : project.approvalStatus === 'rejected'
        ? 'Saving changes will resubmit this project for admin review.'
        : 'Saving changes keeps this project in pending review.';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="border-b border-border pb-6">
        <h2 className="text-2xl font-medium">Edit project</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          You can edit only projects owned by your account.
        </p>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{editReviewCopy}</p>
      </div>

      <Form {...form}>
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit((data) => mutate({ id, ...data }))}
        >
          <input type="hidden" {...form.register('gitHost')} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <section className="space-y-5 border border-border/70 bg-card/40 p-5">
                <SectionHeader
                  title="Project details"
                  description="Core listing information shown across review and discovery."
                />

                <FormField
                  control={form.control}
                  name="gitRepoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GitHub repository</FormLabel>
                      <FormControl>
                        <Input
                          className="border-border rounded-none border !bg-[#1D1D1D]/100 text-base"
                          disabled
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Repository changes should go through a new project submission.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project name</FormLabel>
                      <FormControl>
                        <Input className="rounded-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-28 rounded-none"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              <section className="space-y-5 border border-border/70 bg-card/40 p-5">
                <SectionHeader
                  title="Classification"
                  description="Help people understand the project type and opportunity."
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-none">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {projectStatuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-none">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {projectTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <MultiSelect
                          className="rounded-none"
                          placeholder="Select tags..."
                          options={projectTags.map((tag) => ({ label: tag, value: tag }))}
                          selected={field.value ?? []}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              <section className="space-y-5 border border-border/70 bg-card/40 p-5">
                <SectionHeader
                  title="Public links and signals"
                  description="Control external links and opportunity flags for approved listings."
                />

                <FormField
                  control={form.control}
                  name="socialLinks.website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input className="rounded-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="isLookingForContributors"
                    render={({ field }) => (
                      <FormItem className="flex min-h-24 flex-row items-start gap-3 border border-border/70 p-4">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Looking for contributors</FormLabel>
                          <FormDescription>
                            Show contributor interest on the public page after approval.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isHiring"
                    render={({ field }) => (
                      <FormItem className="flex min-h-24 flex-row items-start gap-3 border border-border/70 p-4">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Currently hiring</FormLabel>
                          <FormDescription>
                            Show hiring intent on the approved project page.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </section>
            </div>

            <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
              <section className="space-y-5 border border-border/70 bg-card/40 p-5">
                <SectionHeader
                  title="Logo"
                  description="Upload a project logo or clear it to use the GitHub avatar fallback."
                />

                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <LogoUploadField
                          value={field.value}
                          onChange={(url) => field.onChange(url)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              <section className="space-y-4 border border-border/70 bg-card/40 p-5">
                <SectionHeader
                  title="Review"
                  description="Saving sends these changes back through the project review flow."
                />

                <Button type="submit" className="w-full rounded-none" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save and submit for review
                </Button>
              </section>
            </aside>
          </div>
        </form>
      </Form>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-muted-foreground mt-1 text-sm leading-6">{description}</p>
    </div>
  );
}
