-- Add 'cancelled' status to terminal_deals so admin can mark deals that
-- fell through after assignment / before closing. Cancelled deals remain
-- visible to investors (parallel to assigned/closed visibility) so they
-- can see the outcome on their dashboard.

-- ---------------------------------------------------------------------------
-- 1. Widen status CHECK constraint
-- ---------------------------------------------------------------------------
ALTER TABLE public.terminal_deals
  DROP CONSTRAINT IF EXISTS terminal_deals_status_check;
ALTER TABLE public.terminal_deals
  ADD  CONSTRAINT terminal_deals_status_check
       CHECK (status IN (
         'draft',
         'coming_soon',
         'marketplace',
         'loi_signed',
         'published',
         'under_review',
         'assigned',
         'closed',
         'cancelled'
       ));

-- ---------------------------------------------------------------------------
-- 2. Add optional cancellation_reason column (admin-only field)
-- ---------------------------------------------------------------------------
ALTER TABLE public.terminal_deals
  ADD COLUMN IF NOT EXISTS cancellation_reason text;