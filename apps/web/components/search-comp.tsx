'use client';
import { GitPullRequest, Star, RefreshCw, AlertCircle } from 'lucide-react';
import { project as projectSchema } from '@workspace/db/schema';
import { useState, useEffect, useCallback } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import Link from '@workspace/ui/components/link';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/hooks/use-trpc';
import Image from 'next/image';

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

type Project = typeof projectSchema.$inferSelect;

function ProjectSkeleton() {
  return (
    <div className="flex min-h-14 items-center gap-3 border border-white/10 p-2">
      <div className="h-8 w-8 animate-pulse rounded bg-neutral-800/60" />
      <div className="flex w-full flex-row justify-between">
        <div className="flex-1">
          <div className="mb-1 h-4 w-32 animate-pulse rounded bg-neutral-800/60" />
          <div className="flex items-center gap-2">
            <div className="h-3 w-12 animate-pulse rounded bg-neutral-800/60" />
            <div className="h-3 w-12 animate-pulse rounded bg-neutral-800/60" />
          </div>
        </div>
        <div className="h-5 w-20 animate-pulse rounded bg-neutral-800/60" />
      </div>
    </div>
  );
}

function ErrorDisplay({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <AlertCircle className="mb-3 h-8 w-8 text-red-400" />
      <h4 className="mb-2 text-sm font-medium text-red-400">Error Loading Projects</h4>
      <p className="mb-4 max-w-xs text-xs text-gray-400">Something went wrong. Please try again.</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded bg-red-900/20 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-900/30 focus:ring-2 focus:ring-red-400/50 focus:outline-none"
      >
        <RefreshCw className="h-3 w-3" />
        Try Again
      </button>
    </div>
  );
}

function EmptyState({ isSearchActive, query }: { isSearchActive: boolean; query: string }) {
  if (isSearchActive) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 text-2xl">🔍</div>
        <h4 className="mb-2 text-sm font-medium text-white/70">No projects found</h4>
        <p className="max-w-xs text-xs text-gray-400">
          {query.length < 3
            ? ''
            : `No projects match "${query}". Try different keywords or check your spelling.`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-3 text-2xl">📌</div>
      <h4 className="mb-2 text-sm font-medium text-white/70">No featured projects</h4>
      <p className="max-w-xs text-xs text-gray-400">
        There are currently no pinned projects to display. Try searching for specific projects
        instead.
      </p>
    </div>
  );
}

const formatNumber = (num: number | null | undefined): string => {
  const safeNum = num || 0;
  if (safeNum >= 1000) {
    return `${(safeNum / 1000).toFixed(1)}k`;
  }
  return safeNum.toString();
};

const getProjectStatus = (project: Project) => {
  if (project.isLookingForContributors) {
    return { text: 'Open for contributors' as const, color: 'green' as const };
  }
  if (project.isLookingForInvestors) {
    return { text: 'Finding investors' as const, color: 'purple' as const };
  }
  return null;
};
function ProjectItem({
  project,
  onClose,
  index,
}: {
  project: Project;
  onClose: () => void;
  index: number;
}) {
  const trpc = useTRPC();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const { data: repo, isLoading: isRepoLoading } = useQuery({
    ...trpc.repository.getRepo.queryOptions({
      url: project.gitRepoUrl,
      provider: project.gitHost as 'github' | 'gitlab',
    }),
    enabled: !!project.gitRepoUrl && !!project.gitHost,
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const status = getProjectStatus(project);
  const stars = repo?.stargazers_count || repo?.star_count || 0;
  const forks = repo?.forks_count || 0;

  const getImageUrl = () => {
    if (repo?.owner?.avatar_url) {
      return repo.owner.avatar_url;
    }
    if (repo?.namespace?.avatar_url) {
      const avatarUrl = repo.namespace.avatar_url;
      return avatarUrl.startsWith('http') ? avatarUrl : `https://gitlab.com${avatarUrl}`;
    }
    return '';
  };

  const imageUrl = getImageUrl();

  return (
    <Link
      href={`/projects/${project.id}`}
      event="search_project_clicked"
      eventObject={{ projectId: project.id }}
      className="flex min-h-14 items-center gap-3 border border-white/10 p-2 transition-colors hover:bg-white/5"
      onClick={onClose}
      role="option"
      aria-label={project.name}
      tabIndex={0}
      id={`project-${index}`}
    >
      <div className="relative h-8 w-8">
        {imageUrl && !imageError ? (
          <>
            <Image
              src={imageUrl}
              alt={`${project.name} avatar`}
              width={32}
              height={32}
              className={`h-8 w-8 rounded object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 flex h-8 w-8 animate-pulse items-center justify-center rounded bg-neutral-800/60" />
            )}
          </>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded bg-neutral-900">
            <span className="text-xs text-gray-500">{project.name.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>
      <div className="flex w-full flex-row justify-between">
        <div className="flex-1 text-sm font-medium text-white/80">
          <div className="mb-1">{project.name}</div>

          <div className="flex flex-row items-center text-[11px] text-gray-400">
            <Star size={10} className="mr-1 text-yellow-500" />
            {formatNumber(stars)}
            <GitPullRequest size={10} className="mr-1 ml-2 text-purple-500" />
            {formatNumber(forks)}
          </div>
        </div>
        {status && (
          <div
            className={`flex h-[22px] items-center justify-center self-center px-3 text-[10px] ${
              status.color === 'green'
                ? 'bg-green-900/20 text-green-400'
                : 'bg-purple-900/20 text-purple-400'
            }`}
          >
            {status.text}
          </div>
        )}
      </div>
    </Link>
  );
}
function Search() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useQueryState('search', parseAsString.withDefault(''));
  const trpc = useTRPC();
  const debouncedQuery = useDebounce(searchQuery, 300);

  const {
    data: pinnedProjectsData,
    isLoading: isPinnedLoading,
    isError: isPinnedError,
    error: pinnedError,
    refetch: refetchPinned,
  } = useQuery({
    ...trpc.projects.getProjects.queryOptions({
      approvalStatus: 'approved',
      page: 1,
      pageSize: 6,
      sortBy: 'recent',
    }),
    enabled: open && !debouncedQuery.trim(),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const {
    data: searchResultsData,
    isLoading: isSearchLoading,
    isError: isSearchError,
    error: searchError,
    refetch: refetchSearch,
  } = useQuery({
    ...trpc.projects.getProjects.queryOptions({
      approvalStatus: 'approved',
      searchQuery: debouncedQuery,
      page: 1,
      pageSize: 12,
      sortBy: 'recent',
    }),
    enabled: open && !!debouncedQuery.trim(),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const pinnedProjects = pinnedProjectsData?.data?.filter((project) => project.isPinned) || [];
  const searchResults = searchResultsData?.data || [];
  const isSearchActive = !!debouncedQuery.trim();
  const isLoading = isSearchActive ? isSearchLoading : isPinnedLoading;
  const isError = isSearchActive ? isSearchError : isPinnedError;
  const error = isSearchActive ? searchError : pinnedError;
  const MAX_DISPLAY_RESULTS = 10;
  const rawProjects = isSearchActive ? searchResults : pinnedProjects;
  const projects = rawProjects.slice(0, MAX_DISPLAY_RESULTS);

  const hasMoreResults = rawProjects.length > MAX_DISPLAY_RESULTS;
  const totalAvailable = isSearchActive
    ? searchResultsData?.pagination?.totalCount
    : pinnedProjectsData?.pagination?.totalCount;

  const handleRetry = useCallback(() => {
    if (isSearchActive) {
      refetchSearch();
    } else {
      refetchPinned();
    }
  }, [isSearchActive, refetchSearch, refetchPinned]);

  const handleCloseModal = useCallback(() => {
    setOpen(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (open && e.key === 'Escape') {
        setOpen(false);
      }
    },
    [open],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <button
        className="bg-foreground text-background hover:bg-opacity-90 focus:ring-foreground/50 rounded px-6 py-3 text-lg font-semibold shadow transition focus:ring-2 focus:outline-none"
        onClick={() => setOpen(true)}
        aria-label="Open search modal"
      >
        Search
        <span className="ml-3 hidden rounded bg-black/10 px-2 py-1 align-middle text-xs sm:inline-block dark:bg-white/10">
          ⌘K
        </span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={handleCloseModal}
        >
          <div
            className="relative w-full max-w-xl overflow-visible p-0 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border border-white/10 bg-[#18181b]/40 px-4 py-3 sm:px-6">
              <input
                type="text"
                className="flex-1 border-none py-2 text-sm text-white focus:outline-none sm:text-base"
                placeholder="Search for repositories"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                role="combobox"
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls="search-results"
                aria-label="Search for repositories"
              />
              <button
                className="mr-3 bg-[#4a1e00]/40 px-2 py-1 text-xs text-orange-500 sm:px-3"
                onClick={() => setOpen(false)}
                aria-label="Close search modal"
              >
                esc
              </button>
            </div>
            <div className="relative mt-3 rounded border border-white/10 bg-[#18181b]/40 px-4 py-4 sm:px-6 sm:py-6">
              <div className="mb-3 text-lg text-white/50">
                {isSearchActive ? 'Search Results' : 'Popular'}
              </div>
              <div
                className="scrollbar-none flex flex-col gap-2 overflow-y-auto px-3"
                style={{
                  maxHeight: `calc((3.5rem + 0.5rem) * 3.5)`,
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
                role="listbox"
                id="search-results"
                aria-label={isSearchActive ? 'Search results' : 'Popular projects'}
              >
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, index) => <ProjectSkeleton key={index} />)
                ) : isError ? (
                  <ErrorDisplay onRetry={handleRetry} />
                ) : projects.length === 0 ? (
                  <EmptyState isSearchActive={isSearchActive} query={searchQuery} />
                ) : (
                  <>
                    {projects.map((project, index) => (
                      <ProjectItem
                        key={project.id}
                        project={project}
                        onClose={handleCloseModal}
                        index={index}
                      />
                    ))}
                    {hasMoreResults && (
                      <div className="mt-2 flex items-center justify-center border-t border-white/10 p-3 text-xs text-gray-400">
                        <span>
                          Showing {projects.length} of {totalAvailable || rawProjects.length}{' '}
                          results
                          {isSearchActive && ' • Refine your search for more specific results'}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default Search;
