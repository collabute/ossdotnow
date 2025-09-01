import {
  pgEnum,
  pgTable,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const contribProvider = pgEnum("contrib_provider", ["github", "gitlab"]);

export const contribPeriod = pgEnum("contrib_period", [
  "all_time",
  "last_30d",
  "last_365d",
]);

export const contribRollups = pgTable(
  "contrib_rollups",
  {
    userId: text("user_id").notNull(),

    period: contribPeriod("period").notNull(),

    commits: integer("commits").notNull().default(0),
    prs: integer("prs").notNull().default(0),
    issues: integer("issues").notNull().default(0),
    total: integer("total").notNull().default(0),

    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("contrib_rollups_user_period_uidx").on(t.userId, t.period),
    index("contrib_rollups_period_idx").on(t.period),
    index("contrib_rollups_user_idx").on(t.userId),
  ],
);
