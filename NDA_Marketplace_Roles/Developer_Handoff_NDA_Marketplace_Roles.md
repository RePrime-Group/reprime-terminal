# REPRIME Terminal — Developer Handoff: NDA/KYC, Marketplace & Access Control

**Version:** 1.0 | **Date:** April 2026 | **Status:** Confidential — Internal Use Only

---

## 1. Executive Summary

Three interconnected features are being added to the REPRIME Terminal platform. They must be implemented in order because each depends on the previous one.

| Order | Feature | Prompt | Effort | Dependencies |
|---|---|---|---|---|
| 1 | NDA + KYC Onboarding | Prompt A | 1-2 days | None |
| 2 | Marketplace Section | Prompt B | Half day | None (but logically pairs with C) |
| 3 | Role-Based Access Control | Prompt C | Half day | Prompt B (Marketplace must exist) |

**Total estimated effort:** 2-3 days sequential, or 2 days if B and C are parallelized after A is complete.

---

## 2. Product Context

### Why we're building this

REPRIME currently shows ~13 deals under signed LOI to investors. In reality, the team interacts with 20-50 deals at any given time (receiving OMs, analyzing, negotiating). The Marketplace feature makes these early-stage deals visible to investors, showing volume and giving REPRIME pricing guidance before committing to an LOI.

The NDA/KYC onboarding ensures every investor on the platform is legally bound by confidentiality and verified as a qualified investor before seeing any deal data.

The role system separates full investors (who see everything) from marketplace-only users (who see early-stage deal flow at $49.99/month — Stripe deferred to post-beta).

### User journey — New Full Investor

```
1. Receives invite link → creates account
2. First login → NDA signing screen (full-screen, must sign)
3. After NDA → KYC verification form (full-screen, must complete)
4. Auto-approved (if accredited) → lands on Dashboard
5. Sees: Dashboard, Portfolio, Marketplace, Compare tabs
6. Can: view all deals, commit, express interest, download docs
```

### User journey — New Marketplace-Only User

```
1. Receives invite link → creates account
2. First login → NDA signing screen (same as above)
3. After NDA → KYC verification form (same as above)
4. Auto-approved → lands on Marketplace page
5. Sees: Marketplace tab only
6. Can: browse marketplace deals, express interest with price guidance
7. Cannot: see Portfolio deals, commit to LOI/PSA deals
```

### User journey — Existing User (grandfathered)

```
1. Next login → goes directly to Dashboard (no NDA/KYC)
2. Everything works as before
3. Marketplace tab is now visible in their nav
```

---

## 3. Feature A: NDA + KYC Onboarding

### What it does

Gates all platform access behind a two-step onboarding flow: NDA signing followed by KYC (Know Your Customer) verification. Neither step can be skipped. Once complete, the user never sees these screens again.

### Key architecture decisions

**Reuse existing NDA component.** The Terminal already has a functional NDA signing flow (triggered by Data Room access). This component is relocated to the first-login gate and modified to force "Blanket NDA — All Deals" coverage. The existing per-deal NDA prompt is bypassed for users who have signed the blanket NDA.

**KYC is a new form.** Standard investor verification fields: personal information, employment/income, financial profile, accredited investor self-certification. Data stored as JSONB for flexibility — fields can be added/modified without schema changes.

**Auto-approval for beta.** Any user who checks at least one accredited investor criterion is automatically approved. Users who select "None of the above" go into a manual review queue visible to admin.

**SSN must be encrypted.** The Social Security Number field cannot be stored as plain text. Encrypt before storing, mask in admin display (show last 4 digits only).

**Existing users are grandfathered.** A migration marks all current users as having completed onboarding so they aren't forced through the flow on their next login.

### Database changes

One new table: `user_onboarding` — stores NDA signature data, KYC form data (JSONB), approval status, timestamps, and IP addresses for audit trail.

Columns on the user table may also need to be added (or the `user_onboarding` table is joined on reads).

### Files likely affected

- Auth middleware or portal layout (onboarding gate)
- New pages: `/onboarding/nda`, `/onboarding/kyc`, `/onboarding/pending`
- Existing NDA component (modified for blanket-only mode)
- Data Room component (skip per-deal NDA when blanket is signed)
- Admin Users page (onboarding status display)
- Migration file

---

## 4. Feature B: Marketplace Section

### What it does

Adds a "Marketplace" deal status and a new Marketplace tab in the investor navigation. Deals set to "Marketplace" status appear in this section with the same cards, metrics, and detail pages as other deals. The only difference is the action: instead of "Commit to Deal," marketplace deals have "Express Interest" with optional price guidance.

### Key architecture decisions

**No new components.** The Marketplace page reuses `DealCard`, the deal detail page, and all existing UI components. It's essentially a filtered view of deals with `status = 'marketplace'`.

**Price guidance.** Investors can express interest "at asking price" or "at a custom price" with a target dollar amount. This data is stored in a `marketplace_interest` table and visible to admin, providing real-time demand and pricing signals.

**Deal graduation is manual.** When a marketplace deal progresses to LOI, the admin changes the status in the dropdown. The deal moves from Marketplace to Portfolio automatically (the queries filter by status). No code change needed for graduation.

### Database changes

One new table: `marketplace_interest` — stores user interest per deal with optional target price and notes. UNIQUE on (deal_id, user_id).

No changes to `terminal_deals` schema — "marketplace" is just a new status value in the existing TEXT column.

### Files likely affected

- Admin deal status dropdown component
- New page: `/portal/marketplace`
- Deal detail page (conditional action buttons based on deal status)
- DealCard component (marketplace badge)
- Navigation component (new tab)

---

## 5. Feature C: Role-Based Access Control

### What it does

Adds an `access_tier` field to users: "investor" (full access) or "marketplace_only" (restricted). Marketplace-only users can only see the Marketplace tab and marketplace deals. All other routes redirect to Marketplace.

### Key architecture decisions

**Route-level protection.** A middleware or layout check inspects the user's tier on every page load. Marketplace-only users are redirected away from Dashboard, Portfolio, Compare, and non-marketplace deal detail pages.

**Nav filtering.** The navigation component filters visible tabs based on the user's tier. Marketplace-only users see only the Marketplace tab.

**Login redirect.** After login (and onboarding completion), marketplace-only users land on `/portal/marketplace`. Full investors land on `/portal` (Dashboard).

**Admin controls.** Admins can set and change user tiers. The invite modal includes a tier selection. The Users list shows each user's tier with filtering.

### Database changes

One new column on the user table: `access_tier TEXT DEFAULT 'investor'`. Existing users default to 'investor'.

### Files likely affected

- User table migration
- Auth middleware or portal layout (role check)
- Navigation component (tab filtering)
- Post-login redirect logic
- Admin Users page (tier column, filter, edit)
- Invite modal (tier selection)
- Deal detail page (status check for marketplace-only users)

---

## 6. Implementation Order

```
Week 1 — Day 1-2:
  ├── Prompt A: NDA + KYC Onboarding
  │     1. Create user_onboarding table
  │     2. Build onboarding gate (middleware/layout)
  │     3. Relocate NDA component to /onboarding/nda
  │     4. Build KYC form at /onboarding/kyc
  │     5. Build pending review page
  │     6. Grandfather existing users
  │     7. Update admin Users page
  │     8. Test: new user goes through flow, existing user skips
  │
  └── VERIFY: New account → NDA → KYC → auto-approve → Dashboard

Week 1 — Day 3:
  ├── Prompt B: Marketplace Section
  │     1. Add "Marketplace" to status dropdown
  │     2. Create /portal/marketplace page
  │     3. Add Marketplace tab to nav
  │     4. Build interest form on marketplace deal pages
  │     5. Create marketplace_interest table
  │     6. Build admin interest view
  │     7. Test: create marketplace deal, express interest
  │
  └── VERIFY: Marketplace tab works, interest submits, admin sees it

Week 1 — Day 3-4:
  ├── Prompt C: Role-Based Access Control
  │     1. Add access_tier column
  │     2. Build route protection middleware
  │     3. Filter nav tabs by role
  │     4. Update login redirect
  │     5. Update admin Users page and invite modal
  │     6. Test: marketplace-only user can't access Portfolio
  │
  └── VERIFY: Role switching works, routes protected, nav correct
```

---

## 7. Database Schema — All Changes

### New Tables

```sql
-- Prompt A: Onboarding
CREATE TABLE user_onboarding (
  user_id UUID PRIMARY KEY,
  nda_signed_at TIMESTAMPTZ,
  nda_legal_name TEXT,
  nda_company TEXT,
  nda_title TEXT,
  nda_ip_address TEXT,
  nda_user_agent TEXT,
  kyc_completed_at TIMESTAMPTZ,
  kyc_approved BOOLEAN DEFAULT FALSE,
  kyc_approved_at TIMESTAMPTZ,
  kyc_approved_by TEXT,
  kyc_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt B: Marketplace Interest
CREATE TABLE marketplace_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  interest_type TEXT NOT NULL DEFAULT 'at_asking',
  target_price NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (deal_id, user_id)
);
```

### New Columns

```sql
-- Prompt C: Access Control
ALTER TABLE terminal_users ADD COLUMN IF NOT EXISTS
  access_tier TEXT DEFAULT 'investor';
```

### Migrations for Existing Data

```sql
-- Grandfather existing users (Prompt A)
INSERT INTO user_onboarding (user_id, nda_signed_at, kyc_completed_at, kyc_approved)
SELECT id, NOW(), NOW(), TRUE FROM terminal_users
ON CONFLICT (user_id) DO NOTHING;

-- Default all existing users to full investor (Prompt C)
UPDATE terminal_users SET access_tier = 'investor' WHERE access_tier IS NULL;
```

---

## 8. Security Considerations

### SSN Handling
- Encrypt at rest (do NOT store as plain text in JSONB)
- Mask in admin display (show last 4 digits only: ***-**-1234)
- Never expose in API responses beyond admin context
- Never log SSN values

### NDA Audit Trail
- Store IP address and user agent at signing time
- Store exact timestamp
- NDA records are immutable (cannot be deleted or modified)

### Role Enforcement
- Route protection at middleware level (not just UI hiding)
- Direct URL access must be blocked (not just nav tab hiding)
- API endpoints should also respect role (marketplace-only users
  can't fetch Portfolio deals via API)

### KYC Data Privacy
- KYC data visible only to admin/owner roles
- Not exposed to other investors
- Not included in any public-facing API

---

## 9. Testing Matrix

| Test Case | Expected Result |
|---|---|
| New user first login | Sees NDA screen, cannot access any content |
| Sign NDA, don't complete KYC | Sees KYC form on next login, still blocked |
| Complete KYC as accredited | Auto-approved, lands on home page |
| Complete KYC as non-accredited | Sees "under review" page, blocked |
| Existing user next login | Goes directly to Dashboard (grandfathered) |
| Admin approves pending user | User can access platform on next login |
| Marketplace-only user login | Lands on Marketplace page |
| Marketplace-only visits /portal | Redirected to /portal/marketplace |
| Marketplace-only visits deal URL | Redirected if deal is not marketplace |
| Full investor visits Marketplace | Marketplace tab visible and works |
| Create marketplace deal in admin | Appears in Marketplace tab, not Portfolio |
| Express interest on marketplace deal | Interest stored, counter increments |
| Change deal status to Published | Deal moves from Marketplace to Portfolio |
| Admin changes user tier | Access changes on next page load |
| SSN stored in KYC | Encrypted at rest, masked in admin |

---

## 10. Open Questions for Team

1. **NDA legal text:** Gideon needs to provide the final investor-facing NDA text. The prompt uses placeholder text. Do NOT launch the onboarding flow with placeholder NDA text — the legal language must be final.

2. **KYC field adjustments:** The current KYC form uses standard accredited investor criteria. Stephen is working on getting the exact thresholds and any additional fields from the legal team. The form is built to be easily modified (JSONB storage, config-driven fields).

3. **Stripe integration timing:** Marketplace-only users are free during beta. Stripe paywall will be added in a future sprint. The role system is designed to support this — when Stripe is ready, marketplace-only users will need an active subscription to access the Marketplace tab.

4. **Manual review process:** For non-accredited KYC submissions, the admin needs to manually approve. In the beta, this is expected to be rare (most investors will self-certify). If volume increases, consider adding an email notification to admin when a new KYC is submitted for review.

5. **Marketplace deal data:** The team should begin preparing OMs for upload to the Marketplace. Each deal needs the same admin form data as a regular deal (name, type, city, state, PP, NOI, SF, photos). The calculation engine handles the rest. Target: 20-30 marketplace deals at launch.

---

*REPRIME GROUP · Confidential · April 2026*
