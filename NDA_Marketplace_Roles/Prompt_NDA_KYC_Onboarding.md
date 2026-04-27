# REPRIME Terminal — NDA Relocation + KYC Onboarding Flow

## CONTEXT

The Terminal currently has NDA functionality that triggers when an
investor tries to access the Data Room on a specific deal. This needs
to be relocated to the first-login experience — before any investor
sees ANY platform content, they must sign the blanket NDA and complete
KYC verification. Once both are done, all content is permanently
unlocked.

The existing NDA component (screenshot reference: full NDA text display,
coverage selection, electronic signature with legal name/company/title/
date/signature preview, "Sign & Access" button) should be reused — not
rebuilt from scratch. We're relocating it, not replacing it.

═══════════════════════════════════════════════════════════════════════════════
## 1. ONBOARDING FLOW
═══════════════════════════════════════════════════════════════════════════════

When a new user logs in for the first time, the following sequence
is enforced. The user cannot bypass any step.

```
Login
  ↓
Has user signed blanket NDA?
  ↓ NO
STEP 1: NDA Signing Screen (full-screen, no nav)
  ↓ Signs NDA
Has user completed KYC?
  ↓ NO
STEP 2: KYC Verification Form (full-screen, no nav)
  ↓ Submits KYC
Is KYC approved? (auto-approve for beta)
  ↓ YES
STEP 3: Redirect to appropriate home page
  → Full investor: Dashboard/Portfolio
  → Marketplace only: Marketplace page
```

If the user has already completed both steps (returning user), they
skip directly to their home page. No NDA or KYC screens on subsequent
logins.

### 1A. Onboarding Gate

Add a middleware or layout-level check that runs on every authenticated
page load:

```ts
// In the root portal layout or middleware
const user = await getAuthUser();

if (!user.nda_signed_at) {
  // Redirect to NDA signing page
  redirect('/onboarding/nda');
  return;
}

if (!user.kyc_completed_at) {
  // Redirect to KYC form
  redirect('/onboarding/kyc');
  return;
}

if (!user.kyc_approved) {
  // Show "Application under review" page
  redirect('/onboarding/pending');
  return;
}

// User is fully onboarded — continue to requested page
```

This gate prevents ANY portal content from loading until onboarding
is complete. The onboarding pages themselves (`/onboarding/*`) are
exempt from this check.

═══════════════════════════════════════════════════════════════════════════════
## 2. STEP 1: NDA SIGNING
═══════════════════════════════════════════════════════════════════════════════

### 2A. Relocate Existing NDA Component

The existing NDA component (currently triggered by Data Room access)
should be reused for the onboarding flow. Find the component and
make it renderable in the onboarding context.

**Key changes from the current implementation:**

1. **Coverage:** Force "Blanket NDA — All Deals" as the only option.
   Remove the "Deal-Specific" radio button. The onboarding NDA covers
   all current and future deals. One signature, permanent coverage.

2. **Full-screen layout:** The NDA screen should be full-screen with
   no navigation, no sidebar, no header (except the REPRIME logo).
   The user's only options are to sign or log out.

3. **NDA text:** Use REPRIME's standard investor NDA terms. The text
   should be stored in a config or i18n file so it can be updated
   without code changes. For the beta, use the following structure
   (Gideon will provide final legal text):

   ```
   MUTUAL NON-DISCLOSURE AGREEMENT

   This Non-Disclosure Agreement ("Agreement") is entered into as
   of [DATE] by and between RePrime Group, LLC ("Disclosing Party")
   and the undersigned recipient ("Receiving Party").

   The Receiving Party agrees to hold in confidence all Confidential
   Information provided through the RePrime Terminal platform,
   including but not limited to: financial statements, rent rolls,
   operating data, purchase agreements, loan documents, environmental
   reports, property condition assessments, tenant information,
   and any other materials designated as confidential.

   [... full NDA terms ...]
   ```

4. **Signature capture:** Keep the existing electronic signature flow:
   - Full Legal Name (required)
   - Company / Entity (optional)
   - Title (optional)
   - Date (auto-filled, not editable)
   - Signature Preview (renders the name in a script font)
   - "I have read and agree to the terms" checkbox (required)
   - "Sign Agreement" button

5. **Button text:** Change from "Sign & Access Data Room" to
   "Sign & Continue" (since they're not accessing the Data Room
   yet — they still have KYC to complete).

### 2B. NDA Storage

When the user signs, store the signature data:

```sql
ALTER TABLE terminal_users ADD COLUMN IF NOT EXISTS nda_signed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE terminal_users ADD COLUMN IF NOT EXISTS nda_legal_name TEXT DEFAULT NULL;
ALTER TABLE terminal_users ADD COLUMN IF NOT EXISTS nda_company TEXT DEFAULT NULL;
ALTER TABLE terminal_users ADD COLUMN IF NOT EXISTS nda_title TEXT DEFAULT NULL;
ALTER TABLE terminal_users ADD COLUMN IF NOT EXISTS nda_ip_address TEXT DEFAULT NULL;
```

If the user table is managed by Supabase Auth and doesn't have these
columns, store in a separate `user_onboarding` table:

```sql
CREATE TABLE IF NOT EXISTS user_onboarding (
  user_id UUID PRIMARY KEY,
  nda_signed_at TIMESTAMPTZ DEFAULT NULL,
  nda_legal_name TEXT DEFAULT NULL,
  nda_company TEXT DEFAULT NULL,
  nda_title TEXT DEFAULT NULL,
  nda_ip_address TEXT DEFAULT NULL,
  nda_user_agent TEXT DEFAULT NULL,
  kyc_completed_at TIMESTAMPTZ DEFAULT NULL,
  kyc_approved BOOLEAN DEFAULT FALSE,
  kyc_approved_at TIMESTAMPTZ DEFAULT NULL,
  kyc_approved_by TEXT DEFAULT NULL,
  kyc_data JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Record the IP address and user agent at signing time for legal
compliance — this creates an audit trail proving the user signed
from a specific device/location.

### 2C. Data Room — Remove Per-Deal NDA Gate

Once the blanket NDA is signed during onboarding, the per-deal NDA
prompt in the Data Room should be SKIPPED. The user already signed
a blanket NDA covering all deals.

Find the existing NDA gate in the Data Room component and add a
check:

```ts
// If user has signed blanket NDA, skip the per-deal NDA prompt
if (user.nda_signed_at) {
  // Show Data Room directly — no NDA needed
} else {
  // Show NDA prompt (fallback for edge cases)
}
```

Keep the per-deal NDA component in the codebase as a fallback but
it should never trigger for users who completed onboarding.

═══════════════════════════════════════════════════════════════════════════════
## 3. STEP 2: KYC VERIFICATION FORM
═══════════════════════════════════════════════════════════════════════════════

### 3A. KYC Page Layout

Full-screen form, same layout treatment as the NDA page (no nav,
REPRIME logo only). A clean, professional form with clear sections.

```
REPRIME TERMINAL
Investor Verification

Complete this form to verify your investor status. All information
is confidential and used solely for compliance purposes.

─────────────────────────────────────────────────────────────────

PERSONAL INFORMATION

  Full Legal Name *          [                              ]
  Date of Birth *            [  MM/DD/YYYY  ]
  Social Security / Tax ID * [                              ]
  Driver's License #         [                              ]

  Address *                  [                              ]
  City *                     [              ]
  State *                    [    ]  Zip *  [        ]
  Country                    [  United States  ▼  ]

  Phone Number *             [                              ]
  Email Address              [  pre-filled from account     ]

─────────────────────────────────────────────────────────────────

EMPLOYMENT & INCOME

  Occupation *               [                              ]
  Employer Name *            [                              ]
  Employer Address           [                              ]
  Type of Business/Industry  [                              ]
  Annual Income *            [  dropdown or text             ]
  Source of Funds *           [  dropdown: Employment,
                                Business Income, Investments,
                                Inheritance, Real Estate,
                                Savings, Other ▼             ]

─────────────────────────────────────────────────────────────────

FINANCIAL PROFILE

  Estimated Net Worth *      [  dropdown:
                                Under $500K
                                $500K - $1M
                                $1M - $5M
                                $5M - $10M
                                $10M - $25M
                                $25M+  ▼                     ]

  Expected Investment Range  [  dropdown:
                                Under $100K
                                $100K - $250K
                                $250K - $500K
                                $500K - $1M
                                $1M - $5M
                                $5M+  ▼                      ]

  Do you have investment accounts
  at other institutions? *   [  Yes / No  ]
  If yes, institution name   [                              ]

─────────────────────────────────────────────────────────────────

ACCREDITED INVESTOR CERTIFICATION

  I certify that I meet at least one of the following criteria
  (check all that apply): *

  ☐ Individual income exceeding $200,000 in each of the two
    most recent years, with reasonable expectation of the same
    in the current year

  ☐ Joint income with spouse/partner exceeding $300,000 in
    each of the two most recent years, with reasonable
    expectation of the same in the current year

  ☐ Net worth exceeding $1,000,000 (individually or jointly
    with spouse/partner), excluding primary residence

  ☐ Licensed securities professional holding Series 7, 65,
    or 82 in good standing

  ☐ Knowledgeable employee of a private fund

  ☐ Entity with assets exceeding $5,000,000

  ☐ None of the above — I am not an accredited investor

─────────────────────────────────────────────────────────────────

  ☑ I certify that the information provided above is true and
    accurate to the best of my knowledge. *

  [Submit Verification]     [Save & Continue Later]
```

### 3B. Field Requirements

**Required fields (marked with *):**
- Full Legal Name
- Date of Birth
- Social Security / Tax ID
- Address, City, State, Zip
- Phone Number
- Occupation
- Employer Name
- Annual Income
- Source of Funds
- Estimated Net Worth
- Accredited Investor Certification (at least one checkbox)
- Truth certification checkbox

**Optional fields:**
- Driver's License
- Country (defaults to US)
- Employer Address
- Type of Business/Industry
- Expected Investment Range
- Other institution name

### 3C. KYC Data Storage

Store all KYC data as JSONB on the `user_onboarding` table:

```ts
const kycData = {
  personal: {
    legalName: "...",
    dob: "...",
    ssn: "...",  // encrypted at rest
    driversLicense: "...",
    address: { street: "...", city: "...", state: "...", zip: "...", country: "..." },
    phone: "...",
    email: "...",
  },
  employment: {
    occupation: "...",
    employer: "...",
    employerAddress: "...",
    industry: "...",
    annualIncome: "...",
    sourceOfFunds: "...",
  },
  financial: {
    netWorth: "...",
    investmentRange: "...",
    otherInstitutions: { hasAccounts: true, institutionName: "..." },
  },
  accreditation: {
    individualIncome: true,
    jointIncome: false,
    netWorthExceeds1M: true,
    licensedProfessional: false,
    knowledgeableEmployee: false,
    entityAssets: false,
    notAccredited: false,
  },
  certifiedTrue: true,
  submittedAt: "2026-04-26T12:00:00Z",
  ipAddress: "...",
};
```

**IMPORTANT — SSN Security:** The SSN field must be encrypted at rest.
Do NOT store it as plain text in the JSONB column. Either:
- Encrypt the SSN before storing in the JSONB
- Or store it in a separate encrypted column
- At minimum, mask it in any admin display (show only last 4 digits)

### 3D. Auto-Approval Logic (Beta)

For the beta, auto-approve any user who:
1. Completes all required fields
2. Checks at least one accredited investor checkbox
   (any checkbox EXCEPT "None of the above")
3. Certifies the information is true

```ts
const isAccredited = kycData.accreditation.individualIncome
  || kycData.accreditation.jointIncome
  || kycData.accreditation.netWorthExceeds1M
  || kycData.accreditation.licensedProfessional
  || kycData.accreditation.knowledgeableEmployee
  || kycData.accreditation.entityAssets;

if (isAccredited) {
  // Auto-approve
  await updateOnboarding(userId, {
    kyc_completed_at: new Date(),
    kyc_approved: true,
    kyc_approved_at: new Date(),
    kyc_approved_by: 'auto',
  });
} else {
  // Mark as completed but not approved — manual review needed
  await updateOnboarding(userId, {
    kyc_completed_at: new Date(),
    kyc_approved: false,
  });
}
```

Users who select "None of the above" see a message:
"Thank you for your submission. Your application is under review.
A member of our team will contact you within 24-48 hours."

### 3E. "Save & Continue Later"

If the user clicks "Save & Continue Later," save whatever they've
filled in so far (partial KYC data) and let them log out. Next login,
the onboarding gate sends them back to the KYC form with their
partial data pre-filled. They can complete it when ready.

### 3F. Pending Review Page

For users who completed KYC but are NOT auto-approved (they selected
"None of the above" or failed some future manual check):

```
REPRIME TERMINAL
Application Under Review

Thank you for completing your verification. Your application is
currently being reviewed by our team.

You will receive an email notification when your access is approved.
If you have questions, contact Adir Yonasi:

  📧 adir@reprime.com
  📱 WhatsApp: +972 52-482-4896

Expected review time: 24-48 hours
```

This page is a dead end — no nav, no content access. The user can
only log out and wait.

═══════════════════════════════════════════════════════════════════════════════
## 4. ADMIN — ONBOARDING MANAGEMENT
═══════════════════════════════════════════════════════════════════════════════

### 4A. User List — Onboarding Status

In the admin Users page, add onboarding status columns:

```
Name          Email              NDA      KYC      Status     Role
John Smith    john@example.com   Signed   Approved Active     Investor
Jane Doe      jane@example.com   Signed   Pending  Review     Marketplace
Bob Wilson    bob@example.com    —        —        Onboarding Investor
```

Status values:
- **Onboarding** — hasn't completed NDA yet
- **NDA Signed** — signed NDA but hasn't completed KYC
- **Review** — KYC submitted but pending manual approval
- **Active** — fully onboarded and approved

### 4B. User Detail — View KYC Data

Clicking a user in the admin shows their full onboarding record:

- NDA: signed date, legal name, company, title, IP address
- KYC: all submitted fields (SSN masked as ***-**-1234)
- Accreditation status: which boxes they checked
- Approval status: auto-approved or pending

### 4C. Manual Approval

For users in "Review" status, the admin can:
- **Approve** — sets `kyc_approved = true`, user gains access
- **Reject** — sets a rejection flag, user sees a "not approved" message
- **Request more info** — sends the user an email requesting additional
  documentation

═══════════════════════════════════════════════════════════════════════════════
## 5. EXISTING USERS — GRANDFATHERING
═══════════════════════════════════════════════════════════════════════════════

Users who already have accounts on the Terminal should NOT be forced
through onboarding on their next login. They were accepted before
this system existed.

**Migration for existing users:**

```sql
-- Set all existing users as fully onboarded
INSERT INTO user_onboarding (user_id, nda_signed_at, kyc_completed_at, kyc_approved)
SELECT id, NOW(), NOW(), TRUE
FROM terminal_users
WHERE id NOT IN (SELECT user_id FROM user_onboarding)
ON CONFLICT (user_id) DO NOTHING;
```

This marks all existing users as having completed NDA + KYC so they
skip the onboarding flow. New users created after this migration
will go through the full flow.

═══════════════════════════════════════════════════════════════════════════════
## 6. EXPLICITLY OUT OF SCOPE

- Do NOT change the deal calculation engine
- Do NOT change any deal content or metrics
- Do NOT build Stripe integration (deferred)
- Do NOT build email sending for approval notifications (manual for beta)
- Do NOT integrate with third-party KYC/AML providers
- Do NOT build document upload for KYC (just form fields for beta)
- Do NOT change the existing Data Room functionality beyond removing
  the per-deal NDA gate for users with blanket NDA

═══════════════════════════════════════════════════════════════════════════════
## 7. VERIFICATION

### NDA
- [ ] New user sees NDA screen on first login
- [ ] NDA is full-screen with no navigation
- [ ] "Blanket NDA — All Deals" is the only coverage option
- [ ] Signature fields work (name, company, title, date, preview)
- [ ] "I have read and agree" checkbox required
- [ ] Signing stores timestamp, name, IP address
- [ ] After signing, user proceeds to KYC (not to the platform)
- [ ] Returning user who already signed NDA skips this step
- [ ] Data Room no longer prompts for per-deal NDA after blanket is signed

### KYC
- [ ] KYC form renders after NDA is signed
- [ ] All required fields enforced
- [ ] Accredited investor checkboxes work
- [ ] Auto-approval triggers when accredited box is checked
- [ ] "None of the above" routes to pending review page
- [ ] "Save & Continue Later" preserves partial data
- [ ] SSN is masked/encrypted (not stored in plain text)
- [ ] After approval, user reaches their home page

### Admin
- [ ] Users list shows onboarding status
- [ ] Admin can view KYC data (SSN masked)
- [ ] Admin can manually approve/reject pending users

### Existing Users
- [ ] Existing users are grandfathered (no onboarding on next login)
- [ ] Only NEW users go through the flow

### Regression
- [ ] Existing portal pages work for grandfathered users
- [ ] No authentication flow disruption
- [ ] No TypeScript errors

═══════════════════════════════════════════════════════════════════════════════
## DELIVERABLES

1. Files modified/created with descriptions
2. DB migration SQL
3. Screenshot/description of NDA onboarding screen
4. Screenshot/description of KYC form
5. Screenshot/description of pending review page
6. Screenshot/description of admin user onboarding view
7. Auto-approval logic confirmation
8. Existing user grandfathering confirmation
9. Ambiguities encountered

Do not deploy. Local implementation for review.
