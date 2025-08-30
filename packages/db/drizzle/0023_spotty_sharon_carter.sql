DROP INDEX "project_comment_like_unique_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "project_comment_like_unique_idx" ON "project_comment_like" USING btree ("comment_id","user_id");