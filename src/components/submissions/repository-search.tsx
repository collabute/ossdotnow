'use client';

import { AlertCircle, CheckCircle, Loader2, RefreshCcw, Search, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type HTMLAttributes } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTRPC } from '@/hooks/use-trpc';
import type { RouterOutputs } from '@/lib/api-types';
import { cn } from '@/lib/utils';

export type RepositorySearchResult =
  RouterOutputs['github']['searchRepos']['repositories'][number];

interface RepositorySearchProps extends HTMLAttributes<HTMLDivElement> {
  selectedRepository: RepositorySearchResult | null;
  onRepositorySelect: (repository: RepositorySearchResult) => void;
  disabled?: boolean;
}

function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return value.toLocaleString();
}

export function RepositorySearch({
  selectedRepository,
  onRepositorySelect,
  disabled,
  className,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: RepositorySearchProps) {
  const trpc = useTRPC();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const canSearch = debouncedQuery.length >= 2;
  const { data, error, isFetching, refetch } = useQuery({
    ...trpc.github.searchRepos.queryOptions({ query: debouncedQuery }),
    enabled: canSearch && !disabled,
    staleTime: 60_000,
  });

  const repositories = data?.repositories ?? [];

  return (
    <div className={cn('space-y-3', className)} {...props}>
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          id={id}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          className="border-border z-10 rounded-none border !bg-[#1D1D1D]/100 pl-9 pr-10 text-base placeholder:text-[#9f9f9f]"
          placeholder="Search GitHub repositories"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
        />
        {isFetching && (
          <Loader2 className="text-muted-foreground absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
        )}
      </div>

      {!canSearch && !selectedRepository && (
        <p className="text-muted-foreground text-sm">
          Type at least 2 characters to search GitHub repositories.
        </p>
      )}

      {selectedRepository && (
        <div className="border-border flex items-start gap-3 border bg-[#161616] p-3">
          <img
            src={selectedRepository.owner.avatarUrl || 'https://placehold.co/40x40'}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium">{selectedRepository.fullName}</p>
              <Badge variant="outline" className="rounded-none text-green-400">
                <CheckCircle className="h-3 w-3" />
                Selected
              </Badge>
            </div>
            {selectedRepository.description && (
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                {selectedRepository.description}
              </p>
            )}
          </div>
        </div>
      )}

      {canSearch && error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive flex flex-col gap-3 border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            GitHub search failed. Try another repository name or retry this search.
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Retry
          </Button>
        </div>
      )}

      {canSearch && !error && repositories.length === 0 && !isFetching && (
        <div className="border-border border p-3">
          <p className="text-sm font-medium">No repositories found</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Search by repository name, owner/repo, or a more specific keyword.
          </p>
        </div>
      )}

      {repositories.length > 0 && (
        <div className="border-border max-h-80 overflow-y-auto border bg-[#121212]">
          {repositories.map((repository: any) => {
            const selected = selectedRepository?.fullName === repository.fullName;

            return (
              <button
                key={repository.id}
                type="button"
                className={cn(
                  'hover:bg-accent/40 flex w-full items-start gap-3 border-b border-border p-3 text-left transition-colors last:border-b-0',
                  selected && 'bg-accent/30',
                )}
                onClick={() => onRepositorySelect(repository)}
              >
                <img
                  src={repository.owner.avatarUrl || 'https://placehold.co/40x40'}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{repository.fullName}</span>
                    {repository.language && (
                      <Badge variant="secondary" className="rounded-none">
                        {repository.language}
                      </Badge>
                    )}
                  </div>
                  {repository.description && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                      {repository.description}
                    </p>
                  )}
                  <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {formatCount(repository.stargazersCount)}
                    </span>
                    {repository.topics.slice(0, 3).map((topic: string) => (
                      <span key={topic}>{topic}</span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
