export const projectApprovalStatuses = ['pending', 'approved', 'rejected'] as const;

export const projectStatuses = [
  'active',
  'inactive',
  'early-stage',
  'beta',
  'production-ready',
  'experimental',
  'cancelled',
  'paused',
] as const;

export const projectTypes = [
  'fintech',
  'healthtech',
  'edtech',
  'ecommerce',
  'productivity',
  'social',
  'entertainment',
  'developer-tools',
  'content-management',
  'analytics',
  'other',
] as const;

export const projectTags = [
  'web',
  'mobile',
  'desktop',
  'backend',
  'frontend',
  'fullstack',
  'ai',
  'game',
  'crypto',
  'nft',
  'social',
  'other',
  'dapp',
  'saas',
  'algorithm',
  'data-analysis',
  'game-engine',
] as const;

export const userRoles = ['admin', 'user', 'moderator'] as const;
export const accountTypes = ['owner', 'contributor', 'investor'] as const;
