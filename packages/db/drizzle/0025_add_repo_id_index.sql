-- Add an index for better repo_id query performance
CREATE INDEX IF NOT EXISTS "project_repo_id_idx" ON "project" ("repo_id");
