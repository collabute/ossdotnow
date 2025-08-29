#!/usr/bin/env bun
import { drizzle } from 'drizzle-orm/postgres-js';
import { inArray } from 'drizzle-orm';

import { user as userTable, account as accountTable } from '../packages/db/src/schema/auth';
import { setUserMetaFromProviders } from '../packages/api/src/leaderboard/useMeta';
import { redis } from '../packages/api/src/redis/client';

const GH = 'github';
const GL = 'gitlab';
const USER_SET = 'lb:users';
const META = (id: string) => `lb:user:${id}`;

async function getPostgres() {
  const mod = (await import('postgres')) as any;
  return (mod.default ?? mod) as (url: string, opts?: any) => any;
}

async function makeDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Missing DATABASE_URL');

  const postgres = await getPostgres();
  const needsSSL = /neon\.tech/i.test(url) || /sslmode=require/i.test(url);
  const pg = postgres(url, needsSSL ? { ssl: 'require' as const } : {});
  const db = drizzle(pg);
  return { db, pg };
}

function asStr(x: unknown): string | undefined {
  if (x == null) return undefined;
  if (typeof x === 'string') return x.trim() || undefined;
  return String(x).trim() || undefined;
}

async function main() {
  const { db, pg } = await makeDb();
  try {
    const users = await db
      .select({ userId: userTable.id, username: userTable.username })
      .from(userTable);

    const userIds = Array.from(new Set(users.map((u) => u.userId)));
    console.log(`Found ${userIds.length} users`);

    if (userIds.length === 0) return;

    const usernameByUserId = new Map<string, string | undefined>();
    for (const u of users) {
      usernameByUserId.set(u.userId, asStr(u.username));
    }

    const links = await db
      .select({
        userId: accountTable.userId,
        providerId: accountTable.providerId,
      })
      .from(accountTable)
      .where(inArray(accountTable.userId, userIds));

    const map = new Map<string, { gh?: string; gl?: string }>();
    for (const id of userIds) map.set(id, {});

    for (const l of links) {
      const m = map.get(l.userId)!;
      const uname = usernameByUserId.get(l.userId);
      if (!uname) continue;

      if (l.providerId === GH && !m.gh) m.gh = uname;
      if (l.providerId === GL && !m.gl) m.gl = uname;
    }

    const BATCH = 100;
    let done = 0;

    for (let i = 0; i < userIds.length; i += BATCH) {
      const chunk = userIds.slice(i, i + BATCH);

      await Promise.all(
        chunk.map(async (id) => {
          const { gh, gl } = map.get(id)!;
          await setUserMetaFromProviders(id, gh, gl);

          const meta = await redis.hgetall(META(id));
        }),
      );

      done += chunk.length;
      console.log(`Seeded ${done}/${userIds.length}`);
    }

    const count = await redis.scard(USER_SET);
    console.log(`✅ Redis set "${USER_SET}" now has ${count} members`);
  } finally {
    if (typeof (pg as any)?.end === 'function') {
      await (pg as any).end({ timeout: 5 }).catch(() => {});
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
