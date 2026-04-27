# REPRIME Terminal — Role-Based Access Control

## CONTEXT

The Terminal needs two tiers of investor access:

1. **Full Investor** — sees everything (Dashboard, Portfolio,
   Marketplace, all deal details, can commit to deals)
2. **Marketplace Only** — sees only the Marketplace section, cannot
   view Portfolio/Dashboard deals or commit to LOI/PSA deals

This prompt adds the role system, route protection, and nav changes.
It depends on Prompt B (Marketplace Section) being implemented first
so the Marketplace tab and page exist.

═══════════════════════════════════════════════════════════════════════════════
## 1. USER ROLE FIELD
═══════════════════════════════════════════════════════════════════════════════

### 1A. Database

Add a role column to the user table:

```sql
ALTER TABLE terminal_users ADD COLUMN IF NOT EXISTS
  access_tier TEXT DEFAULT 'investor'
  CHECK (access_tier IN ('investor', 'marketplace_only'));
```

Values:
- `investor` — full access (default for existing users)
- `marketplace_only` — marketplace access only

If the user table doesn't have this column or uses a different
permission model, adapt accordingly. The key requirement is a
per-user flag that determines their access level.

### 1B. Existing Users

All existing users default to `investor` (full access). No existing
user loses access.

```sql
UPDATE terminal_users SET access_tier = 'investor'
WHERE access_tier IS NULL;
```

### 1C. Admin — Set User Role

In the admin Users page, add an "Access Tier" dropdown for each user:

```
Access Tier: [ Full Investor ▼ ]
             [ Marketplace Only ]
```

The admin can change a user's tier at any time. Changing from
"Marketplace Only" to "Full Investor" immediately grants full access.
Changing from "Full Investor" to "Marketplace Only" immediately
restricts access (next page load).

Also add the tier option to the "Invite team member" modal:

```
INVITE MEMBER

Full Name          [              ]
Email              [              ]

ACCESS TIER
  ○ Full Investor — access to all deals and marketplace
  ● Marketplace Only — marketplace deals only

INITIAL PERMISSIONS
  ☑ View deals
  ☑ Manage watchlist
  ☑ Commit to deals
  ☑ Download documents
  ☑ Schedule meetings

[Send Invite]
```

When inviting a marketplace-only user, the "Commit to deals"
permission applies only to marketplace deals (express interest),
not to Portfolio deals (which they can't see).

═══════════════════════════════════════════════════════════════════════════════
## 2. ROUTE PROTECTION
═══════════════════════════════════════════════════════════════════════════════

### 2A. Protected Routes

Marketplace-only users are blocked from accessing:

| Route | Access |
|---|---|
| `/portal` (Dashboard) | ❌ Redirect to `/portal/marketplace` |
| `/portal/deals/[id]` where deal is NOT marketplace | ❌ Redirect to `/portal/marketplace` |
| `/portal/deals/[id]` where deal IS marketplace | ✅ Allowed |
| `/portal/marketplace` | ✅ Allowed |
| `/portal/compare` | ❌ Redirect to `/portal/marketplace` |
| `/portal/settings` | ✅ Allowed (their own settings) |
| `/portal/profile` | ✅ Allowed |

### 2B. Middleware / Layout Check

Add a role check alongside the existing onboarding gate:

```ts
// In the portal layout or middleware
const user = await getAuthUser();

// Onboarding checks (from Prompt A)
if (!user.nda_signed_at) redirect('/onboarding/nda');
if (!user.kyc_completed_at) redirect('/onboarding/kyc');
if (!user.kyc_approved) redirect('/onboarding/pending');

// Role-based route protection
if (user.access_tier === 'marketplace_only') {
  const currentPath = getCurrentPath();

  // Allow: marketplace, settings, profile, onboarding
  const allowedPaths = [
    '/portal/marketplace',
    '/portal/settings',
    '/portal/profile',
  ];

  const isAllowed = allowedPaths.some(p => currentPath.startsWith(p));

  // Also allow individual deal pages IF the deal is marketplace status
  const isDealPage = currentPath.match(/\/portal\/deals\/(.+)/);
  if (isDealPage) {
    const dealId = isDealPage[1];
    const deal = await getDealStatus(dealId);
    if (deal?.status === 'marketplace') {
      // Allowed — marketplace deal
    } else {
      redirect('/portal/marketplace');
      return;
    }
  } else if (!isAllowed) {
    redirect('/portal/marketplace');
    return;
  }
}
```

### 2C. Deal Detail Page — Status Check

On the deal detail page (`/portal/deals/[id]`), after fetching the
deal data, check if the user has permission to view it:

```ts
if (user.access_tier === 'marketplace_only' && deal.status !== 'marketplace') {
  redirect('/portal/marketplace');
  return;
}
```

This prevents a marketplace-only user from directly navigating to
a Portfolio deal via URL.

═══════════════════════════════════════════════════════════════════════════════
## 3. NAVIGATION CHANGES
═══════════════════════════════════════════════════════════════════════════════

### 3A. Full Investor Navigation

```
Dashboard | Portfolio | Marketplace | Compare    [Profile ▼]
```

All tabs visible. Dashboard and Portfolio show LOI/PSA deals.
Marketplace shows early-stage deals. Compare works across all deals
the user can see.

### 3B. Marketplace-Only Navigation

```
Marketplace                                      [Profile ▼]
```

Only the Marketplace tab is visible. Dashboard, Portfolio, and
Compare tabs are hidden. The user sees a clean, focused experience
with only the marketplace deals.

### 3C. Implementation

In the nav component, filter tabs based on role:

```tsx
const navTabs = [
  { key: 'dashboard', label: 'Dashboard', path: '/portal', roles: ['investor'] },
  { key: 'portfolio', label: 'Portfolio', path: '/portal/portfolio', roles: ['investor'] },
  { key: 'marketplace', label: 'Marketplace', path: '/portal/marketplace', roles: ['investor', 'marketplace_only'] },
  { key: 'compare', label: 'Compare', path: '/portal/compare', roles: ['investor'] },
];

const visibleTabs = navTabs.filter(tab =>
  tab.roles.includes(user.access_tier)
);
```

═══════════════════════════════════════════════════════════════════════════════
## 4. LOGIN REDIRECT
═══════════════════════════════════════════════════════════════════════════════

After login (and after onboarding is complete), redirect based on role:

```ts
// Post-login redirect
if (user.access_tier === 'marketplace_only') {
  redirect('/portal/marketplace');
} else {
  // Check for pending shareable link redirect (from Prompt 2)
  const pendingRedirect = searchParams.get('redirect');
  if (pendingRedirect) {
    redirect(pendingRedirect);
  } else {
    redirect('/portal');  // Dashboard
  }
}
```

Marketplace-only users always land on Marketplace. Full investors
land on Dashboard (or on a specific deal if they came from a shared
link).

═══════════════════════════════════════════════════════════════════════════════
## 5. ADMIN VIEW — ROLE MANAGEMENT
═══════════════════════════════════════════════════════════════════════════════

### 5A. Users List

Add "Access Tier" as a column in the admin Users table:

```
Name       Email              Tier              Status    Actions
John       john@example.com   Full Investor     Active    [Edit]
Jane       jane@example.com   Marketplace Only  Active    [Edit]
```

### 5B. Filter by Tier

Add a filter dropdown at the top of the Users list:

```
Filter: [All ▼]  [Full Investors]  [Marketplace Only]
```

### 5C. Bulk Tier Change

Select multiple users → "Change Access Tier" → pick tier → apply.
This is useful when upgrading marketplace users to full investors
in batches.

═══════════════════════════════════════════════════════════════════════════════
## 6. EDGE CASES
═══════════════════════════════════════════════════════════════════════════════

**Marketplace deal graduates to Published:** If a marketplace-only
user expressed interest in a deal, and that deal's status changes
to "Published" or "LOI Signed," the user can no longer view it
(it's now in Portfolio, which they can't access). Their marketplace
interest data is preserved in the database, but they lose visibility
into the deal. This is expected — to see Portfolio deals, they need
to be upgraded to Full Investor tier.

**Shared links:** If a full investor shares a Portfolio deal link
with someone, and that person signs up as marketplace-only, they'll
be redirected to Marketplace (can't see the shared deal). The
shareable link redirect respects the role check.

**Admin/Owner users:** Admin and owner roles bypass all tier
restrictions. They see everything.

═══════════════════════════════════════════════════════════════════════════════
## 7. EXPLICITLY OUT OF SCOPE

- Do NOT change the deal calculation engine
- Do NOT change any deal content or metrics
- Do NOT build Stripe integration or payment gating
- Do NOT change the Marketplace section content (built in Prompt B)
- Do NOT change the NDA/KYC onboarding flow (built in Prompt A)
- Do NOT build tier-based pricing differences
- Do NOT build automatic tier upgrades

═══════════════════════════════════════════════════════════════════════════════
## 8. VERIFICATION

### Roles
- [ ] `access_tier` column exists on user table
- [ ] Default is 'investor' for all existing users
- [ ] Admin can change a user's tier
- [ ] Invite modal includes tier selection

### Route Protection
- [ ] Marketplace-only user cannot access Dashboard
- [ ] Marketplace-only user cannot access Portfolio
- [ ] Marketplace-only user cannot access Compare
- [ ] Marketplace-only user CAN access Marketplace
- [ ] Marketplace-only user CAN access marketplace deal detail pages
- [ ] Marketplace-only user CANNOT access non-marketplace deal pages
- [ ] Marketplace-only user CAN access Settings and Profile
- [ ] Full investor can access everything
- [ ] Direct URL navigation respects role (no URL bypass)

### Navigation
- [ ] Full investor sees: Dashboard, Portfolio, Marketplace, Compare
- [ ] Marketplace-only sees: Marketplace only
- [ ] No hidden tabs leak through

### Login Redirect
- [ ] Marketplace-only user lands on Marketplace after login
- [ ] Full investor lands on Dashboard after login
- [ ] Shared link redirect works for full investors
- [ ] Shared link redirect respects role for marketplace-only users

### Admin
- [ ] Users list shows access tier column
- [ ] Filter by tier works
- [ ] Tier change takes effect on next page load

### Regression
- [ ] Existing users have full investor access (unchanged)
- [ ] All existing pages work for full investors
- [ ] No authentication flow disruption
- [ ] No TypeScript errors

═══════════════════════════════════════════════════════════════════════════════
## DELIVERABLES

1. Files modified/created with descriptions
2. DB migration SQL
3. Screenshot/description of nav for each role
4. Screenshot/description of admin tier management
5. Route protection test results
6. Login redirect test results
7. Ambiguities encountered

Do not deploy. Local implementation for review.
