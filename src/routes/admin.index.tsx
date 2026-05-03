'use client';

import { createFileRoute } from '@tanstack/react-router';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock,
  Folder,
  GitBranch,
  Mail,
  Timer,
  UploadCloud,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import NumberFlow from '@number-flow/react';

import Link from '@/components/ui/link';
import { useTRPC } from '@/hooks/use-trpc';

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
});

function AdminDashboard() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.admin.dashboard.queryOptions());
  const latestProjects = data?.latestProjects ?? [];
  const providerStatus = data?.providerStatus;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Live platform operations, review health, and provider readiness.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total users" value={data?.counts.users ?? 0} icon={Users} />
        <MetricCard
          label="Onboarded users"
          value={data?.counts.onboardedUsers ?? 0}
          icon={UserCheck}
        />
        <MetricCard label="Total projects" value={data?.counts.projects ?? 0} icon={Folder} />
        <MetricCard
          label="Claimed projects"
          value={data?.counts.claimedProjects ?? 0}
          icon={GitBranch}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pending review"
          value={data?.counts.pendingProjects ?? 0}
          icon={Clock}
        />
        <MetricCard
          label="Approved"
          value={data?.counts.approvedProjects ?? 0}
          icon={CheckCircle2}
        />
        <MetricCard label="Rejected" value={data?.counts.rejectedProjects ?? 0} icon={XCircle} />
        <MetricCard
          label="Avg review SLA"
          value={formatHours(data?.reviewSla.averageReviewHours ?? 0)}
          icon={Timer}
          isText
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent project submissions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading activity...</p>
            ) : latestProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No project submissions yet.</p>
            ) : (
              <div className="space-y-4">
                {latestProjects.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/projects/${item.id}`}
                        className="font-medium hover:underline"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {item.gitRepoUrl}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Submitted {formatDistanceToNow(item.createdAt)} ago
                      </p>
                    </div>
                    <Badge variant="secondary" className="w-fit rounded-none capitalize">
                      {item.approvalStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FunnelRow label="Contributor interest" value={data?.counts.contributorInterest ?? 0} />
            <FunnelRow label="Investor interest" value={data?.counts.investorInterest ?? 0} />
            <FunnelRow label="Archived waitlist" value={data?.counts.earlyAccess ?? 0} />
            <FunnelRow label="Reviewed projects" value={data?.reviewSla.reviewedCount ?? 0} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ProviderCard
          label="GitHub OAuth"
          configured={providerStatus?.github.oauthConfigured ?? false}
          icon={GitBranch}
        />
        <ProviderCard
          label="GitHub token"
          configured={providerStatus?.github.tokenConfigured ?? false}
          icon={GitBranch}
        />
        <ProviderCard
          label="Google OAuth"
          configured={providerStatus?.google.oauthConfigured ?? false}
          icon={Users}
        />
        <ProviderCard
          label="Resend"
          configured={providerStatus?.resend.configured ?? false}
          icon={Mail}
        />
        <ProviderCard
          label="UploadThing"
          configured={providerStatus?.uploadThing.configured ?? false}
          icon={UploadCloud}
        />
        <ProviderCard
          label="OpenAI"
          configured={providerStatus?.openai.configured ?? false}
          icon={Bot}
        />
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  isText = false,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  isText?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isText ? value : <NumberFlow value={Number(value)} />}
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">
        <NumberFlow value={value} />
      </p>
    </div>
  );
}

function ProviderCard({
  label,
  configured,
  icon: Icon,
}: {
  label: string;
  configured: boolean;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Badge
          variant={configured ? 'secondary' : 'outline'}
          className={configured ? 'rounded-none text-green-600' : 'rounded-none text-amber-600'}
        >
          {configured ? 'Configured' : 'Missing'}
        </Badge>
        {!configured ? <AlertCircle className="mt-3 h-4 w-4 text-amber-600" /> : null}
      </CardContent>
    </Card>
  );
}

function formatHours(value: number) {
  if (value <= 0) return '0h';
  if (value < 1) return `${Math.round(value * 60)}m`;
  if (value < 48) return `${Math.round(value)}h`;

  return `${Math.round(value / 24)}d`;
}
