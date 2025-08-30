import SubmissionDialog from '../submissions/submission-dialog';
import Icons from '@workspace/ui/components/icons';
import { UnSubmittedRepo } from '@workspace/api';
import { formatDate } from '@/lib/utils';
import Image from 'next/image';

export default function UnsubmittedRepoCard({
  repo,
  onSubmit,
  isOwnProfile,
}: {
  repo: UnSubmittedRepo;
  onSubmit?: (repo: UnSubmittedRepo) => void;
  isOwnProfile: boolean;
}) {
  const handleClick = () => {
    if (onSubmit) {
      onSubmit(repo);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      if (event.key === ' ') {
        event.preventDefault();
      }
      handleClick();
    }
  };

  const handleSubmissionDialogClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const handleSubmissionDialogKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group/project relative flex h-full cursor-pointer flex-col bg-[#171717] p-1 transition-colors hover:bg-[#1a1a1a]"
    >
      <span className="sr-only">Submit {repo.name}</span>
      <div className="flex flex-1 grow flex-col gap-2 border border-[#404040] bg-[#262626] p-4">
        <div className="mb-3 flex items-center gap-3">
          {repo && repo?.owner && repo?.owner?.avatar_url ? (
            <Image
              src={repo?.owner?.avatar_url}
              alt={repo.name ?? 'Repository Logo'}
              width={256}
              height={256}
              className="md:h-[78px] md:w-[78px] h-[50px] w-[50px] rounded-none"
              loading="lazy"
            />
          ) : (
            <div className="h-[78px] w-[78px] animate-pulse bg-neutral-900" />
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-semibold text-white md:text-base">
                {repo.name}
              </h3>
              <span className="rounded-none border border-blue-400/30 bg-blue-400/10 px-1.5 py-0.5 text-xs font-medium text-blue-400 md:px-2">
                Not Submitted
              </span>
            </div>
            <p className="line-clamp-2 text-xs leading-relaxed text-neutral-400 md:text-sm">
              {repo?.description || 'No description available'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 p-2 pb-1 text-xs md:gap-4 md:text-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Icons.star className="h-3 w-3 text-yellow-600 md:h-3.5 md:w-3.5" />
              <span className="text-neutral-300">{repo.stars || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Icons.fork className="h-3 w-3 text-purple-600 md:h-3.5 md:w-3.5" />
              <span className="text-neutral-300">{repo.forks || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Icons.clock className="h-3 w-3 text-neutral-500 md:h-3.5 md:w-3.5" />
              <span className="text-neutral-300">
                {repo?.created_at ? formatDate(new Date(repo.created_at)) : 'N/A'}
              </span>
            </div>
          </div>
          {isOwnProfile && (
            <div onClick={handleSubmissionDialogClick} onKeyDown={handleSubmissionDialogKeyDown}>
              <SubmissionDialog
                quickSubmit={{
                  provider: repo.gitHost,
                  repoUrl: repo.repoUrl,
                  name: repo.name,
                  description: repo.description || '',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
