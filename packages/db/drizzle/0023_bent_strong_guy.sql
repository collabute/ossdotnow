CREATE TYPE "public"."contrib_period" AS ENUM('all_time', 'last_30d', 'last_365d');--> statement-breakpoint
CREATE TABLE "contrib_rollups" (
	"user_id" text NOT NULL,
	"period" "contrib_period" NOT NULL,
	"commits" integer DEFAULT 0 NOT NULL,
	"prs" integer DEFAULT 0 NOT NULL,
	"issues" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "contrib_daily" CASCADE;--> statement-breakpoint
DROP TABLE "contrib_totals" CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "contrib_rollups_user_period_uidx" ON "contrib_rollups" USING btree ("user_id","period");--> statement-breakpoint
CREATE INDEX "contrib_rollups_period_idx" ON "contrib_rollups" USING btree ("period");--> statement-breakpoint
CREATE INDEX "contrib_rollups_user_idx" ON "contrib_rollups" USING btree ("user_id");