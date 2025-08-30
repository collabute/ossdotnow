#!/usr/bin/env bun
import 'dotenv/config';
import { z } from 'zod';
import { getGithubContributionTotals } from '../packages/api/src/providers/github';

const ArgSchema = z.object({
  login: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  preset: z.enum(['30d', '365d']).optional(),
  token: z.string().optional(),
});

function parseArgs(argv: string[]) {
  const kv: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=');
    kv[k] = v ?? '1';
  }
  if (!kv.login && argv[2] && !argv[2].startsWith('--')) {
    kv.login = argv[2]!;
  }
  const parsed = ArgSchema.safeParse(kv);
  if (!parsed.success) {
    console.error('❌ Invalid arguments:\n', parsed.error.format());
    process.exit(1);
  }
  return parsed.data;
}

function toDateOrThrow(s: string, label: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ${label} date: ${JSON.stringify(s)}`);
  }
  return d;
}

function rangeFromInputs(opts: {
  from?: string;
  to?: string;
  days?: number;
  preset?: '30d' | '365d';
}): { from: Date; to: Date } {
  const now = new Date();
  if (opts.from && opts.to) {
    const from = toDateOrThrow(opts.from, 'from');
    const to = toDateOrThrow(opts.to, 'to');
    if (from.getTime() >= to.getTime()) {
      throw new Error(`'from' must be < 'to'`);
    }
    return { from, to };
  }

  if (opts.preset === '30d') {
    return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
  }
  if (opts.preset === '365d') {
    return { from: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), to: now };
  }

  if (opts.days) {
    return { from: new Date(now.getTime() - opts.days * 24 * 60 * 60 * 1000), to: now };
  }

  return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
}

async function main() {
  const args = parseArgs(process.argv);
  const { login } = args;
  const { from, to } = rangeFromInputs({
    from: args.from,
    to: args.to,
    days: args.days,
    preset: args.preset,
  });

  const token = args.token || process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ Missing GitHub token. Pass --token=... or set GITHUB_TOKEN in env.');
    process.exit(1);
  }

  const res = await getGithubContributionTotals(login, { from, to }, token);

  const total = res.commits + res.prs + res.issues;
  const out = {
    login: res.login,
    range: { from: from.toISOString(), to: to.toISOString() },
    totals: {
      commits: res.commits,
      prs: res.prs,
      issues: res.issues,
      total,
    },
    rateLimit: res.rateLimit ?? null,
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error('❌ Error:', err?.message || err);
  process.exit(1);
});
