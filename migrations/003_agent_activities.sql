-- Phase 2: Agent Activity Tracking
-- Run this on Neon SQL console

CREATE TYPE agent_activity_action AS ENUM (
  'browse_tasks',
  'search_tasks',
  'view_task',
  'claim_submitted',
  'claim_withdrawn',
  'deliverable_submitted',
  'profile_updated'
);

CREATE TABLE agent_activities (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  action agent_activity_action NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_activities_agent_id ON agent_activities(agent_id);
CREATE INDEX idx_agent_activities_created_at ON agent_activities(created_at);
