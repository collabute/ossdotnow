import { projectProviderEnum, project as projectSchema } from '@workspace/db/schema';
import Icons from '@workspace/ui/components/icons';
import Link from '@workspace/ui/components/link';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/hooks/use-trpc';
import { formatDate } from '@/lib/utils';
import Image from 'next/image';
import {isValidProvider} from '@/lib/constants'

type Project = typeof projectSchema.$inferSelect;

export default function ProjectCard({
  project,
  isOwnProfile = false,
}: {
  project: Project;
  isOwnProfile?: boolean;
}) {
  const trpc = useTRPC();
  const { data: repo, isError, isLoading } = useQuery({
    ...trpc.repository.getRepo.queryOptions({
      url: project.gitRepoUrl,
      provider: project.gitHost as (typeof projectProviderEnum.enumValues)[number],
    }),
    enabled: !!project.gitRepoUrl && isValidProvider(project.gitHost),
    staleTime: 1000 * 60 * 60 * 24,
  });

  return (
    <div className="group/project relative flex h-full flex-col bg-[#171717] p-1">
      <Link
        href={`/projects/${project.id}`}
        event="project_card_link_clicked"
        eventObject={{ projectId: project.id }}
        className="absolute inset-0"
      />
      <span className="sr-only">View {project.name}</span>
      <div className="flex flex-1 grow flex-col gap-2 border border-[#404040] bg-[#262626] p-4">
        <div className="mb-3 flex items-center gap-3">
          {isLoading || isError || !repo ? (
            <div className="h-[78px] w-[78px] animate-pulse bg-neutral-900" />
          ) : (repo?.owner?.avatar_url || repo?.namespace?.avatar_url) ? (
            project.ownerId ? (
              <Link
                href={`/profile/${project.ownerId}`}
                onClick={(e) => e.stopPropagation()}
                className="z-10 shrink-0 rounded-none"
              >
                <Image
                  src={
                    repo?.owner?.avatar_url || `https://gitlab.com${repo?.namespace?.avatar_url}`
                  }
                  alt={project.name ?? 'Project Logo'}
                  width={256}
                  height={256}
                  className="h-[78px] w-[78px] rounded-none transition-opacity hover:opacity-80"
                  loading="lazy"
                />
              </Link>
            ) : (
              <Image
                src={repo?.owner?.avatar_url || `https://gitlab.com${repo?.namespace?.avatar_url}`}
                alt={project.name ?? 'Project Logo'}
                width={256}
                height={256}
                className="h-[78px] w-[78px] rounded-none"
                loading="lazy"
              />
            )
          ) : (
            <div className="h-[78px] w-[78px] animate-pulse bg-neutral-900" />
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-semibold text-white md:text-base">
                {project.name}
              </h3>
              {(project.isLookingForContributors ||
                project.hasBeenAcquired ||
                (project.approvalStatus === 'pending' && isOwnProfile)) && (
                <div className="flex flex-wrap gap-1 md:gap-1.5">
                  {project.isLookingForContributors && (
                    <span className="rounded-none border border-[#00BC7D]/10 bg-[#00BC7D]/10 px-1.5 py-0.5 text-xs font-medium text-[#00D492] md:px-2">
                      Open to contributors
                    </span>
                  )}
                  {project.approvalStatus === 'pending' && isOwnProfile && (
                    <span className="rounded-none border border-[#FFDE21]/10 bg-[#FFDE21]/10 px-1.5 py-0.5 text-xs font-medium text-[#FFDE21] md:px-2">
                      Pending
                    </span>
                  )}
                  {project.hasBeenAcquired && (
                    <span className="rounded-none bg-yellow-500/10 px-1.5 py-0.5 text-xs font-medium text-yellow-400 md:px-2">
                      Acquired
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="line-clamp-2 text-xs leading-relaxed text-neutral-400 md:text-sm">
              {project.description}
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 p-2 pb-1 text-xs md:gap-4 md:text-sm">
          <div className="flex items-center gap-1">
            <Icons.star className="h-3 w-3 text-yellow-600 md:h-3.5 md:w-3.5" />
            <span className="text-neutral-300">
              {isLoading ? (
                <span className="inline-block h-3 w-10 animate-pulse rounded bg-neutral-700"></span>
              ) : isError || !repo ? (
                project.starsCount ?? 0
              ) : (
                repo?.stargazers_count ?? repo?.star_count ?? project.starsCount ?? 0
              )}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Icons.fork className="h-3 w-3 text-purple-600 md:h-3.5 md:w-3.5" />
            <span className="text-neutral-300">
              {isLoading ? (
                <span className="inline-block h-3 w-8 animate-pulse rounded bg-neutral-700"></span>
              ) : isError || !repo ? (
                project.forksCount ?? 0
              ) : (
                repo?.forks_count ?? project.forksCount ?? 0
              )}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Icons.clock className="h-3 w-3 text-neutral-500 md:h-3.5 md:w-3.5" />
            <span className="text-neutral-300">
              {isLoading ? (
                <span className="inline-block h-3 w-16 animate-pulse rounded bg-neutral-700"></span>
              ) : isError || !repo ? (
                formatDate(new Date(project.createdAt))
              ) : (
                repo?.created_at ? formatDate(new Date(repo.created_at)) : formatDate(new Date(project.createdAt))
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
