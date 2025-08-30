export type Project = {
  id: string;
  name: string;
  description: string | null;
  gitRepoUrl: string;
  gitHost: string;
  logoUrl: string | null;
  approvalStatus: string;
  status: { name: string } | null;
  type: { name: string } | null;
  tagRelations: Array<{ tag: { name: string } | null }>;
  socialLinks: {
    twitter: string | null;
    discord: string | null;
    linkedin: string | null;
    website: string | null;
  } | null;
  isLookingForContributors: boolean;
  isLookingForInvestors: boolean;
  isHiring: boolean;
  isPublic: boolean;
  hasBeenAcquired: boolean;
  isPinned: boolean;
  isRepoPrivate: boolean;
};

export interface GitHubRepoData {
  id: string | number;
  name: string;
  description?: string;
  url: string;
  isPrivate?: boolean;
  stargazers_count?: number;
  star_count?: number;
  forks_count?: number;
  created_at?: string;
  owner?: {
    login?: string;
    name?: string;
    type?: string;
    avatar_url?: string;
  };
  namespace?: {
    name?: string;
    avatar_url?: string;
  };
  html_url?: string;
  web_url?: string;
}
export interface DatabaseProject {
  id: string;
  ownerId: string | null;
  logoUrl: string | null;
  gitRepoUrl: string;
  gitHost: 'github' | 'gitlab' | null;
  repoId: string;
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
  statusId: string;
  typeId: string;
  isLookingForContributors: boolean;
  isLookingForInvestors: boolean;
  isHiring: boolean;
  isPublic: boolean;
  hasBeenAcquired: boolean;
  isPinned: boolean;
  isRepoPrivate: boolean;
  acquiredBy: string | null;
  starsCount: number;
  starsUpdatedAt: Date | null;
  forksCount: number;
  forksUpdatedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  status?: {
    id: string;
    name: string;
  } | null;
  type?: {
    id: string;
    name: string;
  } | null;
  tagRelations?: Array<{
    tag?: {
      id: string;
      name: string;
    } | null;
  }>;
}

export interface ProjectWithGithubData extends DatabaseProject {
  githubData?: GitHubRepoData | null;
  stars: number;
  forks: number;
  lastCommit: string;
  language: string | null;
  openIssues: number;
  topics: string[];
}

// Type guard function to verify that data conforms to Project type
export function isProject(data: unknown): data is Project {
  if (!data || typeof data !== 'object') return false;

  const project = data as Record<string, unknown>;

  return (
    typeof project.id === 'string' &&
    typeof project.name === 'string' &&
    (project.description === null || typeof project.description === 'string') &&
    typeof project.gitRepoUrl === 'string' &&
    typeof project.gitHost === 'string' &&
    (project.logoUrl === null || typeof project.logoUrl === 'string') &&
    typeof project.approvalStatus === 'string' &&
    (project.status === null ||
      (typeof project.status === 'object' &&
        project.status !== null &&
        typeof (project.status as Record<string, unknown>).name === 'string')) &&
    (project.type === null ||
      (typeof project.type === 'object' &&
        project.type !== null &&
        typeof (project.type as Record<string, unknown>).name === 'string')) &&
    Array.isArray(project.tagRelations) &&
    project.tagRelations.every(
      (relation) =>
        relation &&
        typeof relation === 'object' &&
        (relation.tag === null ||
          (typeof relation.tag === 'object' &&
            relation.tag !== null &&
            typeof relation.tag.name === 'string')),
    ) &&
    (project.socialLinks === null ||
      (typeof project.socialLinks === 'object' &&
        project.socialLinks !== null &&
        ['twitter', 'discord', 'linkedin', 'website'].every(
          (key) =>
            project.socialLinks![key as keyof typeof project.socialLinks] === null ||
            typeof project.socialLinks![key as keyof typeof project.socialLinks] === 'string',
        ))) &&
    typeof project.isLookingForContributors === 'boolean' &&
    typeof project.isLookingForInvestors === 'boolean' &&
    typeof project.isHiring === 'boolean' &&
    typeof project.isPublic === 'boolean' &&
    typeof project.hasBeenAcquired === 'boolean' &&
    typeof project.isPinned === 'boolean' &&
    typeof project.isRepoPrivate === 'boolean'
  );
}
// Type guard function to verify that data conforms to DatabaseProject type
export function isDatabaseProject(data: unknown): data is DatabaseProject {
  if (!data || typeof data !== 'object') return false;

  const project = data as Record<string, unknown>;

  return (
    typeof project.id === 'string' &&
    typeof project.name === 'string' &&
    (project.description === null || typeof project.description === 'string') &&
    typeof project.gitRepoUrl === 'string' &&
    (project.gitHost === null || project.gitHost === 'github' || project.gitHost === 'gitlab') &&
    typeof project.repoId === 'string' &&
    (project.logoUrl === null || typeof project.logoUrl === 'string') &&
    typeof project.approvalStatus === 'string' &&
    typeof project.isLookingForContributors === 'boolean' &&
    typeof project.isLookingForInvestors === 'boolean' &&
    typeof project.isHiring === 'boolean' &&
    typeof project.isPublic === 'boolean' &&
    typeof project.hasBeenAcquired === 'boolean' &&
    typeof project.isPinned === 'boolean' &&
    typeof project.isRepoPrivate === 'boolean' &&
    typeof project.starsCount === 'number' &&
    (project.starsUpdatedAt === null || project.starsUpdatedAt instanceof Date) &&
    typeof project.forksCount === 'number' &&
    (project.forksUpdatedAt === null || project.forksUpdatedAt instanceof Date) &&
    project.createdAt instanceof Date &&
    project.updatedAt instanceof Date &&
    (project.status === null ||
      project.status === undefined ||
      (typeof project.status === 'object' &&
        project.status !== null &&
        typeof (project.status as Record<string, unknown>).id === 'string' &&
        typeof (project.status as Record<string, unknown>).name === 'string')) &&
    (project.type === null ||
      project.type === undefined ||
      (typeof project.type === 'object' &&
        project.type !== null &&
        typeof (project.type as Record<string, unknown>).id === 'string' &&
        typeof (project.type as Record<string, unknown>).name === 'string')) &&
    (project.tagRelations === undefined ||
      (Array.isArray(project.tagRelations) &&
        project.tagRelations.every(
          (rel) =>
            rel &&
            typeof rel === 'object' &&
            (rel.tag === null ||
              rel.tag === undefined ||
              (typeof rel.tag === 'object' &&
                rel.tag !== null &&
                typeof (rel.tag as Record<string, unknown>).id === 'string' &&
                typeof (rel.tag as Record<string, unknown>).name === 'string')),
        ))) &&
    (project.socialLinks === null ||
      (typeof project.socialLinks === 'object' && project.socialLinks !== null))
  );
}

// Type guard function to verify that data conforms to ProjectWithGithubData type
export function isProjectWithGithubData(data: unknown): data is ProjectWithGithubData {
  if (!isDatabaseProject(data)) return false;

  const project = data as unknown as Record<string, unknown>;

  return (
    typeof project.stars === 'number' &&
    typeof project.forks === 'number' &&
    typeof project.lastCommit === 'string' &&
    (project.language === null || typeof project.language === 'string') &&
    typeof project.openIssues === 'number' &&
    Array.isArray(project.topics) &&
    (project.githubData === null ||
      project.githubData === undefined ||
      (typeof project.githubData === 'object' && project.githubData !== null))
  );
}
