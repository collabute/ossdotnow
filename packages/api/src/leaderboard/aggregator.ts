// packages/api/aggregators/contribRollups.ts
import { sql } from "drizzle-orm";
import type { DB } from "@workspace/db";

import { contribRollups } from "@workspace/db/schema"; // new table (user_id, period, commits, prs, issues, total, fetched_at, updated_at)
import { getGithubContributionRollups } from "../providers/github";
import { getGitlabContributionRollups } from "../providers/gitlab";

// Providers: use the rollup functions that fetch today's snapshot windows

export type AggregatorDeps = { db: DB };

export type RefreshUserRollupsArgs = {
  userId: string;

  // Exactly one of these should be present for a user profile
  githubLogin?: string | null;
  gitlabUsername?: string | null;

  // Provider creds/config
  githubToken?: string;
  gitlabToken?: string;
  gitlabBaseUrl?: string; // defaulted to https://gitlab.com if omitted
};

type PeriodKey = "last_30d" | "last_365d";

function nowUtc(): Date {
  return new Date();
}

async function upsertRollup(
  db: DB,
  params: {
    userId: string;
    period: PeriodKey;
    commits: number;
    prs: number; // for GitLab, pass MRs here
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
  provider: "github" | "gitlab" | "none";
  wrote: {
    last_30d?: { commits: number; prs: number; issues: number; total: number };
    last_365d?: { commits: number; prs: number; issues: number; total: number };
  };
}> {
  const db = deps.db;
  const now = nowUtc();

  // Decide provider (your app-level invariant: one or the other)
  const hasGithub = !!args.githubLogin && !!args.githubToken;
  const hasGitlab = !!args.gitlabUsername; // token optional for public, but recommended

  if (!hasGithub && !hasGitlab) {
    return { provider: "none", wrote: {} };
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
      period: "last_30d",
      commits: roll.last30d.commits,
      prs: roll.last30d.prs,
      issues: roll.last30d.issues,
      fetchedAt: now,
    });

    await upsertRollup(db, {
      userId: args.userId,
      period: "last_365d",
      commits: roll.last365d.commits,
      prs: roll.last365d.prs,
      issues: roll.last365d.issues,
      fetchedAt: now,
    });

    return {
      provider: "github",
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

  // GitLab path
  const base = (args.gitlabBaseUrl?.trim() || "https://gitlab.com") as string;
  const r = await getGitlabContributionRollups(args.gitlabUsername!.trim(), base, args.gitlabToken);

  // Map MRs -> prs for DB
  await upsertRollup(db, {
    userId: args.userId,
    period: "last_30d",
    commits: r.last30d.commits,
    prs: r.last30d.mrs,
    issues: r.last30d.issues,
    fetchedAt: now,
  });

  await upsertRollup(db, {
    userId: args.userId,
    period: "last_365d",
    commits: r.last365d.commits,
    prs: r.last365d.mrs,
    issues: r.last365d.issues,
    fetchedAt: now,
  });

  return {
    provider: "gitlab",
    wrote: {
      last_30d: {
        commits: r.last30d.commits,
        prs: r.last30d.mrs,
        issues: r.last30d.issues,
        total: r.last30d.commits + r.last30d.mrs + r.last30d.issues,
      },
      last_365d: {
        commits: r.last365d.commits,
        prs: r.last365d.mrs,
        issues: r.last365d.issues,
        total: r.last365d.commits + r.last365d.mrs + r.last365d.issues,
      },
    },
  };
}

/**
 * Batch helper: refresh many users with a concurrency limit.
 * Pass a list of user descriptors (each with either githubLogin or gitlabUsername).
 */
export async function refreshManyUsersRollups<T extends RefreshUserRollupsArgs & { userId: string }>(
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
