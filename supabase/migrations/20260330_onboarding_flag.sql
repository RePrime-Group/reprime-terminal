-- Add onboarding walkthrough completion flag to terminal_users
ALTER TABLE terminal_users
ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;
