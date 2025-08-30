import LeaderboardClient from '@/components/leaderboard/leaderboard-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function normalizeWindow(v: unknown): '30d' | '365d' {
  if (v === '30d') return '30d';
  if (v === '365d') return '365d';
  return '365d';
}

export default async function LeaderboardPage({ searchParams }: { searchParams?: SearchParams }) {
  const sp = await searchParams;
  const winParam = sp && 'window' in sp
    ? Array.isArray(sp.window) ? sp.window[0] : sp.window
    : undefined;
  const initialWindow = normalizeWindow(winParam);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mt-12 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Global Leaderboard</h1>
        <p className="text-muted-foreground">
          Top contributors across GitHub and GitLab based of open source contributions.
        </p>
      </div>
      <LeaderboardClient initialWindow={initialWindow} />
    </div>
  );
}
