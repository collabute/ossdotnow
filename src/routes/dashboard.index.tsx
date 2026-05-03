import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import {
  ArrowRight,
  Bookmark,
  CircleDollarSign,
  FolderOpen,
  Inbox,
  Loader2,
  Plus,
  Send,
  Star,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from '@/components/ui/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTRPC } from '@/hooks/use-trpc';
import { cn } from '@/lib/utils';
import type { Project, RouterOutputs } from '@/lib/api-types';
import { accountTypes, projectTags, projectTypes } from '@/lib/project-options';

export const Route = createFileRoute('/dashboard/')({
  component: DashboardIndex,
});

function DashboardIndex() {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const context = Route.useRouteContext();
  const isOwner = context.user.accountType === 'owner';
  const isContributor = context.user.accountType === 'contributor';
  const isInvestor = context.user.accountType === 'investor';
  const myProjects = useQuery({
    ...trpc.projects.getMyProjects.queryOptions(),
    enabled: isOwner,
  });
  const interestInbox = useQuery({
    ...trpc.projects.getMyProjectInterestInbox.queryOptions(),
    enabled: isOwner,
  });
  const contributorProfile = useQuery({
    ...trpc.user.getContributorProfile.queryOptions(),
    enabled: isContributor,
  });
  const investorProfile = useQuery({
    ...trpc.user.getInvestorProfile.queryOptions(),
    enabled: isInvestor,
  });
  const recommendedProjects = useQuery({
    ...trpc.projects.getRecommendedProjects.queryOptions({ limit: 6 }),
    enabled: isContributor || isInvestor,
  });
  const savedProjects = useQuery({
    ...trpc.projects.getSavedProjects.queryOptions(),
    enabled: isContributor || isInvestor,
  });
  const interestHistory = useQuery({
    ...trpc.projects.getMyProjectInterestHistory.queryOptions(),
    enabled: isContributor || isInvestor,
  });

  const projects = myProjects.data ?? [];
  const pending = projects.filter((project) => project.approvalStatus === 'pending').length;
  const approved = projects.filter((project) => project.approvalStatus === 'approved').length;
  const rejected = projects.filter((project) => project.approvalStatus === 'rejected').length;
  const updateAccountType = useMutation({
    ...trpc.user.updateAccountType.mutationOptions(),
    onSuccess: async () => {
      toast.success('Account type updated');
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      await router.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Could not update account type');
    },
  });
  const upsertContributorProfile = useMutation({
    ...trpc.user.upsertContributorProfile.mutationOptions(),
    onSuccess: () => {
      toast.success('Contributor profile saved');
      queryClient.invalidateQueries({ queryKey: trpc.user.getContributorProfile.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.projects.getRecommendedProjects.queryKey({ limit: 6 }) });
    },
    onError: (error) => {
      toast.error(error.message || 'Could not save contributor profile');
    },
  });
  const upsertInvestorProfile = useMutation({
    ...trpc.user.upsertInvestorProfile.mutationOptions(),
    onSuccess: () => {
      toast.success('Investor profile saved');
      queryClient.invalidateQueries({ queryKey: trpc.user.getInvestorProfile.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.projects.getRecommendedProjects.queryKey({ limit: 6 }) });
    },
    onError: (error) => {
      toast.error(error.message || 'Could not save investor profile');
    },
  });
  const expressInterest = useMutation({
    ...trpc.projects.expressProjectInterest.mutationOptions(),
    onSuccess: () => {
      toast.success('Interest sent');
      queryClient.invalidateQueries({ queryKey: trpc.projects.getMyProjectInterestHistory.queryKey() });
    },
    onError: (error) => {
      toast.error(error.message || 'Could not send interest');
    },
  });

  if (!isOwner) {
    return (
      <NonOwnerDashboard
        accountType={context.user.accountType}
        contributorProfile={contributorProfile.data ?? null}
        investorProfile={investorProfile.data ?? null}
        recommendedProjects={recommendedProjects.data ?? []}
        savedProjects={savedProjects.data ?? []}
        interestHistory={interestHistory.data ?? []}
        isSavingContributorProfile={upsertContributorProfile.isPending}
        isSavingInvestorProfile={upsertInvestorProfile.isPending}
        isSendingInterest={expressInterest.isPending}
        onSaveContributorProfile={(input) => upsertContributorProfile.mutate(input)}
        onSaveInvestorProfile={(input) => upsertInvestorProfile.mutate(input)}
        onSendInterest={(projectId) =>
          expressInterest.mutate({
            projectId,
            type: context.user.accountType === 'investor' ? 'investment' : 'contribution',
            message:
              context.user.accountType === 'investor'
                ? 'Interested in learning more from the investor dashboard.'
                : 'Interested in contributing from the contributor dashboard.',
          })
        }
      >
        <AccountTypeSwitcher
          currentAccountType={context.user.accountType}
          ownedProjectCount={0}
          isPending={updateAccountType.isPending}
          onChange={(accountType, confirmOwnerProjectVisibility) =>
            updateAccountType.mutate({ accountType, confirmOwnerProjectVisibility })
          }
        />
      </NonOwnerDashboard>
    );
  }

  const ownerStatusCounts = {
    pending,
    approved,
    rejected,
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-3 md:grid-cols-3" aria-label="Project review summary">
        {ownerStatusCards.map((item) => (
          <OwnerStatusCard key={item.key} item={item} value={ownerStatusCounts[item.key]} />
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <InboundInterestPanel items={interestInbox.data ?? []} />
        <OwnerActionPanel projectCount={projects.length} />
      </div>

      <AccountTypeSwitcher
        currentAccountType={context.user.accountType}
        ownedProjectCount={projects.length}
        isPending={updateAccountType.isPending}
        onChange={(accountType, confirmOwnerProjectVisibility) =>
          updateAccountType.mutate({ accountType, confirmOwnerProjectVisibility })
        }
      />
    </div>
  );
}

type ContributorProfile = RouterOutputs['user']['getContributorProfile'];
type InvestorProfile = RouterOutputs['user']['getInvestorProfile'];
type RecommendedProject = RouterOutputs['projects']['getRecommendedProjects'][number];
type SavedProjectItem = RouterOutputs['projects']['getSavedProjects'][number];
type InterestHistoryItem = RouterOutputs['projects']['getMyProjectInterestHistory'][number];
type ContributorProfileInput = {
  skills: Array<(typeof projectTags)[number]>;
  interests: Array<(typeof projectTags)[number]>;
  githubHandle?: string;
  availability?: 'open' | 'part-time' | 'weekends' | 'advisory' | 'not-available';
  preferredProjectTypes: Array<(typeof projectTypes)[number]>;
};
type InvestorProfileInput = {
  thesis?: string;
  stages: Array<'active' | 'early-stage' | 'beta' | 'production-ready' | 'experimental'>;
  sectors: Array<(typeof projectTypes)[number]>;
  checkSize?: string;
  geography?: string;
  contactPreference?: string;
};

const availabilityOptions = [
  { value: 'open', label: 'Open' },
  { value: 'part-time', label: 'Part time' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'advisory', label: 'Advisory' },
  { value: 'not-available', label: 'Not available' },
] as const;
const investorStageOptions = [
  'active',
  'early-stage',
  'beta',
  'production-ready',
  'experimental',
] as const;
const ownerStatusCards = [
  {
    key: 'pending',
    label: 'Pending review',
    description: 'Waiting for admin review',
    tone: 'pending',
  },
  {
    key: 'approved',
    label: 'Approved public',
    description: 'Visible in discovery',
    tone: 'approved',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    description: 'Needs owner action',
    tone: 'rejected',
  },
] as const;

function NonOwnerDashboard({
  accountType,
  contributorProfile,
  investorProfile,
  recommendedProjects,
  savedProjects,
  interestHistory,
  isSavingContributorProfile,
  isSavingInvestorProfile,
  isSendingInterest,
  onSaveContributorProfile,
  onSaveInvestorProfile,
  onSendInterest,
  children,
}: {
  accountType: 'contributor' | 'investor' | 'owner' | null | undefined;
  contributorProfile: ContributorProfile | null;
  investorProfile: InvestorProfile | null;
  recommendedProjects: RecommendedProject[];
  savedProjects: SavedProjectItem[];
  interestHistory: InterestHistoryItem[];
  isSavingContributorProfile: boolean;
  isSavingInvestorProfile: boolean;
  isSendingInterest: boolean;
  onSaveContributorProfile: (input: ContributorProfileInput) => void;
  onSaveInvestorProfile: (input: InvestorProfileInput) => void;
  onSendInterest: (projectId: string) => void;
  children: ReactNode;
}) {
  const isInvestor = accountType === 'investor';
  const intentType = isInvestor ? 'investment' : 'contribution';
  const sentProjectIds = new Set(
    interestHistory
      .filter((item) => item.interest.type === intentType)
      .map((item) => item.project.id),
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <JourneyMetric
          icon={isInvestor ? CircleDollarSign : UserRound}
          label={isInvestor ? 'Investor profile' : 'Contributor profile'}
          value={isInvestor ? (investorProfile ? 'Ready' : 'Setup') : contributorProfile ? 'Ready' : 'Setup'}
        />
        <JourneyMetric
          icon={FolderOpen}
          label={isInvestor ? 'Recommended deals' : 'Recommended projects'}
          value={recommendedProjects.length.toString()}
        />
        <JourneyMetric icon={Bookmark} label={isInvestor ? 'Watchlist' : 'Saved'} value={savedProjects.length.toString()} />
      </div>

      {isInvestor ? (
        <InvestorProfileForm
          profile={investorProfile}
          isPending={isSavingInvestorProfile}
          onSave={onSaveInvestorProfile}
        />
      ) : (
        <ContributorProfileForm
          profile={contributorProfile}
          isPending={isSavingContributorProfile}
          onSave={onSaveContributorProfile}
        />
      )}

      <RecommendedProjectsPanel
        accountType={accountType === 'investor' ? 'investor' : 'contributor'}
        projects={recommendedProjects}
        sentProjectIds={sentProjectIds}
        isPending={isSendingInterest}
        onSendInterest={onSendInterest}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SavedProjectsPanel accountType={accountType === 'investor' ? 'investor' : 'contributor'} items={savedProjects} />
        <InterestHistoryPanel accountType={accountType === 'investor' ? 'investor' : 'contributor'} items={interestHistory} />
      </div>

      {children}
    </div>
  );
}

function JourneyMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FolderOpen;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-border p-5">
      <Icon className="mb-5 h-5 w-5" />
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-3 text-2xl font-medium">{value}</p>
    </div>
  );
}

function ContributorProfileForm({
  profile,
  isPending,
  onSave,
}: {
  profile: ContributorProfile | null;
  isPending: boolean;
  onSave: (input: ContributorProfileInput) => void;
}) {
  const [skills, setSkills] = useState<Array<(typeof projectTags)[number]>>([]);
  const [interests, setInterests] = useState<Array<(typeof projectTags)[number]>>([]);
  const [githubHandle, setGithubHandle] = useState('');
  const [availability, setAvailability] = useState<ContributorProfileInput['availability']>('open');
  const [preferredProjectTypes, setPreferredProjectTypes] = useState<
    Array<(typeof projectTypes)[number]>
  >([]);

  useEffect(() => {
    setSkills((profile?.skills ?? []) as Array<(typeof projectTags)[number]>);
    setInterests((profile?.interests ?? []) as Array<(typeof projectTags)[number]>);
    setGithubHandle(profile?.githubHandle ?? '');
    setAvailability((profile?.availability as ContributorProfileInput['availability']) ?? 'open');
    setPreferredProjectTypes(
      (profile?.preferredProjectTypes ?? []) as Array<(typeof projectTypes)[number]>,
    );
  }, [profile]);

  return (
    <section className="border border-border p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-medium">Contributor profile</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            Recommendations use your skills, interests, availability, and preferred project types.
          </p>
        </div>
        <Button
          type="button"
          className="rounded-none"
          disabled={isPending}
          onClick={() =>
            onSave({
              skills,
              interests,
              githubHandle,
              availability,
              preferredProjectTypes,
            })
          }
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save profile
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contributor-github">GitHub handle</Label>
          <Input
            id="contributor-github"
            value={githubHandle}
            onChange={(event) => setGithubHandle(event.target.value)}
            placeholder="your-handle"
            className="rounded-none"
          />
        </div>
        <div className="space-y-2">
          <Label>Availability</Label>
          <Select
            value={availability}
            onValueChange={(value) => setAvailability(value as ContributorProfileInput['availability'])}
          >
            <SelectTrigger className="w-full rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              {availabilityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="rounded-none">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TagToggleSection
        title="Skills"
        values={skills}
        options={projectTags}
        onChange={(nextValues) => setSkills(nextValues as Array<(typeof projectTags)[number]>)}
      />
      <TagToggleSection
        title="Interests"
        values={interests}
        options={projectTags}
        onChange={(nextValues) => setInterests(nextValues as Array<(typeof projectTags)[number]>)}
      />
      <TagToggleSection
        title="Preferred project types"
        values={preferredProjectTypes}
        options={projectTypes}
        onChange={(nextValues) =>
          setPreferredProjectTypes(nextValues as Array<(typeof projectTypes)[number]>)
        }
      />
    </section>
  );
}

function InvestorProfileForm({
  profile,
  isPending,
  onSave,
}: {
  profile: InvestorProfile | null;
  isPending: boolean;
  onSave: (input: InvestorProfileInput) => void;
}) {
  const [thesis, setThesis] = useState('');
  const [stages, setStages] = useState<InvestorProfileInput['stages']>([]);
  const [sectors, setSectors] = useState<Array<(typeof projectTypes)[number]>>([]);
  const [checkSize, setCheckSize] = useState('');
  const [geography, setGeography] = useState('');
  const [contactPreference, setContactPreference] = useState('');

  useEffect(() => {
    setThesis(profile?.thesis ?? '');
    setStages((profile?.stages ?? []) as InvestorProfileInput['stages']);
    setSectors((profile?.sectors ?? []) as Array<(typeof projectTypes)[number]>);
    setCheckSize(profile?.checkSize ?? '');
    setGeography(profile?.geography ?? '');
    setContactPreference(profile?.contactPreference ?? '');
  }, [profile]);

  return (
    <section className="border border-border p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-medium">Investor profile</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            Recommendations prioritize projects seeking investment that match your thesis, stage,
            and sector focus.
          </p>
        </div>
        <Button
          type="button"
          className="rounded-none"
          disabled={isPending}
          onClick={() =>
            onSave({
              thesis,
              stages,
              sectors,
              checkSize,
              geography,
              contactPreference,
            })
          }
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save profile
        </Button>
      </div>

      <div className="mt-5 space-y-2">
        <Label htmlFor="investor-thesis">Thesis</Label>
        <Textarea
          id="investor-thesis"
          value={thesis}
          onChange={(event) => setThesis(event.target.value)}
          placeholder="What kinds of open source projects are you looking for?"
          className="min-h-24 rounded-none"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="investor-check-size">Check size</Label>
          <Input
            id="investor-check-size"
            value={checkSize}
            onChange={(event) => setCheckSize(event.target.value)}
            placeholder="$10k - $100k"
            className="rounded-none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="investor-geography">Geography</Label>
          <Input
            id="investor-geography"
            value={geography}
            onChange={(event) => setGeography(event.target.value)}
            placeholder="Remote, US, Europe..."
            className="rounded-none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="investor-contact">Contact preference</Label>
          <Input
            id="investor-contact"
            value={contactPreference}
            onChange={(event) => setContactPreference(event.target.value)}
            placeholder="Email first, intro call..."
            className="rounded-none"
          />
        </div>
      </div>

      <TagToggleSection
        title="Preferred stages"
        values={stages}
        options={investorStageOptions}
        onChange={(nextValues) => setStages(nextValues as InvestorProfileInput['stages'])}
      />
      <TagToggleSection
        title="Sectors"
        values={sectors}
        options={projectTypes}
        onChange={(nextValues) => setSectors(nextValues as Array<(typeof projectTypes)[number]>)}
      />
    </section>
  );
}

function TagToggleSection({
  title,
  values,
  options,
  onChange,
}: {
  title: string;
  values: string[];
  options: readonly string[];
  onChange: (values: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  return (
    <div className="mt-5">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option} type="button" onClick={() => toggle(option)}>
            <Badge
              variant={values.includes(option) ? 'default' : 'outline'}
              className="rounded-none px-2.5 py-1 capitalize"
            >
              {option.replace('-', ' ')}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}

function RecommendedProjectsPanel({
  accountType,
  projects,
  sentProjectIds,
  isPending,
  onSendInterest,
}: {
  accountType: 'contributor' | 'investor';
  projects: RecommendedProject[];
  sentProjectIds: Set<string>;
  isPending: boolean;
  onSendInterest: (projectId: string) => void;
}) {
  const title = accountType === 'investor' ? 'Projects seeking investment' : 'Recommended projects';

  return (
    <section className="border border-border p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-medium">{title}</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Ranked from your profile preferences and live project opportunities.
          </p>
        </div>
        <Button variant="outline" className="rounded-none" asChild>
          <Link href={accountType === 'investor' ? '/projects?investors=true' : '/projects?contributors=true'}>
            Discover all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-muted-foreground mt-5 border border-dashed border-border p-4 text-sm">
          No matches yet. Update your profile or browse public discovery.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <ProjectRecommendationCard
              key={project.id}
              project={project}
              accountType={accountType}
              alreadySent={sentProjectIds.has(project.id)}
              isPending={isPending}
              onSendInterest={onSendInterest}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectRecommendationCard({
  project,
  accountType,
  alreadySent,
  isPending,
  onSendInterest,
}: {
  project: RecommendedProject;
  accountType: 'contributor' | 'investor';
  alreadySent: boolean;
  isPending: boolean;
  onSendInterest: (projectId: string) => void;
}) {
  return (
    <div className="border border-border p-4">
      <div className="flex items-start gap-3">
        <img
          src={project.logoUrl || project.githubStats?.ownerAvatarUrl || 'https://placehold.co/48x48'}
          alt={project.name}
          className="h-12 w-12 rounded-full border border-border"
        />
        <div className="min-w-0 flex-1">
          <Link href={`/projects/${project.id}`} className="font-medium hover:underline">
            {project.name}
          </Link>
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-6">
            {project.description}
          </p>
        </div>
      </div>
      <div className="text-muted-foreground mt-3 flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1">
          <Star className="h-3 w-3" />
          {(project.githubStats?.stargazersCount ?? 0).toLocaleString()}
        </span>
        <span className="capitalize">{project.type.replace('-', ' ')}</span>
        <span className="capitalize">{project.status.replace('-', ' ')}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        className="mt-4 w-full rounded-none"
        disabled={alreadySent || isPending}
        onClick={() => onSendInterest(project.id)}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {alreadySent
          ? accountType === 'investor'
            ? 'Interest sent'
            : 'Contribution intent sent'
          : accountType === 'investor'
            ? 'I am interested'
            : 'I want to contribute'}
      </Button>
    </div>
  );
}

function SavedProjectsPanel({
  accountType,
  items,
}: {
  accountType: 'contributor' | 'investor';
  items: SavedProjectItem[];
}) {
  return (
    <section className="border border-border p-5">
      <h2 className="text-xl font-medium">{accountType === 'investor' ? 'Watchlist' : 'Saved projects'}</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        Projects you saved from public discovery.
      </p>
      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <div className="text-muted-foreground border border-dashed border-border p-4 text-sm">
            No saved projects yet.
          </div>
        ) : (
          items.slice(0, 6).map((item) => <ProjectMiniRow key={item.project.id} project={item.project} />)
        )}
      </div>
    </section>
  );
}

function InterestHistoryPanel({
  accountType,
  items,
}: {
  accountType: 'contributor' | 'investor';
  items: InterestHistoryItem[];
}) {
  const filteredItems = items.filter((item) =>
    accountType === 'investor'
      ? item.interest.type === 'investment'
      : item.interest.type === 'contribution' || item.interest.type === 'contact',
  );

  return (
    <section className="border border-border p-5">
      <h2 className="text-xl font-medium">
        {accountType === 'investor' ? 'Investor interest history' : 'Contacted and applied'}
      </h2>
      <p className="text-muted-foreground mt-2 text-sm">
        Sent intents are visible to the project owner.
      </p>
      <div className="mt-5 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-muted-foreground border border-dashed border-border p-4 text-sm">
            No sent interest yet.
          </div>
        ) : (
          filteredItems.slice(0, 6).map((item) => (
            <div key={item.interest.id} className="border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-none capitalize">
                  {item.interest.type}
                </Badge>
                <Link href={`/projects/${item.project.id}`} className="font-medium hover:underline">
                  {item.project.name}
                </Link>
              </div>
              {item.interest.message && (
                <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-6">
                  {item.interest.message}
                </p>
              )}
              <p className="text-muted-foreground mt-2 text-xs">
                Sent {new Date(item.interest.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ProjectMiniRow({ project }: { project: Project }) {
  return (
    <div className="flex items-center gap-3 border border-border p-3">
      <img
        src={project.logoUrl || project.githubStats?.ownerAvatarUrl || 'https://placehold.co/40x40'}
        alt={project.name}
        className="h-10 w-10 rounded-full border border-border"
      />
      <div className="min-w-0 flex-1">
        <Link href={`/projects/${project.id}`} className="truncate font-medium hover:underline">
          {project.name}
        </Link>
        <p className="text-muted-foreground truncate text-sm">{project.gitRepoUrl}</p>
      </div>
    </div>
  );
}

type InboundInterestItem = RouterOutputs['projects']['getMyProjectInterestInbox'][number];

function OwnerStatusCard({
  item,
  value,
}: {
  item: (typeof ownerStatusCards)[number];
  value: number;
}) {
  return (
    <div className="flex min-h-28 flex-col justify-between border border-border/70 bg-card/50 p-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <StatusDot tone={item.tone} />
          <p className="text-muted-foreground text-sm font-medium">{item.label}</p>
        </div>
        <p className="text-muted-foreground text-xs">{item.description}</p>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function OwnerActionPanel({ projectCount }: { projectCount: number }) {
  return (
    <section className="border border-border/70 bg-card/40 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-medium">Submit a project</h2>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            Add another repository and send it through review.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <Button className="w-full rounded-none" asChild>
          <Link href="/dashboard/projects/new">
            <Plus className="h-4 w-4" />
            New project
          </Link>
        </Button>
        <Button variant="outline" className="w-full rounded-none" asChild>
          <Link href="/dashboard/projects">
            View my projects
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="mt-5 border-t border-border/70 pt-4">
        <p className="text-muted-foreground text-xs">Owned projects</p>
        <p className="mt-1 text-2xl font-medium">{projectCount}</p>
      </div>
    </section>
  );
}

function InboundInterestPanel({ items }: { items: InboundInterestItem[] }) {
  return (
    <section className="border border-border/70 bg-card/40 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-medium">Inbound interest</h2>
          </div>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Contributor, investor, and maintainer leads from public project pages.
          </p>
        </div>
        <Badge variant="outline" className="min-w-8 rounded-none px-2 py-1">
          {items.length}
        </Badge>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground mt-5 bg-muted/20 px-4 py-4 text-sm">
          No inbound interest yet.
        </p>
      ) : (
        <div className="mt-5 divide-y divide-border/70 border border-border/70">
          {items.slice(0, 5).map((item) => (
            <div
              key={item.interest.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-none px-2 py-1 capitalize">
                    {item.interest.type}
                  </Badge>
                  <p className="font-medium">{item.project.name}</p>
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  {item.user.name} · {item.user.email}
                </p>
                {item.interest.message && (
                  <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-6">
                    {item.interest.message}
                  </p>
                )}
              </div>
              <p className="text-muted-foreground shrink-0 text-xs">
                {formatDashboardDate(item.interest.createdAt)}
              </p>
            </div>
          ))}
          {items.length > 5 && (
            <p className="text-muted-foreground px-4 py-3 text-sm">
              Showing 5 latest leads. Full lead management is tracked for the next dashboard batch.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function StatusDot({ tone }: { tone: (typeof ownerStatusCards)[number]['tone'] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'size-2 rounded-full',
        tone === 'pending' && 'bg-amber-300',
        tone === 'approved' && 'bg-emerald-300',
        tone === 'rejected' && 'bg-rose-300',
      )}
    />
  );
}

function formatDashboardDate(value: string | Date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function AccountTypeSwitcher({
  currentAccountType,
  ownedProjectCount,
  isPending,
  onChange,
}: {
  currentAccountType: 'owner' | 'contributor' | 'investor' | null | undefined;
  ownedProjectCount: number;
  isPending: boolean;
  onChange: (
    accountType: 'owner' | 'contributor' | 'investor',
    confirmOwnerProjectVisibility?: boolean,
  ) => void;
}) {
  const [accountTypeToConfirm, setAccountTypeToConfirm] = useState<
    'contributor' | 'investor' | null
  >(null);

  function requestAccountTypeChange(accountType: 'owner' | 'contributor' | 'investor') {
    if (
      currentAccountType === 'owner' &&
      accountType !== 'owner' &&
      ownedProjectCount > 0
    ) {
      setAccountTypeToConfirm(accountType);
      return;
    }

    onChange(accountType);
  }

  return (
    <div className="border border-border p-5">
      <h2 className="text-xl font-medium">Account type</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        oss.now uses one primary account type at a time. Switching changes dashboard experience only;
        roles, admin permissions, and owned project records stay intact.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {accountTypes.map((accountType) => (
          <Button
            key={accountType}
            type="button"
            variant={currentAccountType === accountType ? 'default' : 'outline'}
            className="rounded-none capitalize"
            disabled={isPending || currentAccountType === accountType}
            onClick={() => requestAccountTypeChange(accountType)}
          >
            {accountType}
          </Button>
        ))}
      </div>
      <Dialog
        open={Boolean(accountTypeToConfirm)}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setAccountTypeToConfirm(null);
          }
        }}
      >
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Switch away from owner?</DialogTitle>
            <DialogDescription>
              You have {ownedProjectCount} owner project{ownedProjectCount === 1 ? '' : 's'}.
              Switching to {accountTypeToConfirm} hides project management until you switch back,
              but the projects remain attached to your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={isPending}
              onClick={() => setAccountTypeToConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-none"
              disabled={isPending || !accountTypeToConfirm}
              onClick={() => {
                if (accountTypeToConfirm) {
                  onChange(accountTypeToConfirm, true);
                }
              }}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
