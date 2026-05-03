import Icons from '@/components/ui/icons';

export const providers = [
  {
    name: 'GitHub',
    icon: Icons.github,
    providerId: 'github' as const,
  },
];

export type ProviderId = (typeof providers)[number]['providerId'];
