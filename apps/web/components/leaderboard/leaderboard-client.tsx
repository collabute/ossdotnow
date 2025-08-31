'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@workspace/ui/components/table';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@workspace/ui/components/select';
import { Card, CardContent } from '@workspace/ui/components/card';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';

type UIWindow = '30d' | '365d';

type TopEntry = { userId: string; score: number };

type DetailsEntry = {
  userId: string;
  commits?: number;
  prs?: number;
  issues?: number;
  total?: number;
};

type Profile = {
  userId: string;
  username?: string;
  avatarUrl?: string;
  githubLogin?: string;
  gitlabUsername?: string;
};

type LeaderRow = {
  _profile?: Profile;
  userId: string;
  commits: number;
  prs: number;
  issues: number;
  total: number;
};

type SortKey = 'rank' | 'userId' | 'total' | 'commits' | 'prs' | 'issues';
type SortDir = 'asc' | 'desc';

async function fetchTop(window: UIWindow, limit: number, cursor = 0) {
  const url = `/api/leaderboard?window=${window}&limit=${limit}&cursor=${cursor}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch leaderboard: ${await res.text()}`);
  return (await res.json()) as {
    ok: boolean;
    entries: TopEntry[];
    nextCursor: number | null;
    source: 'redis' | 'db';
  };
}

async function fetchDetails(window: UIWindow, userIds: string[]) {
  if (userIds.length === 0) return { ok: true, window, entries: [] as DetailsEntry[] };
  const res = await fetch(`/api/leaderboard/details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ window, userIds }),
  });
  if (!res.ok) throw new Error(`Failed to fetch details: ${await res.text()}`);
  return (await res.json()) as { ok: true; window: UIWindow; entries: DetailsEntry[] };
}

async function fetchProfiles(userIds: string[]): Promise<Profile[]> {
  if (!userIds.length) return [];
  const res = await fetch('/api/leaderboard/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ userIds }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`profiles ${res.status}: ${t.slice(0, 160)}${t.length > 160 ? '…' : ''}`);
  }
  const data = (await res.json()) as { ok: true; entries: Profile[] };
  return data.entries;
}

export default function LeaderboardClient({
  initialWindow,
}: {
  initialWindow: 'all' | '30d' | '365d';
}) {
  const router = useRouter();
  const search = useSearchParams();

  const normalized: UIWindow = initialWindow === 'all' ? '365d' : initialWindow;

  const [window, setWindow] = React.useState<UIWindow>(normalized);
  const [rows, setRows] = React.useState<LeaderRow[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [limit, setLimit] = React.useState(25);
  const [cursor, setCursor] = React.useState(0);
  const [nextCursor, setNextCursor] = React.useState<number | null>(null);

  const [sortKey, setSortKey] = React.useState<SortKey>('rank');
  const [sortDir, setSortDir] = React.useState<SortDir>('asc');

  const doFetch = React.useCallback(async (w: UIWindow, lim: number, cur: number) => {
    setLoading(true);
    setError(null);
    try {
      const top = await fetchTop(w, lim, cur);
      const ids = top.entries.map((e) => e.userId);
      const [details, profiles] = await Promise.all([fetchDetails(w, ids), fetchProfiles(ids)]);
      const detailMap = new Map(details.entries.map((d) => [d.userId, d]));
      const profileMap = new Map(profiles.map((p) => [p.userId, p]));

      const merged: LeaderRow[] = top.entries.map((e) => {
        const d = detailMap.get(e.userId);
        const commits = Number(d?.commits ?? 0);
        const prs = Number(d?.prs ?? 0);
        const issues = Number(d?.issues ?? 0);
        const detailsTotal = Number(d?.total ?? commits + prs + issues);
        const redisScore = Number(e.score ?? 0);
        const total = Math.max(redisScore, detailsTotal);

        return {
          userId: e.userId,
          commits,
          prs,
          issues,
          total,
          _profile: profileMap.get(e.userId),
        };
      });
      setRows(merged);
      setNextCursor(top.nextCursor);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
      setRows([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    doFetch(window, limit, cursor);
  }, [window, limit, cursor, doFetch]);

  React.useEffect(() => {
    const params = new URLSearchParams(search?.toString() || '');
    params.set('window', window);
    router.replace(`/leaderboard?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir(k === 'rank' ? 'asc' : 'desc');
    }
  }

  const sortedRows = React.useMemo(() => {
    if (!rows) return [];
    const copy = [...rows];
    copy.sort((a, b) => {
      let av: number | string = 0,
        bv: number | string = 0;
      switch (sortKey) {
        case 'userId':
          av = a.userId;
          bv = b.userId;
          break;
        case 'total':
          av = a.total;
          bv = b.total;
          break;
        case 'commits':
          av = a.commits;
          bv = b.commits;
          break;
        case 'prs':
          av = a.prs;
          bv = b.prs;
          break;
        case 'issues':
          av = a.issues;
          bv = b.issues;
          break;
        case 'rank':
        default:
          av = 0;
          bv = 0;
          break;
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return sortKey === 'rank' ? rows : copy;
  }, [rows, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      <Card className="rounded-none">
        <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Window</label>
            <Select
              value={window}
              onValueChange={(v: UIWindow) => {
                setCursor(0);
                setWindow(v);
              }}
            >
              <SelectTrigger className="w-[160px] rounded-none focus-visible:ring-0 focus-visible:border-input">
                <SelectValue placeholder="Time window" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="365d">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Page size</label>
            <Input
              className="w-[88px] rounded-none focus-visible:ring-0"
              type="number"
              min={5}
              max={100}
              value={limit}
              onChange={(e) => {
                const n = Math.max(5, Math.min(100, Number(e.target.value || 25)));
                setLimit(n);
                setCursor(0);
              }}
            />
            <Button
              variant="secondary"
              onClick={() => doFetch(window, limit, 0)}
              disabled={loading}
              className="rounded-none"
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-none">
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px] cursor-pointer" onClick={() => toggleSort('rank')}>
                    Rank
                  </TableHead>
                  <TableHead
                    className="min-w-[260px] cursor-pointer"
                    onClick={() => toggleSort('userId')}
                  >
                    User
                  </TableHead>
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => toggleSort('total')}
                  >
                    Total
                  </TableHead>
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => toggleSort('commits')}
                  >
                    Commits
                  </TableHead>
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => toggleSort('prs')}
                  >
                    PRs
                  </TableHead>
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => toggleSort('issues')}
                  >
                    Issues
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && error && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-destructive py-6 text-center">
                      {error}
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !error && sortedRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center">
                      No entries yet.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  !error &&
                  sortedRows.map((r, idx) => (
                    <TableRow key={r.userId}>
                      <TableCell>{(cursor || 0) + idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 py-2">
                          <div className="bg-muted h-8 w-8 shrink-0 overflow-hidden rounded-full">
                            {r._profile?.avatarUrl && (
                              <img
                                src={r._profile.avatarUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                          <div className="truncate">
                            <div className="truncate font-medium">
                              {r._profile?.username || r.userId}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {r._profile?.githubLogin || r._profile?.gitlabUsername || '—'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{r.total}</TableCell>
                      <TableCell className="text-right">{r.commits}</TableCell>
                      <TableCell className="text-right">{r.prs}</TableCell>
                      <TableCell className="text-right">{r.issues}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          className="rounded-none"
          disabled={loading || cursor === 0}
          onClick={() => setCursor(Math.max(0, cursor - limit))}
        >
          Previous
        </Button>
        <div className="text-muted-foreground text-sm">
          {rows?.length || 0} rows • {window.toUpperCase()}
        </div>
        <Button
          className="rounded-none"
          disabled={loading || nextCursor == null}
          onClick={() => nextCursor != null && setCursor(nextCursor)}
        >
          Next
        </Button>
      </div>

      <a
        className="hover:bg-muted ml-2 inline-flex items-center border px-3 py-2 text-sm"
        href={`/api/leaderboard/export?window=${window}&limit=${limit}&cursor=${cursor}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Export CSV
      </a>
    </div>
  );
}
