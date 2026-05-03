import { createFileRoute } from '@tanstack/react-router';

import { PoweredByNeon } from '@/components/layout/powered-by-neon';
import { RouteErrorState, RoutePendingState } from '@/components/layout/route-boundaries';
import { SiteHeader } from '@/components/layout/site-header';
import ProjectsPage from '@/components/projects/projects-page';
import { projectStatuses, projectTags, projectTypes } from '@/lib/project-options';

const sortOptions = ['relevance', 'newest', 'stars', 'forks', 'activity'] as const;
const hosts = ['github', 'gitlab'] as const;
type ProjectsSearch = {
  q?: string;
  tags?: string;
  statuses?: string;
  types?: string;
  contributors?: boolean;
  investors?: boolean;
  hiring?: boolean;
  acquired?: boolean;
  host?: (typeof hosts)[number];
  sort?: (typeof sortOptions)[number];
};

function parseCsvFilter(value: unknown, allowedValues: readonly string[]) {
  const values = Array.isArray(value)
    ? value.flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const filteredValues = values
    .map((item) => item.trim())
    .filter((item) => allowedValues.includes(item));

  return filteredValues.length > 0 ? Array.from(new Set(filteredValues)).join(',') : undefined;
}

function parseBooleanFilter(value: unknown) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

export const Route = createFileRoute('/projects/')({
  validateSearch: (search: Record<string, unknown>): ProjectsSearch => {
    const parsed: ProjectsSearch = {};
    const q = typeof search.q === 'string' && search.q.trim() ? search.q.trim() : undefined;
    const tags = parseCsvFilter(search.tags, projectTags);
    const statuses = parseCsvFilter(search.statuses, projectStatuses);
    const types = parseCsvFilter(search.types, projectTypes);
    const contributors = parseBooleanFilter(search.contributors);
    const investors = parseBooleanFilter(search.investors);
    const hiring = parseBooleanFilter(search.hiring);
    const acquired = parseBooleanFilter(search.acquired);
    const host =
      typeof search.host === 'string' && hosts.includes(search.host as (typeof hosts)[number])
        ? (search.host as (typeof hosts)[number])
        : undefined;
    const sort =
      typeof search.sort === 'string' &&
      sortOptions.includes(search.sort as (typeof sortOptions)[number])
        ? (search.sort as (typeof sortOptions)[number])
        : undefined;

    if (q) parsed.q = q;
    if (tags) parsed.tags = tags;
    if (statuses) parsed.statuses = statuses;
    if (types) parsed.types = types;
    if (typeof contributors === 'boolean') parsed.contributors = contributors;
    if (typeof investors === 'boolean') parsed.investors = investors;
    if (typeof hiring === 'boolean') parsed.hiring = hiring;
    if (typeof acquired === 'boolean') parsed.acquired = acquired;
    if (host) parsed.host = host;
    if (sort && sort !== 'relevance') parsed.sort = sort;

    return parsed;
  },
  component: ProjectsRoute,
  pendingComponent: () => <RoutePendingState label="Loading projects" />,
  errorComponent: (props) => (
    <RouteErrorState
      {...props}
      title="Projects could not load"
      description="Project discovery is unavailable right now. Try again in a moment."
    />
  ),
});

function ProjectsRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();

  function updateFilters(nextFilters: Partial<typeof filters>) {
    navigate({
      search: (previous) => {
        const merged = {
          ...previous,
          ...nextFilters,
        };

        return Object.fromEntries(
          Object.entries(merged).filter(([, value]) => value !== undefined && value !== ''),
        ) as ProjectsSearch;
      },
    });
  }

  return (
    <main>
      <SiteHeader />
      <div className="px-6">
        <ProjectsPage filters={filters} onFiltersChange={updateFilters} />
      </div>
      <PoweredByNeon />
    </main>
  );
}
