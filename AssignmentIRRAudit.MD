# Audit: Assignment Fee IRR — Springfield ($18M)

**Reported:** Springfield Option A "Projected IRR" displayed **16.27%**.
Independent verification expected **~20.36%**.

**Verdict:** Bug confirmed in `src/lib/utils/deal-calculator.ts`. The Assignment-scenario IRR shares the same `annualCashFlows` array and the same `netSaleProceeds` as the GP/LP IRR. As a result it is contaminated by three GP-only fees that should not apply to an Assignment buyer. With those stripped, IRR = **20.36%**, matching independent verification.

---

## 1. Where Assignment IRR is computed

[src/lib/utils/deal-calculator.ts:296-304](src/lib/utils/deal-calculator.ts#L296-L304)

```ts
// Assignment IRR: same deal but assignment fee deducted from Year 0 equity
const assignmentFeeDollarCalc = purchasePrice * (assignmentFee / 100);
const assignmentEquity = netEquity + assignmentFeeDollarCalc; // fee increases investor outlay
const assignmentCashFlows = [-assignmentEquity, ...annualCashFlows.slice(0, -1)];
if (annualCashFlows.length > 0) {
  assignmentCashFlows.push(annualCashFlows[annualCashFlows.length - 1] + netSaleProceeds);
}
const assignmentIRR = solveIRR(assignmentCashFlows);
```

The IRR solver itself ([deal-calculator.ts:327-357](src/lib/utils/deal-calculator.ts#L327-L357)) is sound — Newton's method, returns null on non-convergence. **The bug is in the inputs, not the solver.**

The displayed value is `feeAdjustedMetrics.assignmentIRR` ([DealDetailClient.tsx:3508](src/components/portal/DealDetailClient.tsx#L3508)) which comes from `calculateDeal(feeAdjustedInputs)` ([DealDetailClient.tsx:2271-2282](src/components/portal/DealDetailClient.tsx#L2271-L2282)). `feeAdjustedInputs` overlays REPRIME's resolved fees (assignmentFee 3, acqFee 2, AMF 1.5, gpCarry 20, prefReturn 8) onto the deal's stored inputs.

## 2. Springfield runtime values (pulled from `terminal_deals` via service-role)

| Input | Value |
|---|---|
| Purchase Price | $18,000,000 |
| NOI | $1,833,349 |
| LTV | 70% |
| Interest Rate | 6.55% |
| Amort | 25 yr |
| IO | 0 mo |
| Mezz | none (`seller_financing=false`) |
| Hold | 5 yr |
| Exit Cap | 9% |
| Rent Growth | 0% |
| **Stored fees** | all 0 (deal-level) |
| **REPRIME standard fees overlaid** | assignmentFee 3, acqFee 2, AMF 1.5, gpCarry 20, prefReturn 8 |

### Property-level (no fees) — the headline metrics

| Metric | Value |
|---|---|
| Cap Rate | 10.19% |
| Loan Amount | $12,600,000 |
| Annual Senior DS | $1,025,642 |
| Net Equity | $5,400,000 |
| Distributable CF | $807,707 |
| CoC | 14.96% |
| IRR | **23.25%** |
| Exit Price | $20,370,544 |
| Senior Payoff @ Exit | $11,418,562 |
| Net Sale Proceeds | $8,951,982 |

### Fee-adjusted (REPRIME standard fees) — what the cards display

| Metric | Value |
|---|---|
| Net Equity (with acq fee) | $5,760,000 |
| Acq Fee | $360,000 |
| Assignment Fee | $540,000 |
| AMF / yr | $27,500 |
| Annual CF (after AMF) | $780,207 |
| Net Sale Proceeds (after GP carry) | $7,994,179 |
| **GP/LP IRR** | **18.87%** ✓ |
| **Assignment IRR (current)** | **16.27%** ← bug |
| **Assignment IRR (after fix)** | **20.36%** ← matches independent verification |

## 3. Cash flow arrays passed to the solver

### GP/LP IRR (correct — 18.87%)
```
Y0  -$5,760,000   (equity + 2% acq fee)
Y1  +$780,207     (NOI - DS - 1.5% AMF)
Y2  +$780,207
Y3  +$780,207
Y4  +$780,207
Y5  +$8,774,386   (= $780,207 + $7,994,179 net sale)
IRR = 18.87%
```

### Assignment IRR — current engine (16.27% — wrong)
```
Y0  -$6,300,000   ← contains BOTH acq fee AND assignment fee
Y1  +$780,207     ← AMF deducted (shouldn't be)
Y2  +$780,207     ← AMF deducted
Y3  +$780,207     ← AMF deducted
Y4  +$780,207     ← AMF deducted
Y5  +$8,774,386   ← GP carry deducted from exit proceeds (shouldn't be)
IRR = 16.27%
```

### Assignment IRR — corrected (20.36%)
```
Y0  -$5,940,000   (= $5,400,000 base equity + $540,000 assignment fee)
Y1  +$807,707     (no AMF)
Y2  +$807,707
Y3  +$807,707
Y4  +$807,707
Y5  +$9,759,689   (= $807,707 + $8,951,982 gross sale proceeds, no GP carry)
IRR = 20.36%
```

## 4. Three contaminations (in dollars, Springfield)

| Bug | $ Impact | Mechanism |
|---|---|---|
| 1. Acq fee in Year 0 equity | +$360,000 outflow | `assignmentEquity = netEquity + assignmentFeeDollarCalc` — but `netEquity` already includes `closingCosts` which already includes `purchasePrice * (acqFee/100)` ([deal-calculator.ts:197](src/lib/utils/deal-calculator.ts#L197)). The acq fee is a sponsor fee, not paid by an Assignment buyer. |
| 2. AMF in annual CF | -$27,500/yr | `annualCashFlows` is built once at [deal-calculator.ts:268-279](src/lib/utils/deal-calculator.ts#L268-L279) with `- (yearNOI * (assetMgmtFee / 100))`. Both `irr` and `assignmentIRR` reuse this same array. AMF is a GP/sponsor fee that doesn't exist in the Assignment scenario. |
| 3. GP carry in exit proceeds | -$957,803 at Y5 | `netSaleProceeds = grossSaleProceeds - gpShare` ([deal-calculator.ts:287](src/lib/utils/deal-calculator.ts#L287)). Both IRRs reuse `netSaleProceeds`. There's no GP carry in the Assignment scenario — there's no GP. |

Together these three contaminations push 20.36% → 16.27%.

## 5. GP/LP cash flow waterfall (correct — confirmation)

The user's expected GP/LP construction matches the engine output exactly:

| Spec | Engine | ✓ |
|---|---|---|
| Equity = $5,760,000 (base + 2% acq fee) | $5,760,000 | ✓ |
| Annual CF = $780,207 (base CF − 1.5% AMF) | $780,207 | ✓ |
| Exit = grossSaleProceeds − GP carry on excess above 8% pref | $7,994,179 | ✓ |
| GP/LP IRR | 18.87% | ✓ |

Carry math:
- Total profit = grossSaleProceeds + cumDistributions − netEquity
- = $8,951,982 + 5×$780,207 − $5,760,000 = $7,093,017
- Pref dollar = $5,760,000 × 8% × 5 = $2,304,000
- Excess = $7,093,017 − $2,304,000 = $4,789,017
- GP carry = 20% × $4,789,017 = **$957,803** (matches the contamination dollar in row 3 above)

## 6. Source of `solveIRR` (Newton's method)

[src/lib/utils/deal-calculator.ts:327-357](src/lib/utils/deal-calculator.ts#L327-L357)

```ts
function solveIRR(cashFlows: number[], guess = 0.10, maxIter = 100, tol = 1e-7): number | null {
  if (cashFlows.length < 2) return null;
  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0, dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const denom = Math.pow(1 + rate, t);
      npv += cashFlows[t] / denom;
      if (t > 0) dnpv -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
    }
    if (Math.abs(dnpv) < 1e-10) return null;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < tol) return newRate * 100;
    rate = newRate;
    if (rate < -0.99 || rate > 10) return null;
  }
  return null;
}
```

Solver is correct. Verified independently against the same Y0..Y5 vector → 16.27% (current) and 20.36% (corrected).

## 7. Display path (back-trace from "16.27%")

[DealDetailClient.tsx:3502-3509](src/components/portal/DealDetailClient.tsx#L3502-L3509) — Option A card:
```tsx
<div className="text-2xl font-bold text-[#0B8A4D]">
  {computed.netEquity <= 0
    ? (computed.distributableCashFlow > 0 ? '∞' : 'N/A')
    : (feeAdjustedMetrics.assignmentIRR !== null
        ? feeAdjustedMetrics.assignmentIRR.toFixed(2) + '%' : '--')}
</div>
```

`feeAdjustedMetrics = useMemo(() => calculateDeal(feeAdjustedInputs), [feeAdjustedInputs])` ([DealDetailClient.tsx:2282](src/components/portal/DealDetailClient.tsx#L2282)).

`feeAdjustedInputs` ([DealDetailClient.tsx:2271-2281](src/components/portal/DealDetailClient.tsx#L2271-L2281)) — pure spread of `dealInputs` plus the resolved fees from `effectiveDealFees` (assignmentFee, acqFee, assetMgmtFee, gpCarry, prefReturn).

For Springfield with no deal-level fee overrides, `effectiveDealFees = REPRIME_STANDARD_FEES = { assignmentFee: 3, acqFee: 2, assetMgmtFee: 1.5, gpCarry: 20, prefReturn: 8 }` ([fee-resolver.ts:11-17](src/lib/utils/fee-resolver.ts#L11-L17)).

So the chain is:
```
REPRIME_STANDARD_FEES
  → effectiveDealFees
  → feeAdjustedInputs
  → calculateDeal(feeAdjustedInputs)
  → feeAdjustedMetrics.assignmentIRR
  → "16.27%" on screen
```

## 8. Recommended fix

The Assignment IRR scenario should run with the **same waterfall as a property-level investor** (no GP/sponsor fees), then add the assignment fee to the Year 0 outflow.

**Minimal patch** ([deal-calculator.ts:297-304](src/lib/utils/deal-calculator.ts#L297-L304)):

```ts
// Assignment IRR: investor buys property at PP+assignmentFee, operates it
// directly (no AMF), and keeps full sale proceeds (no GP carry).
// Compute property-level cash flows fresh — do NOT reuse the GP/LP
// `annualCashFlows` (AMF-deducted) or `netSaleProceeds` (carry-deducted).
const assignmentFeeDollarCalc = purchasePrice * (assignmentFee / 100);

// Year 0: base equity (no acq fee) + assignment fee
const assignmentBaseEquity = grossEquity + loanFeeDollar + legalTitleEstimate;
const assignmentEquity = assignmentBaseEquity + assignmentFeeDollarCalc;

// Annual CF: NOI − DS − mezz, NO AMF
const assignmentAnnualCF: number[] = [];
for (let yr = 0; yr < holdPeriodYears; yr++) {
  const growthFactor = Math.pow(1 + (rentGrowth / 100), yr);
  const yearNOI = noi * growthFactor;
  const yearAdjustedNOI = yearNOI - capex;
  const yearSeniorDS = yr < ioYears ? annualIODS : annualSeniorDS;
  assignmentAnnualCF.push(yearAdjustedNOI - yearSeniorDS - annualMezzPayment);
}

// Exit: gross sale proceeds (no GP carry)
const assignmentExit = grossSaleProceeds; // = exitPrice − seniorPayoff − mezzPayoff − dispositionCosts

const assignmentCashFlows = [-assignmentEquity, ...assignmentAnnualCF.slice(0, -1)];
if (assignmentAnnualCF.length > 0) {
  assignmentCashFlows.push(assignmentAnnualCF[assignmentAnnualCF.length - 1] + assignmentExit);
}
const assignmentIRR = solveIRR(assignmentCashFlows);
```

Verified output for Springfield:
- Y0 = −$5,940,000
- Y1..Y4 = +$807,707 each
- Y5 = +$9,759,689 (= $807,707 + $8,951,982 gross sale proceeds)
- **IRR = 20.36%** ✓

The GP/LP IRR (18.87%) is unchanged — this fix only touches the Assignment branch.

## 9. Regression note (no other deals affected adversely)

The fix only changes the **Assignment IRR** branch when any of `acqFee`, `assetMgmtFee`, or `gpCarry` is non-zero. For deals where all three are 0 (e.g. headline property-level metrics or older test data), Assignment IRR is unchanged.
