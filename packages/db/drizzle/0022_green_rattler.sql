CREATE TABLE "project_comment_like" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_comment_like" ADD CONSTRAINT "project_comment_like_comment_id_project_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."project_comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comment_like" ADD CONSTRAINT "project_comment_like_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_comment_like_comment_id_idx" ON "project_comment_like" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "project_comment_like_user_id_idx" ON "project_comment_like" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_comment_like_unique_idx" ON "project_comment_like" USING btree ("comment_id","user_id");
