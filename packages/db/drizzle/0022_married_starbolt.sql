CREATE TYPE "public"."contrib_period" AS ENUM('all_time', 'last_30d', 'last_365d');--> statement-breakpoint
CREATE TYPE "public"."contrib_provider" AS ENUM('github', 'gitlab');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('launch_scheduled', 'launch_live', 'comment_received');--> statement-breakpoint
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
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contrib_rollups_user_period_uidx" ON "contrib_rollups" USING btree ("user_id","period");--> statement-breakpoint
CREATE INDEX "contrib_rollups_period_idx" ON "contrib_rollups" USING btree ("period");--> statement-breakpoint
CREATE INDEX "contrib_rollups_user_idx" ON "contrib_rollups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_user_id_idx" ON "notification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_read_idx" ON "notification" USING btree ("read");--> statement-breakpoint
CREATE INDEX "notification_type_idx" ON "notification" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notification_created_at_idx" ON "notification" USING btree ("created_at" DESC NULLS LAST);