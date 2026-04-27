# REPRIME Terminal — Marketplace Section

## CONTEXT

REPRIME needs a Marketplace section where early-stage deals (pre-LOI)
are visible to investors as soon as the OM is received from a broker.
This gives investors early deal flow visibility, gives REPRIME pricing
guidance, and shows volume (20-50 deals instead of 13 under LOI).

The Marketplace uses the SAME deal creation flow, SAME card components,
SAME metrics engine, SAME detail page as existing Terminal deals. We
are NOT building new components — just adding a new status value, a
new navigation tab, and a modified action on marketplace deals.

═══════════════════════════════════════════════════════════════════════════════
## 1. DEAL STATUS — ADD "MARKETPLACE"
═══════════════════════════════════════════════════════════════════════════════

### 1A. Status Dropdown

Add "Marketplace" to the admin deal status dropdown. The current
statuses are (from the screenshot):

```
Published (current)
Draft
Coming Soon
LOI Signed
Under Review
Assigned
Closed
```

Add "Marketplace" to this list. Position it near the beginning since
it represents the earliest stage:

```
Published (current)
Draft
Coming Soon
Marketplace          ← NEW
LOI Signed
Under Review
Assigned
Closed
```

This is a TEXT column, so no migration needed — just add the option
to the dropdown component and any status-related type definitions.

### 1B. Pipeline Stage

If the admin pipeline progress bar (POST LOI → DUE DILIGENCE → etc.)
exists, Marketplace deals should show a different pipeline or no
pipeline at all (since they haven't reached LOI stage). Either:
- Hide the pipeline bar for Marketplace deals
- Or add a "MARKETPLACE" stage before POST LOI

The simpler approach is to hide it — marketplace deals don't have
a deal timeline in the traditional sense.

═══════════════════════════════════════════════════════════════════════════════
## 2. NAVIGATION — MARKETPLACE TAB
═══════════════════════════════════════════════════════════════════════════════

### 2A. Top Navigation

Add a "Marketplace" tab to the top navigation bar. The current nav
shows:

```
Dashboard | Portfolio | Compare
```

Add Marketplace:

```
Dashboard | Portfolio | Marketplace | Compare
```

The Marketplace tab links to a new route: `/portal/marketplace`

### 2B. Marketplace Page

Create a new page at `/portal/marketplace` (or the equivalent route
in the app structure).

This page is essentially a COPY of the Portfolio browse page with
these differences:

1. **Data source:** Only shows deals with `status = 'marketplace'`
   (instead of published/coming_soon/loi_signed)
2. **Page header:** "Marketplace" with subtitle "Early-stage
   opportunities — pricing and terms under negotiation"
3. **Same card component:** Uses the same `DealCard` component as
   the Portfolio page. Same layout, same metrics, same styling.
4. **Same grid/list layout:** Same responsive grid as Portfolio.

```ts
// Marketplace page query
const { data: marketplaceDeals } = await supabase
  .from('terminal_deals')
  .select('*')
  .eq('status', 'marketplace')
  .order('created_at', { ascending: false });
```

### 2C. Marketplace Badge on Cards

When a deal card appears in the Marketplace section, it should have
a visual indicator that this is a marketplace (pre-LOI) deal, not a
committed deal:

- Add a badge: "MARKETPLACE" or "PRE-LOI" or "EXPLORING"
- Use a different color than the existing badges (maybe a blue or
  teal to distinguish from the gold "SELLER FINANCING" badge)
- Position: in the badge row below the photo (same location as
  property type and deal type badges)

### 2D. Deal Detail Page — Marketplace Deals

When an investor clicks into a marketplace deal, the full detail
page renders. Same tabs, same metrics, same layout. Two differences:

1. **Status indicator:** A banner or badge at the top:
   "MARKETPLACE — Pricing & terms under negotiation. Express your
   interest and pricing guidance below."

2. **Action buttons change** (see Section 3).

═══════════════════════════════════════════════════════════════════════════════
## 3. MARKETPLACE ACTIONS — INTEREST + PRICE GUIDANCE
═══════════════════════════════════════════════════════════════════════════════

### 3A. Replace Commitment Buttons

On marketplace deal detail pages, replace the standard "Express
Interest" / "Lock This Deal" / "Register as Backup" buttons with:

```
┌──────────────────────────────────────────────────┐
│  MARKETPLACE INTEREST                             │
│                                                  │
│  I'm interested in this deal                     │
│                                                  │
│  At asking price ($5,300,000)     ○               │
│  At a different price             ○               │
│                                                  │
│  My target price: $[          ]                   │
│  (shown when "At a different price" is selected)  │
│                                                  │
│  Notes (optional):                               │
│  [                                               ]│
│  [                                               ]│
│                                                  │
│  [Submit Interest]                               │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 3B. Interest Storage

```sql
CREATE TABLE IF NOT EXISTS marketplace_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  interest_type TEXT NOT NULL DEFAULT 'at_asking',
  target_price NUMERIC DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (deal_id, user_id)
);

CREATE INDEX idx_marketplace_interest_deal ON marketplace_interest(deal_id);
CREATE INDEX idx_marketplace_interest_user ON marketplace_interest(user_id);
```

`interest_type` values: 'at_asking' or 'custom_price'

UNIQUE constraint on (deal_id, user_id) means one expression of
interest per user per deal. If they submit again, it updates (upsert).

### 3C. Interest Counter on Cards

On marketplace deal cards, show the number of investors who have
expressed interest:

```
[Photo]
[Badges: Retail | MARKETPLACE]
$5,300,000          Equity $1,325,000
...
👥 4 Interested                    Due Diligence: --
```

The "4 Interested" counter is computed from `marketplace_interest`
rows for that deal. If 0, show "Be the first to express interest"
or hide the counter.

### 3D. Admin — View Interest

In the admin deal edit page for marketplace deals, add a section
or tab showing all expressions of interest:

```
MARKETPLACE INTEREST (4 investors)

Investor       Interest    Target Price    Notes           Date
John Smith     At asking   --              --              Apr 25
Jane Doe       Custom      $4,800,000      "Would need    Apr 24
                                            seller note"
Bob Wilson     At asking   --              --              Apr 23
Alice Chen     Custom      $5,000,000      --              Apr 22
```

This gives REPRIME pricing guidance — if 3 out of 4 investors want
a lower price, you know the asking price is too high. If all 4 say
"at asking," you know you can move forward aggressively.

### 3E. Deal Graduation

When a marketplace deal progresses (LOI submitted/accepted), the
admin simply changes the status from "Marketplace" to "LOI Signed"
or "Published" in the status dropdown. The deal moves from the
Marketplace tab to the Portfolio tab automatically.

The marketplace interest data is preserved — the admin can reference
which investors expressed interest when the deal was in marketplace
stage.

No automatic graduation. No notifications to marketplace investors
(for the beta). The admin handles communication manually.

═══════════════════════════════════════════════════════════════════════════════
## 4. EXISTING DEALS — NO IMPACT
═══════════════════════════════════════════════════════════════════════════════

Deals with status "Published", "LOI Signed", "Coming Soon", etc.
are completely unaffected. They don't appear in the Marketplace tab.
The Portfolio page query doesn't include "marketplace" status deals.

```ts
// Portfolio page — existing query, unchanged
const activeDeals = deals.filter(d =>
  ['published', 'coming_soon', 'loi_signed'].includes(d.status)
);
```

═══════════════════════════════════════════════════════════════════════════════
## 5. EXPLICITLY OUT OF SCOPE

- Do NOT change the deal creation flow or admin form
- Do NOT change the deal card component layout (use as-is)
- Do NOT change the deal detail page tabs or content
- Do NOT change the calculation engine
- Do NOT build Stripe payment integration
- Do NOT build role-based access control (that's Prompt C)
- Do NOT change the existing Portfolio or Dashboard pages
- Do NOT build automatic deal graduation or notifications

═══════════════════════════════════════════════════════════════════════════════
## 6. VERIFICATION

- [ ] "Marketplace" appears in admin status dropdown
- [ ] Setting a deal to "Marketplace" saves correctly
- [ ] "Marketplace" tab appears in investor top navigation
- [ ] Marketplace page shows only marketplace-status deals
- [ ] Deal cards render correctly with marketplace badge
- [ ] Clicking a marketplace card opens the deal detail page
- [ ] Interest form appears on marketplace deal detail pages
- [ ] "At asking price" and "Custom price" options work
- [ ] Target price field appears when "Custom" is selected
- [ ] Interest submission stores correctly in database
- [ ] Interest counter shows on marketplace cards
- [ ] Admin can view interest per deal
- [ ] Changing status from "Marketplace" to "Published" moves
      the deal to the Portfolio tab
- [ ] Existing published/LOI deals are NOT affected
- [ ] Portfolio page does NOT show marketplace deals
- [ ] No TypeScript errors

═══════════════════════════════════════════════════════════════════════════════
## DELIVERABLES

1. Files modified/created with descriptions
2. DB migration SQL (marketplace_interest table)
3. Screenshot/description of Marketplace tab and page
4. Screenshot/description of interest form on deal detail
5. Screenshot/description of admin interest view
6. Confirmation existing deals unaffected
7. Ambiguities encountered

Do not deploy. Local implementation for review.
