-- 20260427_nda_kyc_marketplace_roles.sql
-- Adds: per-user KYC table (terminal_user_kyc), access_tier on investors only,
--       'marketplace' deal status, marketplace_interest table.
-- Grandfathers existing investors so they skip NDA/KYC on next login.
--
-- Owners/employees use admin routes and are NOT subject to NDA/KYC, and
-- access_tier is meaningful only for role='investor'.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. terminal_user_kyc — KYC state for investors only.
--    NDA state still lives in terminal_nda_signatures (a row with
--    nda_type='blanket' = signed). terminal_users.onboarding_completed is
--    untouched; it gates the existing welcome tour, not NDA/KYC.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terminal_user_kyc (
  user_id              uuid        PRIMARY KEY
                       REFERENCES public.terminal_users(id) ON DELETE CASCADE,

  -- Lifecycle
  completed_at         timestamptz,                 -- set when user submits the form
  approved             boolean     NOT NULL DEFAULT false,
  approved_at          timestamptz,
  approved_by          text,                        -- 'auto' | 'grandfathered' | <admin user_id>
  rejected_at          timestamptz,
  rejection_reason     text,

  -- Payload (non-sensitive fields)
  data                 jsonb,                       -- personal/employment/financial/accreditation/etc

  -- Sensitive — Node-side AES-256-GCM. Layout: iv(12) || authTag(16) || ciphertext.
  ssn_encrypted        bytea,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terminal_user_kyc_pending_review
  ON public.terminal_user_kyc(completed_at)
  WHERE approved = false AND rejected_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. access_tier on terminal_users (NULL for owners/employees, required for investors)
--    Order matters: add the column, backfill existing rows, THEN add the
--    cross-column CHECK — otherwise existing investor rows (NULL access_tier)
--    fail the constraint at ADD time.
-- ---------------------------------------------------------------------------
ALTER TABLE public.terminal_users
  ADD COLUMN IF NOT EXISTS access_tier text;        -- nullable, no default

UPDATE public.terminal_users
   SET access_tier = 'investor'
 WHERE role        = 'investor'
   AND access_tier IS NULL;

ALTER TABLE public.terminal_users
  DROP CONSTRAINT IF EXISTS terminal_users_access_tier_check;
ALTER TABLE public.terminal_users
  ADD  CONSTRAINT terminal_users_access_tier_check
       CHECK (
         (role = 'investor'        AND access_tier IN ('investor', 'marketplace_only'))
         OR
         (role IN ('owner','employee') AND access_tier IS NULL)
       );

-- ---------------------------------------------------------------------------
-- 3. Access tier on invite tokens.
--    Only meaningful when role='investor'; otherwise must be NULL.
--    Same ordering rule as above: backfill existing investor invites first,
--    then add the CHECK.
-- ---------------------------------------------------------------------------
ALTER TABLE public.terminal_invite_tokens
  ADD COLUMN IF NOT EXISTS access_tier text;

UPDATE public.terminal_invite_tokens
   SET access_tier = 'investor'
 WHERE role        = 'investor'
   AND access_tier IS NULL;

ALTER TABLE public.terminal_invite_tokens
  DROP CONSTRAINT IF EXISTS terminal_invite_tokens_access_tier_check;
ALTER TABLE public.terminal_invite_tokens
  ADD  CONSTRAINT terminal_invite_tokens_access_tier_check
       CHECK (
         (role = 'investor'                   AND access_tier IN ('investor', 'marketplace_only'))
         OR
         (role IN ('employee', 'team_member') AND access_tier IS NULL)
       );

-- ---------------------------------------------------------------------------
-- 4. Add 'marketplace' to terminal_deals.status CHECK constraint
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
         'closed'
       ));

-- ---------------------------------------------------------------------------
-- 4a. Investor-visible marketplace deals.
--     The base RLS in 002_terminal_rls.sql only lets investors see
--     published/assigned/closed. Add a parallel policy so the new
--     'marketplace' status is also visible.
--     (Photos, dd_folders, dd_documents follow the deal's visibility, and
--     the existing policies on those tables already gate by deal status.
--     Add matching marketplace policies to keep them consistent.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Investors can view marketplace deals" ON public.terminal_deals;
CREATE POLICY "Investors can view marketplace deals" ON public.terminal_deals
  FOR SELECT USING (
    terminal_user_role() = 'investor' AND status = 'marketplace'
  );

DROP POLICY IF EXISTS "Investors can view marketplace photos" ON public.terminal_deal_photos;
CREATE POLICY "Investors can view marketplace photos" ON public.terminal_deal_photos
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (SELECT id FROM public.terminal_deals WHERE status = 'marketplace')
  );

DROP POLICY IF EXISTS "Investors can view marketplace folders" ON public.terminal_dd_folders;
CREATE POLICY "Investors can view marketplace folders" ON public.terminal_dd_folders
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (SELECT id FROM public.terminal_deals WHERE status = 'marketplace')
  );

DROP POLICY IF EXISTS "Investors can view marketplace documents" ON public.terminal_dd_documents;
CREATE POLICY "Investors can view marketplace documents" ON public.terminal_dd_documents
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (SELECT id FROM public.terminal_deals WHERE status = 'marketplace')
  );

-- ---------------------------------------------------------------------------
-- 4b. RLS for terminal_user_kyc
--     Investors manage their own row; owners/employees can read every row
--     and update the approval flags.
-- ---------------------------------------------------------------------------
ALTER TABLE public.terminal_user_kyc ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc_select_own" ON public.terminal_user_kyc;
CREATE POLICY "kyc_select_own" ON public.terminal_user_kyc
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "kyc_insert_own" ON public.terminal_user_kyc;
CREATE POLICY "kyc_insert_own" ON public.terminal_user_kyc
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "kyc_update_own" ON public.terminal_user_kyc;
CREATE POLICY "kyc_update_own" ON public.terminal_user_kyc
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "kyc_select_admin" ON public.terminal_user_kyc;
CREATE POLICY "kyc_select_admin" ON public.terminal_user_kyc
  FOR SELECT USING (terminal_user_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "kyc_update_admin" ON public.terminal_user_kyc;
CREATE POLICY "kyc_update_admin" ON public.terminal_user_kyc
  FOR UPDATE USING (terminal_user_role() IN ('owner', 'employee'))
  WITH CHECK (terminal_user_role() IN ('owner', 'employee'));

-- ---------------------------------------------------------------------------
-- 5. Marketplace interest table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_interest (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       uuid        NOT NULL REFERENCES public.terminal_deals(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.terminal_users(id) ON DELETE CASCADE,
  interest_type text        NOT NULL DEFAULT 'at_asking'
                CHECK (interest_type IN ('at_asking', 'custom_price')),
  target_price  numeric,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_interest_deal ON public.marketplace_interest(deal_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_interest_user ON public.marketplace_interest(user_id);

-- 5b. RLS for marketplace_interest
--     Investors manage their own interest rows; owners/employees can read
--     every row to see pricing guidance.
ALTER TABLE public.marketplace_interest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_interest_select_own" ON public.marketplace_interest;
CREATE POLICY "marketplace_interest_select_own" ON public.marketplace_interest
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "marketplace_interest_insert_own" ON public.marketplace_interest;
CREATE POLICY "marketplace_interest_insert_own" ON public.marketplace_interest
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "marketplace_interest_update_own" ON public.marketplace_interest;
CREATE POLICY "marketplace_interest_update_own" ON public.marketplace_interest
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "marketplace_interest_delete_own" ON public.marketplace_interest;
CREATE POLICY "marketplace_interest_delete_own" ON public.marketplace_interest
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "marketplace_interest_select_admin" ON public.marketplace_interest;
CREATE POLICY "marketplace_interest_select_admin" ON public.marketplace_interest
  FOR SELECT USING (terminal_user_role() IN ('owner', 'employee'));

-- ---------------------------------------------------------------------------
-- 6. Grandfather existing investors only.
--    (access_tier is already backfilled in step 2 above.)
-- ---------------------------------------------------------------------------

-- 6a. Insert an approved KYC row for every existing investor that doesn't have one
INSERT INTO public.terminal_user_kyc
       (user_id, completed_at, approved, approved_at, approved_by)
SELECT u.id, now(), TRUE, now(), 'grandfathered'
  FROM public.terminal_users u
 WHERE u.role = 'investor'
   AND NOT EXISTS (
     SELECT 1 FROM public.terminal_user_kyc k WHERE k.user_id = u.id
   );

-- 6b. Insert a blanket NDA signature for every existing investor that doesn't have one
INSERT INTO public.terminal_nda_signatures
       (user_id, nda_type, signed_at, signer_name, ip_address)
SELECT u.id, 'blanket', now(), u.full_name, 'grandfathered'
  FROM public.terminal_users u
 WHERE u.role = 'investor'
   AND NOT EXISTS (
     SELECT 1
       FROM public.terminal_nda_signatures s
      WHERE s.user_id  = u.id
        AND s.nda_type = 'blanket'
   );

COMMIT;
