-- Add deposit fields to terminal_deals
ALTER TABLE terminal_deals
  ADD COLUMN IF NOT EXISTS deposit_amount text,
  ADD COLUMN IF NOT EXISTS deposit_held_by text;
