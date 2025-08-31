import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { secondaryStorage } from './secondary-storage';
import { account } from '@workspace/db/schema';
import { env } from '@workspace/env/server';
import { admin } from 'better-auth/plugins';
import { betterAuth } from 'better-auth';
import { db } from '@workspace/db';
import 'server-only';

import { setUserMetaFromProviders } from '@workspace/api/leaderboard/use-meta';
import { setUserMeta } from '@workspace/api/leaderboard/meta';
import { createAuthMiddleware } from 'better-auth/api';
import { eq } from 'drizzle-orm';

const ORIGIN =
  env.VERCEL_ENV === 'production'
    ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
    : `http://${env.VERCEL_PROJECT_PRODUCTION_URL || 'localhost:3000'}`;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  secondaryStorage: secondaryStorage(),
  plugins: [
    admin({
      adminRoles: ['admin', 'moderator'],
    }),
  ],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const session = ctx.context.newSession;
      if (!session) return;

      const userId = session.user.id;
      const username = session.user?.username as string | undefined;
      const avatar: string | null | undefined = session.user?.image ?? null;

      const newAccount = ctx?.context?.newAccount as
        | {
            providerId?: string; // 'github' | 'gitlab'
            accountId?: string; // handle (sometimes numeric id depending on provider)
            userId?: string;
            accessToken?: string;
          }
        | undefined;

      async function githubIdToLogin(id: string): Promise<string | undefined> {
        try {
          const res = await fetch(`https://api.github.com/user/${id}`, {
            headers: {
              'User-Agent': 'ossdotnow',
              Accept: 'application/vnd.github+json',
              ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
            },
          });
          if (!res.ok) return undefined;
          const j = await res.json().catch(() => null);
          return (j && typeof j.login === 'string' && j.login) || undefined;
        } catch {
          return undefined;
        }
      }

      let githubLogin: string | undefined;
      let gitlabUsername: string | undefined;

      if (newAccount?.providerId === 'github') {
        githubLogin = session.user?.username;
      } else if (newAccount?.providerId === 'gitlab') {
        gitlabUsername = session.user?.username;
      }

      try {
        await setUserMeta(
          userId,
          {
            username,
            avatar,
            githubLogin,
            gitlabUsername,
          },
          { seedLeaderboards: false },
        );
      } catch (e) {
        console.error('[auth] setUserMeta failed:', e);
      }

      if (!githubLogin && !gitlabUsername) {
        const links = await db
          .select({ providerId: account.providerId, accountId: account.accountId })
          .from(account)
          .where(eq(account.userId, userId));

        for (const l of links) {
          if (!githubLogin && l.providerId === 'github' && l.accountId) {
            const raw = l.accountId.trim();
            githubLogin = /^\d+$/.test(raw) ? await githubIdToLogin(raw) : raw;
          }
          if (!gitlabUsername && l.providerId === 'gitlab' && l.accountId) {
            gitlabUsername = l.accountId.trim();
          }
        }
      }

      try {
        if (githubLogin || gitlabUsername) {
          await setUserMetaFromProviders(userId, githubLogin, gitlabUsername);
        }
      } catch (e) {
        console.error('[auth] setUserMetaFromProviders failed:', e);
      }

      function backfill(body: unknown, label: string) {
        return fetch(`${ORIGIN}/api/internal/leaderboard/backfill`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${env.CRON_SECRET}`,
          },
          body: JSON.stringify(body),
        })
          .then(async (r) => {
            const text = await r.text().catch(() => '');
            console.log(`[auth] backfill ${label} ->`, r.status, text.slice(0, 200));
            return { ok: r.ok, status: r.status };
          })
          .catch((e) => {
            console.warn(`[auth] backfill ${label} fetch failed:`, e);
            return { ok: false, status: 0 };
          });
      }

      if (githubLogin || gitlabUsername) {
        const body = { userId, githubLogin, gitlabUsername };

        void backfill(body, 'rollups').then(async (res) => {
          if (res.status === 409) {
            setTimeout(() => {
              void backfill(body, 'rollups retry');
            }, 60_000);
          }
        });
      }
    }),
  },

  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      scope: ['user', 'repo'],
      mapProfileToUser: async (profile) => {
        return {
          username: profile.login,
          image: profile.avatar_url,
        };
      },
    },
    gitlab: {
      clientId: env.GITLAB_CLIENT_ID,
      clientSecret: env.GITLAB_CLIENT_SECRET,
      issuer: env.GITLAB_ISSUER,
      scope: ['api', 'read_api', 'read_user', 'read_repository', 'openid', 'profile', 'email'],
      mapProfileToUser: async (profile) => {
        return {
          username: profile.username,
          image: profile.avatar_url,
        };
      },
      overrideUserInfoOnSignIn: true,
    },
  },
  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: true,
      },
      image: {
        type: 'string',
        required: true,
      },
    },
  },
  customPaths: {},
});

export type Session = typeof auth.$Infer.Session;
