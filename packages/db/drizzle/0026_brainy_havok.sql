CREATE TYPE "public"."endorsement_type" AS ENUM('project', 'work', 'general');--> statement-breakpoint
CREATE TABLE "endorsement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endorser_id" text NOT NULL,
	"endorsed_user_id" text NOT NULL,
	"project_id" uuid,
	"project_name" text,
	"type" "endorsement_type" NOT NULL,
	"content" text NOT NULL,
	"work_details" jsonb,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "endorsement" ADD CONSTRAINT "endorsement_endorser_id_user_id_fk" FOREIGN KEY ("endorser_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endorsement" ADD CONSTRAINT "endorsement_endorsed_user_id_user_id_fk" FOREIGN KEY ("endorsed_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endorsement" ADD CONSTRAINT "endorsement_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;