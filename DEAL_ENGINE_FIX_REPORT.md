# Deal Metrics Engine Fix — Deliverables Report

## Summary

Fixes applied: D1 (senior debt basis), D2 (mezz basis), D10 (DSCR storage consistency), D11 (Financial Modeling tab parallel engine), D15 (parseFloat comma bug — eliminated by deleting the broken code).

Core change: Introduced `netBasis = purchasePrice - sellerCredit` as a first-class concept. All underwriting calculations now size off net basis. The Financial Modeling tab now uses the same `calculateDeal()` engine as every other surface.

---

## 1. Files Modified

| File | Changes |
|------|---------|
| `src/lib/utils/deal-calculator.ts` | **Fix 1:** Added `netBasis = purchasePrice - sellerCredit`; changed loan sizing, mezz sizing, cap rate, equity, leverage to use `netBasis`; removed double-counted `- sellerCredit` from netEquity. Added `netBasis` to `DealMetrics` interface and return object. **Fix 2:** Added optional `rentGrowth` to `DealInputs`; added to `parseDealInputs()`; updated cash flow loop to compound NOI; updated exit price to use grown NOI with explanatory comment. |
| `src/lib/types/database.ts` | **Fix 5:** Added `rent_growth: string \| null` to `TerminalDeal` interface. |
| `src/app/[locale]/(admin)/admin/deals/[id]/page.tsx` | **Fix 4:** Changed stored DSCR from `lenderDSCR` to `combinedDSCR`. **Fix 5:** Added `rent_growth` to form type, initial state, updateData, and live metrics inputs. Added input field in Credits & Exit section. |
| `src/app/[locale]/(portal)/portal/page.tsx` | **Fix 5:** Added `rent_growth` to the select query. |
| `src/components/portal/DealDetailClient.tsx` | **Fix 3:** Completely rewired `FinancialModelingTab` — deleted inline parallel calculator, replaced with `calculateDeal()` calls using slider overrides. Sliders now init from deal data. Basis display shows `netBasis`. Imported `DealInputs` type. |

---

## 2. DB Migration SQL

```sql
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS rent_growth TEXT DEFAULT NULL;
```

---

## 3. Knox Mall Verification

### Reference Case: Knox Mall Shopping Center

**Admin Inputs:**

| Input | Value |
|-------|-------|
| Purchase Price | $5,300,000 |
| NOI | $415,323 |
| Seller Credit | $500,000 |
| LTV | 70% |
| Interest Rate | 6% |
| Amortization | 25 years |
| IO Period | 0 months |
| Loan Fee | 1 point |
| Mezz | 20% @ 4%, 60 months IO |
| Asset Mgmt Fee | 4% |
| Acquisition Fee | 1% |
| Assignment Fee | 3% |
| Hold Period | 5 years |
| Exit Cap | Same as entry |
| Pref Return | 8% |
| GP Carry | 20% |
| Rent Growth | null (not set — base engine runs flat) |

### Engine Output — Admin/Overview/Card Surfaces (rentGrowth = 0%)

| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| netBasis | $4,800,000 | $4,800,000 | ✅ |
| capRate | 8.65% | 8.65% | ✅ |
| loanAmount | $3,360,000 | $3,360,000 | ✅ |
| mezzAmount | $960,000 | $960,000 | ✅ |
| annualSeniorDS | $259,782 | $259,782 | ✅ |
| annualMezzPayment | $38,400 | $38,400 | ✅ |
| totalCombinedDS | $298,182 | $298,182 | ✅ |
| grossEquity | $480,000 | $480,000 | ✅ |
| closingCosts | $111,600 | $111,600 | ✅ |
| netEquity | $591,600 | $591,600 | ✅ |
| distributableCashFlow | $100,528 | $100,528 | ✅ |
| cocReturn | 16.99% | 16.99% | ✅ |
| lenderDSCR | 1.599x | 1.599x | ✅ |
| combinedDSCR | 1.393x | 1.393x | ✅ |
| totalLeverage | 90% | 90% | ✅ |
| IRR | 18.20% | 18.20% | ✅ |
| equityMultiple | 1.94x | 1.94x | ✅ |
| exitPrice | $4,800,000 | $4,800,000 | ✅ |
| annualCashFlows | Flat $100,528 × 5 | [$100,528, $100,528, $100,528, $100,528, $100,528] | ✅ |

### Closing Costs Breakdown

| Component | Basis | Formula | Amount |
|-----------|-------|---------|--------|
| Loan origination (1pt) | Loan amount ($3,360,000) | `loanAmount × (loanFeePoints / 100)` | $33,600 |
| Acquisition fee (1%) | **Gross** purchase price ($5,300,000) | `purchasePrice × (acqFee / 100)` | $53,000 |
| Legal/title estimate | Hardcoded | `25000` | $25,000 |
| **Total** | | | **$111,600** |

### Financial Modeling Tab (rentGrowth = 3%, all other sliders at deal defaults)

| Metric | Expected Direction | Actual | Status |
|--------|-------------------|--------|--------|
| Exit Value | > $4.8M (grown NOI ÷ entry cap) | $5,564,516 | ✅ |
| Cash Flows | Growing YoY | $100,528 → $112,489 → $124,809 → $137,499 → $150,569 | ✅ |
| IRR | Higher than 18.20% base | 31.43% | ✅ |
| Equity Required | Same as base | $591,600 | ✅ |
| Annual Debt Service | Same as base | $298,182 | ✅ |
| Equity Multiple | Higher than 1.94x base | 3.12x | ✅ |

### Consistency Check: Financial Modeling Tab at 0% Rent Growth

Setting the rent growth slider to 0% on the Financial Modeling tab produces numbers **identical** to the Overview/Admin panel. This confirms there is ONE engine with NO drift between surfaces.

---

## 4. Regression Test

### Test Case: Zero Seller Credit Deal

A deal with `sellerCredit = 0` should produce **identical** output before and after the netBasis refactor, because `netBasis = purchasePrice - 0 = purchasePrice`.

**Inputs:**

| Input | Value |
|-------|-------|
| Purchase Price | $5,000,000 |
| NOI | $400,000 |
| Seller Credit | $0 |
| LTV | 70% |
| Interest Rate | 6% |
| Amortization | 25 years |
| Mezz | 15% @ 5%, 60 months |
| Seller Financing | true |
| All other params | Standard defaults |

**Results:**

```
PRE-FIX:  loan=3500000 mezz=750000 cap=8.0000% ds=270606.59 equity=860000 dcf=75893.41 coc=8.8248% irr=10.8259% em=1.5654x
POST-FIX: loan=3500000 mezz=750000 cap=8.0000% ds=270606.59 equity=860000 dcf=75893.41 coc=8.8248% irr=10.8259% em=1.5654x
```

**Every metric is identical.** ✅ The refactor is a no-op when seller credit is zero.

---

## 5. Before vs. After Comparison (Knox Mall)

This table shows how the seller credit bug inflated Knox Mall's metrics:

| Metric | BEFORE (buggy) | AFTER (correct) | Delta |
|--------|---------------|-----------------|-------|
| Loan Amount | $3,710,000 | $3,360,000 | -$350,000 |
| Mezz Amount | $1,060,000 | $960,000 | -$100,000 |
| Cap Rate | 7.84% | 8.65% | +0.81% |
| Net Equity | $145,100 | $591,600 | +$446,500 |
| CoC Return | **47.88%** | **16.99%** | **-30.89%** |
| IRR | **66.05%** | **18.20%** | **-47.85%** |
| Equity Multiple | **6.59x** | **1.94x** | **-4.65x** |
| Lender DSCR | 1.45x | 1.60x | +0.15x |
| Combined DSCR | 1.26x | 1.39x | +0.13x |
| Distributable CF | $69,467 | $100,528 | +$31,061 |

**Root cause:** The old code sized debt off gross purchase price ($5.3M) while subtracting the $500K seller credit from equity at the end. This created an artificially tiny equity base ($145K) with outsized debt ($4.77M total), producing absurd CoC (47.9%) and IRR (66%) numbers. The fix sizes debt off the net basis ($4.8M), producing realistic investor returns.

---

## 6. Ambiguities Encountered

### A. Acquisition Fee Basis (Deliberate — Per Spec)

The acquisition fee remains on `purchasePrice` (gross), not `netBasis`. This is per spec: "REPRIME's acq fee is on the gross transaction value." For Knox Mall: $5,300,000 × 1% = $53,000.

### B. Assignment Fee Basis (Unchanged)

The spec doesn't mention `assignmentFee`. It remains on `purchasePrice` (`assignmentFeeDollar = purchasePrice * (assignmentFee / 100)` at line 170). Assignment fees, like acq fees, are on the gross transaction value. Left unchanged.

### C. `calculateTraditionalClose` Behavior

This function passes `sellerCredit: 0` to `calculateDeal()`. After the netBasis fix, `netBasis = purchasePrice - 0 = purchasePrice`, which is correct — the traditional close comparison shows what the deal looks like at gross price without any seller credit.

### D. No Additional Parallel Calculation Paths Found

The `irr-calculator.ts` `calculateCustomIRR()` function is a linear adjustment approximation that takes the base IRR as input — not a parallel engine. No action needed.

### E. Exit NOI Convention

The exit price uses `noi × (1 + rentGrowth/100)^holdPeriodYears`, which is one growth period ahead of the final operating year's NOI. This is standard CRE underwriting practice (buyer purchases the forward income stream). A code comment was added explaining this is deliberate, not an off-by-one error.

---

## 7. What Was NOT Changed (Explicitly Out of Scope)

| Audit Item | Description | Status |
|------------|-------------|--------|
| D3 | Cap rate vs going-in yield (closing costs in cap rate basis) | Not touched |
| D4 | Hardcoded $25,000 legal/title estimate | Not touched |
| D5 | Hardcoded 2% disposition costs | Not touched |
| D6 | Exit price NOI basis (addressed partially by Fix 2's grown NOI) | Not touched beyond spec |
| D7 | Flat cash flows in base engine (base stays flat; growth only via `rentGrowth`) | Not touched beyond spec |
| D8 | Simple vs compound preferred return | Not touched |
| D9 | Single-tier vs multi-tier promote waterfall | Not touched |
| D12 | Asset management fee basis (stays on NOI) | Not touched |
| D13 | IO period not used in cash flow waterfall | Not touched |
| D14 | Mezz balloon timing edge case | Not touched |
