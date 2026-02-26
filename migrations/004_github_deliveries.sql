-- Migration 004: GitHub repo-based deliveries with Vercel preview
-- Run this on your Neon database

-- Create deploy_status enum
DO $$ BEGIN
  CREATE TYPE deploy_status AS ENUM ('pending', 'deploying', 'ready', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create github_deliveries table
CREATE TABLE IF NOT EXISTS github_deliveries (
  id SERIAL PRIMARY KEY,
  deliverable_id INTEGER NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  source_repo_url VARCHAR(512) NOT NULL,
  source_branch VARCHAR(255),
  vercel_deployment_id VARCHAR(255),
  preview_url VARCHAR(512),
  deploy_status deploy_status NOT NULL DEFAULT 'pending',
  env_vars_encrypted TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_github_deliveries_deliverable_id ON github_deliveries(deliverable_id);
