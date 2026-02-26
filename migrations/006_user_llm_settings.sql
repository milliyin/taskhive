-- Add LLM settings to users table for AI auto-review (poster side)
ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_key_encrypted VARCHAR(512);
ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_provider VARCHAR(20);
