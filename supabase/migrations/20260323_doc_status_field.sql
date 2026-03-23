-- Add proper document status field (4 states)
ALTER TABLE terminal_dd_documents
  ADD COLUMN IF NOT EXISTS doc_status text NOT NULL DEFAULT 'pending'
  CHECK (doc_status IN ('verified', 'pending', 'requested', 'notrequired'));

-- Migrate existing is_verified data
UPDATE terminal_dd_documents SET doc_status = 'verified' WHERE is_verified = true;
UPDATE terminal_dd_documents SET doc_status = 'pending' WHERE is_verified = false;
