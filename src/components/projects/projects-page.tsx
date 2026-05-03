'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { Filter, RefreshCcw, Search, X } from 'lucide-react';
import { useTRPC } from '@/hooks/use-trpc';
import ProjectCard from './project-card';
import { projectStatuses, projectTags, projectTypes } from '@/lib/project-options';

type ProjectsSearchFilters = {
  q?: string;
  tags?: string;
  statuses?: string;
  types?: string;
  contributors?: boolean;
  investors?: boolean;
  hiring?: boolean;
  acquired?: boolean;
  host?: 'github' | 'gitlab';
  sort?: 'relevance' | 'newest' | 'stars' | 'forks' | 'activity';
};

function csvToArray(value?: string) {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function toCsv(values: string[]) {
  return values.length > 0 ? values.join(',') : undefined;
}

function toggleCsvValue(currentValue: string | undefined, nextValue: string) {
  const currentValues = csvToArray(currentValue);
  const nextValues = currentValues.includes(nextValue)
    ? currentValues.filter((value) => value !== nextValue)
    : [...currentValues, nextValue];

  return toCsv(nextValues);
}

function hasActiveFilters(filters: ProjectsSearchFilters) {
  return Boolean(
    filters.q ||
      filters.tags ||
      filters.statuses ||
      filters.types ||
      filters.contributors ||
      filters.investors ||
      filters.hiring ||
      filters.acquired ||
      filters.host ||
      (filters.sort && filters.sort !== 'relevance'),
  );
}

export default function ProjectsPage({
  filters,
  onFiltersChange,
}: {
  filters: ProjectsSearchFilters;
  onFiltersChange: (filters: Partial<ProjectsSearchFilters>) => void;
}) {
  const trpc = useTRPC();
  const selectedTags = csvToArray(filters.tags);
  const selectedStatuses = csvToArray(filters.statuses);
  const selectedTypes = csvToArray(filters.types);
  const {
    data: projects,
    isLoading,
    isError,
    refetch,
  } = useQuery(
    trpc.projects.getProjects.queryOptions({
      approvalStatus: 'approved',
      search: filters.q,
      tags: selectedTags as (typeof projectTags)[number][],
      statuses: selectedStatuses as (typeof projectStatuses)[number][],
      types: selectedTypes as (typeof projectTypes)[number][],
      lookingForContributors: filters.contributors,
      lookingForInvestors: filters.investors,
      hiring: filters.hiring,
      acquired: filters.acquired,
      host: filters.host,
      sort: filters.sort ?? 'relevance',
    }),
  );

  const activeFilters = hasActiveFilters(filters);

  function clearFilters() {
    onFiltersChange({
      q: undefined,
      tags: undefined,
      statuses: undefined,
      types: undefined,
      contributors: undefined,
      investors: undefined,
      hiring: undefined,
      acquired: undefined,
      host: undefined,
      sort: 'relevance',
    });
  }

  return (
    <div className="">
      <div className="py-8">
        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <Input
                type="text"
                placeholder="Search by project, repository, or description..."
                value={filters.q ?? ''}
                onChange={(event) => onFiltersChange({ q: event.target.value || undefined })}
                className="w-full rounded-none border border-neutral-800 bg-neutral-900 py-2.5 pr-4 pl-10 text-sm text-white placeholder-neutral-500 focus:border-neutral-700 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              {activeFilters && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none border-neutral-800"
                  onClick={clearFilters}
                >
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}
              <Select
                value={filters.sort ?? 'relevance'}
                onValueChange={(sort) =>
                  onFiltersChange({ sort: sort as ProjectsSearchFilters['sort'] })
                }
              >
                <SelectTrigger className="w-40 rounded-none border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-300 focus:border-neutral-700 focus:outline-none">
                  <SelectValue placeholder="Order by" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem className="rounded-none" value="relevance">
                    Relevance
                  </SelectItem>
                  <SelectItem className="rounded-none" value="newest">
                    Newest
                  </SelectItem>
                  <SelectItem className="rounded-none" value="stars">
                    Stars
                  </SelectItem>
                  <SelectItem className="rounded-none" value="forks">
                    Forks
                  </SelectItem>
                  <SelectItem className="rounded-none" value="activity">
                    Activity
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border border-neutral-800 bg-neutral-950/60 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-neutral-200">
              <Filter className="h-4 w-4" />
              Discovery filters
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                value={selectedStatuses[0] ?? 'all'}
                onValueChange={(status) =>
                  onFiltersChange({ statuses: status === 'all' ? undefined : status })
                }
              >
                <SelectTrigger className="rounded-none border-neutral-800 bg-neutral-900">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem className="rounded-none" value="all">
                    Any status
                  </SelectItem>
                  {projectStatuses.map((status) => (
                    <SelectItem key={status} className="rounded-none" value={status}>
                      {status.replace('-', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedTypes[0] ?? 'all'}
                onValueChange={(type) =>
                  onFiltersChange({ types: type === 'all' ? undefined : type })
                }
              >
                <SelectTrigger className="rounded-none border-neutral-800 bg-neutral-900">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem className="rounded-none" value="all">
                    Any type
                  </SelectItem>
                  {projectTypes.map((type) => (
                    <SelectItem key={type} className="rounded-none" value={type}>
                      {type.replace('-', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.host ?? 'all'}
                onValueChange={(host) =>
                  onFiltersChange({
                    host: host === 'all' ? undefined : (host as ProjectsSearchFilters['host']),
                  })
                }
              >
                <SelectTrigger className="rounded-none border-neutral-800 bg-neutral-900">
                  <SelectValue placeholder="Host" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem className="rounded-none" value="all">
                    Any host
                  </SelectItem>
                  <SelectItem className="rounded-none" value="github">
                    GitHub
                  </SelectItem>
                  <SelectItem className="rounded-none" value="gitlab">
                    GitLab
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <BooleanFilter
                checked={filters.contributors === true}
                label="Looking for contributors"
                onCheckedChange={(checked) =>
                  onFiltersChange({ contributors: checked ? true : undefined })
                }
              />
              <BooleanFilter
                checked={filters.investors === true}
                label="Looking for investors"
                onCheckedChange={(checked) =>
                  onFiltersChange({ investors: checked ? true : undefined })
                }
              />
              <BooleanFilter
                checked={filters.hiring === true}
                label="Hiring"
                onCheckedChange={(checked) =>
                  onFiltersChange({ hiring: checked ? true : undefined })
                }
              />
              <BooleanFilter
                checked={filters.acquired === true}
                label="Acquired"
                onCheckedChange={(checked) =>
                  onFiltersChange({ acquired: checked ? true : undefined })
                }
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {projectTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);

                return (
                  <button
                    key={tag}
                    type="button"
                    className="focus-visible:ring-ring rounded-none focus-visible:ring-2 focus-visible:outline-none"
                    onClick={() => onFiltersChange({ tags: toggleCsvValue(filters.tags, tag) })}
                  >
                    <Badge
                      variant={isSelected ? 'default' : 'outline'}
                      className="rounded-none px-2.5 py-1 capitalize"
                    >
                      {tag.replace('-', ' ')}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {isLoading && <div className="text-neutral-400">Loading approved projects...</div>}

        {isError && (
          <div className="border border-neutral-800 p-6">
            <h2 className="text-lg font-medium text-white">Could not load projects</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Discovery data is unavailable right now. Retry without losing your filters.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 rounded-none"
              onClick={() => refetch()}
            >
              <RefreshCcw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && projects?.length === 0 && (
          <div className="border border-dashed border-neutral-800 p-8 text-center">
            <h2 className="text-xl font-medium text-white">No projects match these filters</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">
              Try a broader search, remove a tag, or clear filters to return to all approved public
              projects.
            </p>
            {activeFilters && (
              <Button type="button" className="mt-5 rounded-none" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}

        {!isLoading && !isError && Boolean(projects?.length) && (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            {projects?.map((project) => <ProjectCard key={project.id} project={project} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function BooleanFilter({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2 border border-neutral-800 px-3 text-sm text-neutral-300">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <span>{label}</span>
    </label>
  );
}
