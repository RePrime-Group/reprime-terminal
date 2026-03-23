-- Add downloadable toggle for documents (view-only by default)
ALTER TABLE terminal_dd_documents
  ADD COLUMN IF NOT EXISTS is_downloadable boolean NOT NULL DEFAULT false;
