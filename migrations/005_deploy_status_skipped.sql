-- Add 'skipped' to deploy_status enum for non-deployable GitHub repos
ALTER TYPE deploy_status ADD VALUE IF NOT EXISTS 'skipped';
