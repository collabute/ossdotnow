import { setUserMeta } from "@workspace/api/leaderboard/meta";
import { syncUserLeaderboards } from "@workspace/api/leaderboard/redis";
import { db } from "@workspace/db";

export async function onUserCreated(userId: string) {
  await setUserMeta(userId, {}, { seedLeaderboards: true });
  await syncUserLeaderboards(db, userId);
}

export async function onAccountLinked(args: {
  userId: string;
  provider: "github" | "gitlab";
  profile?: Record<string, unknown> | null;
}) {
  const { userId, provider, profile } = args;

  if (provider === "github") {
    const login =
      (profile?.["login"] as string) ||
      (profile?.["username"] as string) ||
      undefined;

    if (login) {
      await setUserMeta(userId, { githubLogin: login }, { seedLeaderboards: true });
      await syncUserLeaderboards(db, userId);
    }
  }

  if (provider === "gitlab") {
    const username =
      (profile?.["username"] as string) ||
      (profile?.["preferred_username"] as string) ||
      undefined;

    if (username) {
      await setUserMeta(userId, { gitlabUsername: username }, { seedLeaderboards: true });
      await syncUserLeaderboards(db, userId);
    }
  }
}
