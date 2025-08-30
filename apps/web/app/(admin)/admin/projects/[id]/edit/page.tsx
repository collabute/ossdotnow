'use client';

import { RepositoryChangeDialog } from '@/components/admin/repository-change-dialog';
import { ProjectClassification } from '@/components/admin/project-classification';
import { ProjectSocialLinks } from '@/components/admin/project-social-links';
import { ProjectBasicInfo } from '@/components/admin/project-basic-info';
import { ProjectEditForm } from '@/components/admin/project-edit-form';
import { ProjectSettings } from '@/components/admin/project-settings';
import { Separator } from '@workspace/ui/components/separator';
import { Button } from '@workspace/ui/components/button';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Form } from '@workspace/ui/components/form';
import Link from '@workspace/ui/components/link';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { isProject } from '@/types/project';
import { useTRPC } from '@/hooks/use-trpc';
import React from 'react';

export default function AdminProjectEditPage() {
  const params = useParams();
  const trpc = useTRPC();
  const projectId = params.id as string;

  const { data: projectData, isLoading: projectLoading } = useQuery(
    trpc.projects.getProject.queryOptions({ id: projectId }),
  );

  const { data: projectTypes, isLoading: projectTypesLoading } = useQuery(
    trpc.categories.getProjectTypes.queryOptions({ activeOnly: false }),
  );

  const { data: projectStatuses, isLoading: projectStatusesLoading } = useQuery(
    trpc.categories.getProjectStatuses.queryOptions({ activeOnly: false }),
  );

  const { data: tags, isLoading: tagsLoading } = useQuery(
    trpc.categories.getTags.queryOptions({ activeOnly: false }),
  );

  // Use the custom hook for form logic
  const {
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
  } = ProjectEditForm({
    projectData: isProject(projectData) ? projectData : null,
    projectId,
  });

  // Set form values when project data loads
  React.useEffect(() => {
    if (
      projectData &&
      isProject(projectData) &&
      !projectStatusesLoading &&
      !projectTypesLoading &&
      !tagsLoading
    ) {
      const currentTags =
        projectData.tagRelations?.map((relation) => relation.tag?.name).filter(Boolean) ?? [];

      const formData = {
        name: projectData.name,
        description: projectData.description || '',
        gitRepoUrl: projectData.gitRepoUrl,
        gitHost: projectData.gitHost || 'github',
        logoUrl: projectData.logoUrl || '',
        approvalStatus: projectData.approvalStatus,
        status: projectData.status?.name || '',
        type: projectData.type?.name || '',
        tags: currentTags,
        socialLinks: {
          twitter: projectData.socialLinks?.twitter || '',
          discord: projectData.socialLinks?.discord || '',
          linkedin: projectData.socialLinks?.linkedin || '',
          website: projectData.socialLinks?.website || '',
        },
        isLookingForContributors: projectData.isLookingForContributors,
        isLookingForInvestors: projectData.isLookingForInvestors,
        isHiring: projectData.isHiring,
        isPublic: projectData.isPublic,
        hasBeenAcquired: projectData.hasBeenAcquired,
        isPinned: projectData.isPinned,
        isRepoPrivate: projectData.isRepoPrivate,
      };

      form.reset(formData);
    }
  }, [projectData, projectStatusesLoading, projectTypesLoading, tagsLoading, form]);

  if (projectLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!projectData || !isProject(projectData)) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Project not found</h2>
          <p className="text-muted-foreground">
            The project you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button
            className="mt-4"
            render={(props) => (
              <Link href="/admin/projects" {...props}>
                Back to Projects
              </Link>
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="px-6">
      <div className="mx-auto max-w-[1080px] py-4">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            render={(props) => (
              <Link href="/admin/projects" {...props}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Projects
              </Link>
            )}
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Edit Project</h1>
            <p className="text-neutral-400">Update project details and settings</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-4 overflow-hidden lg:col-span-2">
                <div className="border border-neutral-800 bg-neutral-900/50 p-6">
                  <h2 className="mb-4 text-lg font-semibold text-white">Project Information</h2>
                  <p className="mb-6 text-sm text-neutral-400">
                    Core project details, classification, and social links
                  </p>

                  <div className="space-y-6">
                    <ProjectBasicInfo
                      form={form}
                      repoValidation={repoValidation}
                      projectData={projectData}
                      parseRepositoryUrl={parseRepositoryUrl}
                      handleRepoChange={handleRepoChange}
                    />

                    <Separator className="bg-neutral-700" />

                    <ProjectClassification
                      form={form}
                      projectStatuses={projectStatuses}
                      projectTypes={projectTypes}
                      tags={tags}
                      projectStatusesLoading={projectStatusesLoading}
                      projectTypesLoading={projectTypesLoading}
                    />

                    <Separator className="bg-neutral-700" />

                    <ProjectSocialLinks form={form} />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:col-span-1">
                <div className="border border-neutral-800 bg-neutral-900/50 p-4 md:p-6">
                  <h2 className="mb-4 text-lg font-semibold text-white">Project Settings</h2>
                  <ProjectSettings form={form} />
                </div>

                <div className="flex justify-end gap-4">
                  <Button
                    variant="outline"
                    className="rounded-none"
                    render={(props) => (
                      <Link href="/admin/projects" {...props}>
                        Cancel
                      </Link>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={updateProjectMutation.isPending}
                    className="rounded-none"
                  >
                    {updateProjectMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </Form>

        <RepositoryChangeDialog
          open={showRepoChangeDialog}
          onOpenChange={(open) => {
            if (!open) cancelRepoChange();
          }}
          projectData={projectData}
          pendingRepoChange={pendingRepoChange}
          onConfirm={confirmRepoChange}
          onCancel={cancelRepoChange}
        />
      </div>
    </div>
  );
}
