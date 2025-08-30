import { project } from '@workspace/db/schema';

type RestEndpointMethodTypes = any;

export interface ProjectData {
  id: string | number;
  name: string;
  description?: string;
  url: string;
  // for GitHub repos
  owner?: {
    login?: string;
    name?: string;
    type?: string;
    avatar_url?: string;
  };
  // for GitLab repos
  namespace?: {
    name?: string;
    avatar_url?: string;
  };
  html_url?: string; // github URL
  web_url?: string; // gitlab URL
  [key: string]: any;
}
export interface ProjectWithRelations {
  id: string;
  ownerId: string | null;
  logoUrl: string | null;
  gitRepoUrl: string;
  gitHost: 'github' | 'gitlab' | null;
  name: string;
  description: string | null;
  socialLinks: {
    twitter?: string;
    discord?: string;
    linkedin?: string;
    website?: string;
    [key: string]: string | undefined;
  } | null;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  isPinned: boolean;
  hasBeenAcquired: boolean;
  isLookingForContributors: boolean;
  isLookingForInvestors: boolean;
  isHiring: boolean;
  isPublic: boolean;
  isRepoPrivate: boolean;
  acquiredBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  statusId: string;
  typeId: string;
  deletedAt: Date | null;
  status?: {
    id: string;
    name: string;
    displayName?: string;
  };
  type?: {
    id: string;
    name: string;
    displayName?: string;
  };
  tagRelations?: Array<{
    tag?: {
      id: string;
      name: string;
      displayName?: string;
    };
  }>;
}

export interface RepoData {
  id: string | number;
  name: string;
  description?: string;
  url: string;
  isPrivate?: boolean;
  [key: string]: any;
}

export interface ContributorData {
  id: string | number;
  username: string;
  avatarUrl?: string;
  pullRequestsCount?: number;
}

export interface IssueData {
  id: string | number;
  title: string;
  state: string;
  url: string;
  [key: string]: any;
}

export interface PullRequestData {
  id: string | number;
  title: string;
  state: string;
  url: string;
  [key: string]: any;
}

export interface FileData {
  content: string;
  encoding: 'base64' | 'utf8';
  name: string;
  path: string;
  size: number;
  download_url?: string;
  html_url?: string;
}

export interface UnSubmittedRepo {
  name: string;
  repoUrl: string;
  stars: number;
  forks: number;
  isOwner: boolean;
  description?: string | null;
  gitHost: 'github' | 'gitlab';
  owner: {
    avatar_url: string;
  };
  created_at: string;
}

export type ReadmeData = FileData;
export type ContributingData = FileData;
export type CodeOfConductData = FileData;

export interface UserPullRequestData extends PullRequestData {
  repository: {
    nameWithOwner: string;
    url: string;
    isPrivate?: boolean;
    owner?: {
      login: string;
    };
    stargazersCount?: number;
    forksCount?: number;
    primaryLanguage?: {
      name: string;
      color?: string;
    };
  };
  createdAt: string;
  updatedAt?: string;
  mergedAt?: string;
  closedAt?: string;
  isDraft?: boolean;
  headRefName?: string;
  baseRefName?: string;
  number: number;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  commentCount?: number;
  reviewCount?: number;
  labels?: Array<{
    name: string;
    color?: string;
  }>;
}

export interface UserData {
  provider: 'github' | 'gitlab';
  login: string;
  id: string | number;
  avatarUrl?: string;
  name?: string;
  company?: string;
  blog?: string;
  location?: string;
  email?: string;
  bio?: string;
  publicRepos?: number;
  publicGists?: number;
  followers?: number;
  following?: number;
  createdAt?: string;
  updatedAt?: string;
  htmlUrl?: string;
}

export type GitManagerConfig = {
  token: string;
};

export interface ContributionDay {
  date: string;
  contributionCount: number;
  contributionLevel:
    | 'NONE'
    | 'FIRST_QUARTILE'
    | 'SECOND_QUARTILE'
    | 'THIRD_QUARTILE'
    | 'FOURTH_QUARTILE';
  color: string;
}

export interface ContributionData {
  totalContributions: number;
  days: ContributionDay[];
}

export interface GitManager {
  getRepo(identifier: string): Promise<RepoData>;
  getContributors(identifier: string): Promise<ContributorData[]>;
  getIssues(identifier: string): Promise<IssueData[]>;
  getPullRequests(identifier: string): Promise<PullRequestData[]>;
  getIssuesCount(identifier: string): Promise<number>;
  getPullRequestsCount(identifier: string): Promise<number>;
  getReadme(identifier: string): Promise<ReadmeData>;
  getContributing(identifier: string): Promise<ContributingData>;
  getCodeOfConduct(identifier: string): Promise<CodeOfConductData>;
  getUserPullRequests(
    username: string,
    options?: {
      state?: 'open' | 'closed' | 'merged' | 'all';
      limit?: number;
    },
  ): Promise<UserPullRequestData[]>;
  getRepoData(identifier: string): Promise<{
    repo: RepoData;
    contributors: ContributorData[];
    issuesCount: number;
    pullRequestsCount: number;
  }>;
  verifyOwnership(
    identifier: string,
    ctx: any,
    projectId: string,
  ): Promise<{
    success: boolean;
    project: typeof project.$inferSelect;
    ownershipType: string;
    verifiedAs: string;
  }>;
  getRepoPermissions(
    identifier: string,
  ): Promise<
    RestEndpointMethodTypes['repos']['getCollaboratorPermissionLevel']['response']['data']
  >;
  getCurrentUser(): Promise<{
    id: string;
    username: string;
  }>;
  getOrgMembership(
    org: string,
    username: string,
  ): Promise<RestEndpointMethodTypes['orgs']['getMembershipForUser']['response']['data']>;
  getContributions(username: string): Promise<ContributionData>;
  getUserDetails(username: string): Promise<UserData>;
  getUnsubmittedRepos(ctx: any, username: string, userId: string): Promise<UnSubmittedRepo[]>;
  updateRepoIds(ctx: { db: any }): Promise<{ updated: number; failed: number; skipped: number }>;
}
