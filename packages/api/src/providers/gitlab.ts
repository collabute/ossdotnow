// packages/api/providers/gitlabProvider.ts
/* GitLab provider: fetch 365d once, derive 30d from that same event set. */
import { z } from 'zod/v4';

/* ------------------------- Types ------------------------- */
export type DateLike = string | Date;
export type DateRange = { from: DateLike; to: DateLike };

export type GitlabContributionTotals = {
  username: string;
  commits: number;
  mrs: number; // map to "prs" when writing to DB
  issues: number;
  meta?: {
    pagesFetched: number;
    perPage: number;
    publicEventsCount?: number;
    totalEventsScanned?: number;
  };
};

/* ------------------------- Schemas ------------------------- */
const GitlabUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string().optional(),
});

const GitlabEventSchema = z.object({
  id: z.number(),
  project_id: z.number().optional(),
  action_name: z.string().optional(),
  target_type: z.string().nullable().optional(),
  created_at: z.string(),
  push_data: z
    .object({
      commit_count: z.number().optional(),
    })
    .optional(),
});

/* ------------------------- Utils ------------------------- */
function cleanBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function toIso8601(input: DateLike): string {
  if (input instanceof Date) return input.toISOString();
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? String(input) : d.toISOString();
}

function startOfUtcDay(d: DateLike): Date {
  const date = d instanceof Date ? new Date(d) : new Date(d);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );
}

function addDaysUTC(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ------------------------- HTTP ------------------------- */
async function glGet(
  baseUrl: string,
  path: string,
  token?: string,
  query?: Record<string, string | number | undefined>,
): Promise<Response> {
  const u = new URL(cleanBaseUrl(baseUrl) + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['PRIVATE-TOKEN'] = token;
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 15_000);

  try {
    let res = await fetch(u.toString(), { headers, signal: controller.signal });

    // Basic rate limiting retry
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') || 1);
      const waitSec = Math.min(Math.max(retryAfter, 1), 10);
      await sleep(waitSec * 1000);
      res = await fetch(u.toString(), { headers, signal: controller.signal });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GitLab HTTP ${res.status}: ${text || res.statusText} (${u})`);
    }

    return res;
  } finally {
    clearTimeout(to);
  }
}

/* ------------------------- Core helpers ------------------------- */
export async function resolveGitlabUserId(
  username: string,
  baseUrl: string,
  token?: string,
): Promise<{ id: number; username: string } | null> {
  const res = await glGet(baseUrl, `/api/v4/users`, token, { username, per_page: 1 });
  const json = await res.json();
  const arr = z.array(GitlabUserSchema).parse(json);
  if (!arr.length) return null;
  return { id: arr[0]!.id, username: arr[0]!.username };
}

type FetchEventsOptions = {
  afterIso: string;
  beforeIso: string;
  perPage?: number;
  maxPages?: number;
};

const projectVisibilityCache = new Map<number, 'public' | 'private' | 'internal' | 'unknown'>();

async function getProjectVisibility(
  baseUrl: string,
  projectId: number,
  token?: string,
): Promise<'public' | 'private' | 'internal' | 'unknown'> {
  const cached = projectVisibilityCache.get(projectId);
  if (cached) return cached;

  try {
    const res = await glGet(baseUrl, `/api/v4/projects/${projectId}`, token);
    const data = (await res.json()) as { visibility?: string };
    const vis = (data?.visibility ?? 'unknown') as 'public' | 'private' | 'internal' | 'unknown';
    projectVisibilityCache.set(projectId, vis);
    return vis;
  } catch {
    projectVisibilityCache.set(projectId, 'unknown');
    return 'unknown';
  }
}

async function fetchUserEventsByWindow(
  userId: number,
  baseUrl: string,
  token: string | undefined,
  opts: FetchEventsOptions,
): Promise<{
  events: z.infer<typeof GitlabEventSchema>[];
  pagesFetched: number;
  perPage: number;
  totalScanned: number;
}> {
  const perPage = Math.min(Math.max(opts.perPage ?? 100, 20), 100);
  const maxPages = Math.min(Math.max(opts.maxPages ?? 10, 1), 50);
  const lowerMs = new Date(opts.afterIso).getTime();
  const upperMs = new Date(opts.beforeIso).getTime();

  let page = 1;
  let pagesFetched = 0;
  let totalScanned = 0;
  const out: z.infer<typeof GitlabEventSchema>[] = [];

  while (true) {
    const res = await glGet(baseUrl, `/api/v4/users/${userId}/events`, token, {
      after: opts.afterIso,
      before: opts.beforeIso,
      per_page: perPage,
      page,
      scope: 'all',
    });
    pagesFetched++;

    const json = await res.json();
    const events = z.array(GitlabEventSchema).parse(json);
    totalScanned += events.length;

    // Enforce window just in case
    const filteredByWindow = events.filter((e) => {
      const t = new Date(e.created_at).getTime();
      return t >= lowerMs && t < upperMs;
    });
    out.push(...filteredByWindow);

    // If page fully older than lower bound, we can break early
    if (
      filteredByWindow.length === 0 &&
      events.length > 0 &&
      Math.max(...events.map((e) => new Date(e.created_at).getTime())) < lowerMs
    ) {
      break;
    }

    const nextPageHeader = res.headers.get('X-Next-Page');
    const hasNext = !!nextPageHeader && nextPageHeader !== '0';
    if (!hasNext) break;

    const next = Number(nextPageHeader);
    if (!Number.isFinite(next) || next <= 0) break;
    if (next > maxPages) break;

    page = next;
  }

  return { events: out, pagesFetched, perPage, totalScanned };
}

async function filterPublicEvents(
  baseUrl: string,
  token: string | undefined,
  events: z.infer<typeof GitlabEventSchema>[],
): Promise<z.infer<typeof GitlabEventSchema>[]> {
  const byProject = new Map<number, z.infer<typeof GitlabEventSchema>[]>();
  const orphan: z.infer<typeof GitlabEventSchema>[] = [];

  for (const e of events) {
    if (typeof e.project_id === 'number') {
      const arr = byProject.get(e.project_id) ?? [];
      arr.push(e);
      byProject.set(e.project_id, arr);
    } else {
      orphan.push(e);
    }
  }

  const out: z.infer<typeof GitlabEventSchema>[] = [];
  for (const [pid, list] of byProject) {
    const vis = await getProjectVisibility(baseUrl, pid, token);
    if (vis === 'public') out.push(...list);
  }
  // Orphans (no project_id) are ignored; they typically can't be attributed safely.

  return out;
}

function reducePublicContributionCounts(events: z.infer<typeof GitlabEventSchema>[]) {
  let commits = 0;
  let mrs = 0;
  let issues = 0;

  for (const e of events) {
    const target = e.target_type ?? undefined;
    const action = (e.action_name || '').toLowerCase();

    // Commits from push events
    if (e.push_data && typeof e.push_data.commit_count === 'number') {
      if (action.includes('push')) {
        commits += Math.max(0, e.push_data.commit_count || 0);
        continue;
      }
    }

    // Opened MRs
    if (target === 'MergeRequest' && action === 'opened') {
      mrs += 1;
      continue;
    }

    // Opened Issues
    if (target === 'Issue' && action === 'opened') {
      issues += 1;
      continue;
    }
  }

  return { commits, mrs, issues };
}

/* ------------------------- Public API ------------------------- */

/** Arbitrary range (kept for completeness and testing). */
export async function getGitlabContributionTotals(
  username: string,
  range: DateRange,
  baseUrl: string,
  token?: string,
): Promise<GitlabContributionTotals> {
  projectVisibilityCache.clear();

  const fromIso = toIso8601(range.from);
  const toIso = toIso8601(range.to);

  const user = await resolveGitlabUserId(username, baseUrl, token);
  if (!user) {
    return { username, commits: 0, mrs: 0, issues: 0 };
  }

  const { events, pagesFetched, perPage, totalScanned } = await fetchUserEventsByWindow(
    user.id,
    baseUrl,
    token,
    {
      afterIso: fromIso,
      beforeIso: toIso,
      perPage: 100,
      maxPages: 25,
    },
  );

  const publicEvents = await filterPublicEvents(baseUrl, token, events);
  const totals = reducePublicContributionCounts(publicEvents);

  return {
    username: user.username,
    ...totals,
    meta: {
      pagesFetched,
      perPage,
      publicEventsCount: publicEvents.length,
      totalEventsScanned: totalScanned,
    },
  };
}

/**
 * One-shot rollups for LAST 30D & LAST 365D (as of "now").
 * Implementation fetches 365d once and derives 30d from that same set.
 */
export async function getGitlabContributionRollups(
  username: string,
  baseUrl: string,
  token?: string,
): Promise<{
  username: string;
  last30d: GitlabContributionTotals; // map mrs -> prs on write
  last365d: GitlabContributionTotals; // map mrs -> prs on write
  meta: {
    pagesFetched: number;
    perPage: number;
    publicEventsCount365: number;
    publicEventsCount30: number;
    totalEventsScanned: number;
    windowFrom365: string;
    windowTo: string;
  };
}> {
  projectVisibilityCache.clear();

  const now = new Date();
  const toIso = now.toISOString();
  const from365Iso = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const from30Iso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const user = await resolveGitlabUserId(username, baseUrl, token);
  if (!user) {
    const empty: GitlabContributionTotals = { username, commits: 0, mrs: 0, issues: 0 };
    return {
      username,
      last30d: empty,
      last365d: empty,
      meta: {
        pagesFetched: 0,
        perPage: 0,
        publicEventsCount365: 0,
        publicEventsCount30: 0,
        totalEventsScanned: 0,
        windowFrom365: from365Iso,
        windowTo: toIso,
      },
    };
  }

  // Fetch once for 365d
  const { events, pagesFetched, perPage, totalScanned } = await fetchUserEventsByWindow(
    user.id,
    baseUrl,
    token,
    {
      afterIso: from365Iso,
      beforeIso: toIso,
      perPage: 100,
      maxPages: 25,
    },
  );

  // Keep only public events
  const publicEvents365 = await filterPublicEvents(baseUrl, token, events);

  // Derive 30d subset
  const from30Ms = new Date(from30Iso).getTime();
  const publicEvents30 = publicEvents365.filter(
    (e) => new Date(e.created_at).getTime() >= from30Ms,
  );

  // Reduce
  const totals365 = reducePublicContributionCounts(publicEvents365);
  const totals30 = reducePublicContributionCounts(publicEvents30);

  const last365d: GitlabContributionTotals = {
    username: user.username,
    ...totals365,
    meta: {
      pagesFetched,
      perPage,
      publicEventsCount: publicEvents365.length,
      totalEventsScanned: totalScanned,
    },
  };

  const last30d: GitlabContributionTotals = {
    username: user.username,
    ...totals30,
    meta: {
      pagesFetched,
      perPage,
      publicEventsCount: publicEvents30.length,
      totalEventsScanned: totalScanned,
    },
  };

  return {
    username: user.username,
    last30d,
    last365d,
    meta: {
      pagesFetched,
      perPage,
      publicEventsCount365: publicEvents365.length,
      publicEventsCount30: publicEvents30.length,
      totalEventsScanned: totalScanned,
      windowFrom365: from365Iso,
      windowTo: toIso,
    },
  };
}

/** Optional: day-specific helper for parity. */
export async function getGitlabContributionTotalsForDay(
  username: string,
  dayUtc: DateLike,
  baseUrl: string,
  token?: string,
): Promise<GitlabContributionTotals> {
  const start = startOfUtcDay(dayUtc);
  const end = addDaysUTC(start, 1);
  return getGitlabContributionTotals(username, { from: start, to: end }, baseUrl, token);
}
