import Icons from '@workspace/ui/components/icons';
import { projectProviderEnum } from '@workspace/db/schema';

export const providers = [
  {
    name: 'Github',
    icon: Icons.github,
    providerId: 'github' as const,
  },
  {
    name: 'Gitlab',
    icon: Icons.gitlab,
    providerId: 'gitlab' as const,
  },
];

export type ProviderId = (typeof providers)[number]['providerId'];

export const isValidProvider = (
  provider: string | null | undefined,
): provider is (typeof projectProviderEnum.enumValues)[number] => {
  return provider === 'github' || provider === 'gitlab';
};

export interface RepoContent {
  content: string;
  encoding: 'base64' | 'utf8';
}
