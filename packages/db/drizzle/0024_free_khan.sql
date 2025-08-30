-- First, add the column without NOT NULL constraint
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "repo_id" text;

-- Set default values for existing records based on git_host and git_repo_url
UPDATE "project"
SET "repo_id" =
  CASE
    WHEN "git_host" IS NOT NULL THEN "git_host" || ':' || "git_repo_url"
    ELSE 'unknown:' || "git_repo_url"
  END
WHERE "repo_id" IS NULL;

-- After all values are populated, add the NOT NULL constraint
ALTER TABLE "project" ALTER COLUMN "repo_id" SET NOT NULL;

-- Add an index for better query performance
CREATE INDEX IF NOT EXISTS "project_repo_id_idx" ON "project" ("repo_id");
