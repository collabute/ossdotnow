import type { DB } from '@workspace/db';
import { sql } from 'drizzle-orm';

import { getGitlabContributionRollups } from '../providers/gitlab';
import { getGithubContributionRollups } from '../providers/github';
import { contribRollups } from '@workspace/db/schema';

export type AggregatorDeps = { db: DB };

export type RefreshUserRollupsArgs = {
  userId: string;

  githubLogin?: string | null;
  gitlabUsername?: string | null;

  githubToken?: string;
  gitlabToken?: string;
  gitlabBaseUrl?: string;
};

type PeriodKey = 'last_30d' | 'last_365d';

function nowUtc(): Date {
  return new Date();
}

async function upsertRollup(
  db: DB,
  params: {
    userId: string;
    period: PeriodKey;
    commits: number;
    prs: number;
    issues: number;
    fetchedAt: Date;
  },
) {
  const total = params.commits + params.prs + params.issues;

  await db
    .insert(contribRollups)
    .values({
      userId: params.userId,
      period: params.period,
      commits: params.commits,
      prs: params.prs,
      issues: params.issues,
      total,
      fetchedAt: params.fetchedAt,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: [contribRollups.userId, contribRollups.period],
      set: {
        commits: params.commits,
        prs: params.prs,
        issues: params.issues,
        total,
        fetchedAt: params.fetchedAt,
        updatedAt: sql`now()`,
      },
    });
}

export async function refreshUserRollups(
  deps: AggregatorDeps,
  args: RefreshUserRollupsArgs,
): Promise<{
  provider: 'github' | 'gitlab' | 'none';
  wrote: {
    last_30d?: { commits: number; prs: number; issues: number; total: number };
    last_365d?: { commits: number; prs: number; issues: number; total: number };
  };
}> {
  const db = deps.db;
  const now = nowUtc();

  const hasGithub = !!args.githubLogin && !!args.githubToken;
  const hasGitlab = !!args.gitlabUsername && !!args.gitlabToken;

  if (!hasGithub && !hasGitlab) {
    return { provider: 'none', wrote: {} };
  }

  if (hasGithub && hasGitlab) {
    // If this can never happen by design, you can throw instead.
    // We'll prefer GitHub if both are accidentally present.
    // throw new Error('User cannot have both GitHub and GitLab identities');
  }

  if (hasGithub) {
    const roll = await getGithubContributionRollups(args.githubLogin!.trim(), args.githubToken!);

    await upsertRollup(db, {
      userId: args.userId,
      period: 'last_30d',
      commits: roll.last30d.commits,
      prs: roll.last30d.prs,
      issues: roll.last30d.issues,
      fetchedAt: now,
    });

    await upsertRollup(db, {
      userId: args.userId,
      period: 'last_365d',
      commits: roll.last365d.commits,
      prs: roll.last365d.prs,
      issues: roll.last365d.issues,
      fetchedAt: now,
    });

    return {
      provider: 'github',
      wrote: {
        last_30d: {
          commits: roll.last30d.commits,
          prs: roll.last30d.prs,
          issues: roll.last30d.issues,
          total: roll.last30d.commits + roll.last30d.prs + roll.last30d.issues,
        },
        last_365d: {
          commits: roll.last365d.commits,
          prs: roll.last365d.prs,
          issues: roll.last365d.issues,
          total: roll.last365d.commits + roll.last365d.prs + roll.last365d.issues,
        },
      },
    };
  }

  const base = (args.gitlabBaseUrl?.trim() || 'https://gitlab.com') as string;
  const r = await getGitlabContributionRollups(args.gitlabUsername!.trim(), base, args.gitlabToken);

  await upsertRollup(db, {
    userId: args.userId,
    period: 'last_30d',
    commits: r.last30d.commits,
    prs: r.last30d.prs,
    issues: r.last30d.issues,
    fetchedAt: now,
  });

  await upsertRollup(db, {
    userId: args.userId,
    period: 'last_365d',
    commits: r.last365d.commits,
    prs: r.last365d.prs,
    issues: r.last365d.issues,
    fetchedAt: now,
  });

  return {
    provider: 'gitlab',
    wrote: {
      last_30d: {
        commits: r.last30d.commits,
        prs: r.last30d.prs,
        issues: r.last30d.issues,
        total: r.last30d.commits + r.last30d.prs + r.last30d.issues,
      },
      last_365d: {
        commits: r.last365d.commits,
        prs: r.last365d.prs,
        issues: r.last365d.issues,
        total: r.last365d.commits + r.last365d.prs + r.last365d.issues,
      },
    },
  };
}

export async function refreshManyUsersRollups<
  T extends RefreshUserRollupsArgs & { userId: string },
>(
  deps: AggregatorDeps,
  users: readonly T[],
  opts?: { concurrency?: number; onProgress?: (done: number, total: number) => void },
) {
  const limit = Math.max(1, opts?.concurrency ?? 4);
  const total = users.length;
  let idx = 0;

  const worker = async () => {
    while (true) {
      const i = idx++;
      if (i >= total) return;
      await refreshUserRollups(deps, users[i]!);
      opts?.onProgress?.(i + 1, total);
    }
  };

  await Promise.all(Array.from({ length: limit }, worker));
}
