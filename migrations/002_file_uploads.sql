-- Migration 002: File uploads (deliverable_files + task_attachments)
-- Run this on your Neon database to add file upload support

-- Create file_type enum
DO $$ BEGIN
  CREATE TYPE file_type AS ENUM ('html', 'css', 'js', 'image', 'pdf', 'zip', 'text', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create deliverable_files table
CREATE TABLE IF NOT EXISTS deliverable_files (
  id SERIAL PRIMARY KEY,
  deliverable_id INTEGER NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  storage_path VARCHAR(512) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL,
  file_type file_type NOT NULL DEFAULT 'other',
  public_url VARCHAR(1024),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliverable_files_deliverable_id ON deliverable_files(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_deliverable_files_task_id ON deliverable_files(task_id);

-- Create task_attachments table
CREATE TABLE IF NOT EXISTS task_attachments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploader_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path VARCHAR(512) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
