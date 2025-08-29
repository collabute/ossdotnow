// packages/api/providers/githubProvider.ts
/* GitHub provider: one-shot rollups for last 30d & last 365d */
const GITHUB_GQL_ENDPOINT = 'https://api.github.com/graphql';

import { z } from 'zod/v4';

/* ------------------------- Types ------------------------- */
export type DateLike = string | Date;
export type DateRange = { from: DateLike; to: DateLike };

export type GithubContributionTotals = {
  login: string;
  commits: number; // totalCommitContributions
  prs: number; // totalPullRequestContributions
  issues: number; // totalIssueContributions
  rateLimit?: {
    cost: number;
    remaining: number;
    resetAt: string;
  };
};

/* ------------------------- Schemas ------------------------- */
const RateLimitSchema = z
  .object({
    cost: z.number(),
    remaining: z.number(),
    resetAt: z.string(),
  })
  .optional();

const ContributionsWindowSchema = z.object({
  totalCommitContributions: z.number(),
  totalPullRequestContributions: z.number(),
  totalIssueContributions: z.number(),
});

const UserWindowsSchema = z.object({
  id: z.string(),
  login: z.string(),
  // We alias two windows (c30, c365) or a generic one (cwin)
  c30: ContributionsWindowSchema.optional(),
  c365: ContributionsWindowSchema.optional(),
  cwin: ContributionsWindowSchema.optional(),
});

const GraphQLDataSchema = z.object({
  user: UserWindowsSchema.nullable(),
  rateLimit: RateLimitSchema,
});

const GraphQLResponseSchema = z.object({
  data: GraphQLDataSchema.optional(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        type: z.string().optional(),
        path: z.array(z.union([z.string(), z.number()])).optional(),
      }),
    )
    .optional(),
});

/* ------------------------- Utils ------------------------- */
function toIsoDateTime(x: DateLike): string {
  const d = typeof x === 'string' ? new Date(x) : x;
  return d.toISOString();
}

async function githubGraphQLRequest<T>({
  token,
  query,
  variables,
}: {
  token: string;
  query: string;
  variables: Record<string, unknown>;
}): Promise<T> {
  if (!token) {
    throw new Error('GitHub GraphQL token is required. Pass GITHUB_TOKEN.');
  }

  const res = await fetch(GITHUB_GQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub GraphQL HTTP ${res.status}: ${text || res.statusText}`);
  }

  const json = (await res.json()) as unknown;
  const parsed = GraphQLResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error('Unexpected GitHub GraphQL response shape');
  if (parsed.data.errors?.length) {
    const msgs = parsed.data.errors.map((e) => e.message).join('; ');
    throw new Error(`GitHub GraphQL error(s): ${msgs}`);
  }

  const data = parsed.data.data;
  if (!data) throw new Error('GitHub GraphQL returned no data');
  return data as T;
}

/* ------------------------- Public API ------------------------- */

/** Arbitrary range fetch (respects the provided DateRange). */
export async function getGithubContributionTotals(
  login: string,
  range: DateRange,
  token: string,
): Promise<GithubContributionTotals> {
  const query = `
    query ($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        id
        login
        cwin: contributionsCollection(from: $from, to: $to) {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
        }
      }
      rateLimit {
        cost
        remaining
        resetAt
      }
    }
  `;

  const data = await githubGraphQLRequest<z.infer<typeof GraphQLDataSchema>>({
    token,
    query,
    variables: { login, from: toIsoDateTime(range.from), to: toIsoDateTime(range.to) },
  });

  if (!data.user || !data.user.cwin) {
    return {
      login,
      commits: 0,
      prs: 0,
      issues: 0,
      rateLimit: data.rateLimit ? { ...data.rateLimit } : undefined,
    };
  }

  const w = data.user.cwin;
  return {
    login: data.user.login,
    commits: w.totalCommitContributions,
    prs: w.totalPullRequestContributions,
    issues: w.totalIssueContributions,
    rateLimit: data.rateLimit ? { ...data.rateLimit } : undefined,
  };
}

/**
 * One-shot rollups for LAST 30D & LAST 365D (as of "now").
 * Use this in your daily cron, then upsert two rows:
 *   - (userId, 'last_30d', commits/prs/issues/total)
 *   - (userId, 'last_365d', commits/prs/issues/total)
 */
export async function getGithubContributionRollups(
  login: string,
  token: string,
): Promise<{
  login: string;
  last30d: GithubContributionTotals;
  last365d: GithubContributionTotals;
  rateLimit?: GithubContributionTotals['rateLimit'];
}> {
  const now = new Date();
  const to = now.toISOString();
  const from30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const from365 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const query = `
    query ($login: String!, $from30: DateTime!, $from365: DateTime!, $to: DateTime!) {
      user(login: $login) {
        id
        login
        c30: contributionsCollection(from: $from30, to: $to) {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
        }
        c365: contributionsCollection(from: $from365, to: $to) {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
        }
      }
      rateLimit {
        cost
        remaining
        resetAt
      }
    }
  `;

  const data = await githubGraphQLRequest<z.infer<typeof GraphQLDataSchema>>({
    token,
    query,
    variables: { login, from30, from365, to },
  });

  const rl = data.rateLimit ? { ...data.rateLimit } : undefined;
  const userLogin = data.user?.login ?? login;

  const pick = (w?: z.infer<typeof ContributionsWindowSchema>): GithubContributionTotals => ({
    login: userLogin,
    commits: w?.totalCommitContributions ?? 0,
    prs: w?.totalPullRequestContributions ?? 0,
    issues: w?.totalIssueContributions ?? 0,
    rateLimit: rl,
  });

  return {
    login: userLogin,
    last30d: pick(data.user?.c30),
    last365d: pick(data.user?.c365),
    rateLimit: rl,
  };
}

/** Optional: day-specific, kept for compatibility. */
export async function getGithubContributionTotalsForDay(
  login: string,
  dayUtc: DateLike,
  token: string,
): Promise<GithubContributionTotals> {
  const d = typeof dayUtc === 'string' ? new Date(dayUtc) : dayUtc;
  const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const to = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999),
  );
  return getGithubContributionTotals(login, { from, to }, token);
}
