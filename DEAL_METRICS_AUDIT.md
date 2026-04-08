# Deal Metrics Engine — Full Diagnostic Trace

## Reference Case: Knox Mall Shopping Center

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
| Mezz | 20% of purchase price |
| Mezz Rate | 4% |
| Mezz Term | 60 months (IO) |
| Asset Mgmt Fee | 4% |
| Acquisition Fee | 1% |
| Assignment Fee | 3% |
| Hold Period | 5 years |
| Exit Cap | Same as entry |
| Pref Return | 8% |

### Engine Outputs

| Metric | Value |
|--------|-------|
| Cap Rate | 7.8% |
| CoC | 47.9% |
| IRR | 66.0% |
| Equity Multiple | 6.59x |
| Loan Amount | $3,710,000 |
| Mezz Amount | $1,060,000 |
| Net Equity | $145,100 |
| Annual Senior DS | $286,843 |
| Annual Mezz IO | $42,400 |
| Distributable CF | $69,467 |
| Lender DSCR | 1.45x |
| Combined DSCR | 1.26x |
| Total Leverage | 90% |

---

## 1. CAP RATE — 7.8%

### File & Function

`src/lib/utils/deal-calculator.ts`, line 158 — `calculateDeal()`

### Formula

```ts
const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;
```

### Input Variables

| Variable | Source |
|----------|--------|
| `purchasePrice` | DB column `purchase_price`, parsed by `parseDealInputs()` at line 95 |
| `noi` | DB column `noi`, parsed by `parseDealInputs()` at line 96 |

### Basis Used

**Gross purchase price.** Seller credit is NOT subtracted. Closing costs are NOT added.

### Verification

415,323 / 5,300,000 × 100 = **7.84%**

---

## 2. LOAN AMOUNT — $3,710,000

### File & Function

`src/lib/utils/deal-calculator.ts`, line 128 — `calculateDeal()`

### Formula

```ts
const loanAmount = purchasePrice * (ltv / 100);
```

### Input Variables

| Variable | Source |
|----------|--------|
| `purchasePrice` | DB column `purchase_price` |
| `ltv` | DB column `ltv`, default 75 if missing (line 97) |

### Basis Used

**Gross purchase price.** Not net of seller credit or closing costs.

### Verification

5,300,000 × 0.70 = **$3,710,000**

---

## 3. ANNUAL SENIOR DEBT SERVICE — $286,843

### File & Function

`src/lib/utils/deal-calculator.ts`, lines 129–139 — `calculateDeal()`

### Formula

```ts
const monthlyRate = interestRate / 100 / 12;
const numPayments = amortYears * 12;

let monthlyPayment = 0;
if (monthlyRate > 0 && numPayments > 0) {
  monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
}

const annualSeniorDS = monthlyPayment * 12;
```

### Input Variables

| Variable | Source |
|----------|--------|
| `loanAmount` | Derived: `purchasePrice * (ltv / 100)` |
| `interestRate` | DB column `interest_rate`, default 6.00 (line 98) |
| `amortYears` | DB column `amortization_years`, default 30 (line 99) |

### Plain English

Standard fully amortizing mortgage payment formula. Monthly rate = 6% / 12 = 0.5%. Number of payments = 25 × 12 = 300. Monthly P&I payment computed, then multiplied by 12 for annual.

### Verification

Standard amortization on $3,710,000 at 6%/25yr ≈ **$286,843/yr**

---

## 4. LOAN FEE — $37,100

### File & Function

`src/lib/utils/deal-calculator.ts`, line 140 — `calculateDeal()`

### Formula

```ts
const loanFeeDollar = loanAmount * (loanFeePoints / 100);
```

### Input Variables

| Variable | Source |
|----------|--------|
| `loanAmount` | Derived from purchasePrice × ltv |
| `loanFeePoints` | DB column `loan_fee_points`, default 1 (line 100) |

### Verification

3,710,000 × 0.01 = **$37,100**

---

## 5. IO DEBT SERVICE (calculated but unused in waterfall)

### File & Function

`src/lib/utils/deal-calculator.ts`, line 143 — `calculateDeal()`

### Formula

```ts
const annualIODS = ioPeriodMonths > 0 ? loanAmount * (interestRate / 100) : 0;
```

### Input Variables

| Variable | Source |
|----------|--------|
| `ioPeriodMonths` | DB column `io_period_months`, default 0 (line 101) |

### Note

This value is computed and returned in the metrics object but is **never used** in the cash flow waterfall or IRR calculation. The waterfall always uses `annualSeniorDS` (the fully amortizing payment) regardless of the IO period setting.

### Verification

IO Period = 0 months → `annualIODS = 0`

---

## 6. MEZZANINE — $1,060,000 loan, $42,400/yr IO

### File & Function

`src/lib/utils/deal-calculator.ts`, lines 146–148 — `calculateDeal()`

### Formula

```ts
const mezzAmount = sellerFinancing ? purchasePrice * (mezzPercent / 100) : 0;
const annualMezzPayment = sellerFinancing ? mezzAmount * (mezzRate / 100) : 0; // IO ONLY. Always.
const mezzBalloon = mezzAmount; // full principal at maturity
```

### Input Variables

| Variable | Source |
|----------|--------|
| `sellerFinancing` | DB column `seller_financing` (boolean), line 102 |
| `purchasePrice` | DB column `purchase_price` |
| `mezzPercent` | DB column `mezz_percent`, default 15 (line 103) |
| `mezzRate` | DB column `mezz_rate`, default 5.00 (line 104) |
| `mezzTermMonths` | DB column `mezz_term_months`, default 60 (line 105) |

### Basis Used

**Gross purchase price.** Mezzanine is always interest-only. Full balloon payment due at maturity.

### Verification

- Mezz Amount: 5,300,000 × 0.20 = **$1,060,000**
- Annual IO: 1,060,000 × 0.04 = **$42,400**
- Balloon at maturity: **$1,060,000**

---

## 7. CLOSING COSTS — $115,100

### File & Function

`src/lib/utils/deal-calculator.ts`, lines 151–152 — `calculateDeal()`

### Formula

```ts
const legalTitleEstimate = 25000; // placeholder
const closingCosts = loanFeeDollar + (purchasePrice * (acqFee / 100)) + legalTitleEstimate;
```

### Components

| Component | Basis | Formula | Amount |
|-----------|-------|---------|--------|
| Loan origination (1pt) | Loan amount | `loanAmount * (loanFeePoints / 100)` | $37,100 |
| Acquisition fee (1%) | Gross purchase price | `purchasePrice * (acqFee / 100)` | $53,000 |
| Legal/title estimate | **Hardcoded** | `25000` | $25,000 |
| **Total** | | | **$115,100** |

### Note

The $25,000 legal/title is a hardcoded placeholder. It is not parametrized in the admin UI and does not scale with deal size.

---

## 8. NET EQUITY (Investor Check Size) — $145,100

### File & Function

`src/lib/utils/deal-calculator.ts`, lines 153–154 — `calculateDeal()`

### Formula

```ts
const grossEquity = purchasePrice - loanAmount - mezzAmount;
const netEquity = grossEquity + closingCosts - sellerCredit;
```

### Step-by-Step Verification

| Step | Formula | Amount |
|------|---------|--------|
| Gross Equity | 5,300,000 − 3,710,000 − 1,060,000 | $530,000 |
| + Closing Costs | + 115,100 | $645,100 |
| − Seller Credit | − 500,000 | **$145,100** |

### Basis Used

Net equity is derived from gross purchase price minus all debt, plus closing costs, minus seller credit. Seller credit is the ONLY place where it reduces the investor's out-of-pocket cost.

---

## 9. TOTAL LEVERAGE — 90%

### File & Function

`src/lib/utils/deal-calculator.ts`, line 155 — `calculateDeal()`

### Formula

```ts
const totalLeverage = purchasePrice > 0 ? ((loanAmount + mezzAmount) / purchasePrice) * 100 : 0;
```

### Verification

(3,710,000 + 1,060,000) / 5,300,000 × 100 = **90%**

---

## 10. DISTRIBUTABLE CASH FLOW — $69,467

### File & Function

`src/lib/utils/deal-calculator.ts`, lines 158–162 — `calculateDeal()`

### Cash Flow Waterfall (Exact Order of Operations)

```
NOI                                    $415,323
  − Senior Debt Service (P&I)        −$286,843    [line 159]
  = Cash Flow After Senior             $128,480
  − Mezzanine IO Payment              −$42,400    [line 160]
  = Cash Flow After All DS              $86,080
  − Asset Mgmt Fee (4% of NOI)        −$16,613    [line 161]
  = DISTRIBUTABLE CASH FLOW             $69,467    [line 162]
```

### Formulas

```ts
const cashFlowAfterSenior = noi - annualSeniorDS;                              // line 159
const cashFlowAfterAllDS = noi - annualSeniorDS - annualMezzPayment;            // line 160
const assetMgmtFeeDollar = noi * (assetMgmtFee / 100);                         // line 161
const distributableCashFlow = cashFlowAfterAllDS - assetMgmtFeeDollar;          // line 162
```

### Key Detail

Asset management fee is computed as a **percentage of NOI** ($415,323 × 4% = $16,613), not a percentage of equity, revenue, or distributable cash flow.

---

## 11. CASH-ON-CASH RETURN — 47.9%

### File & Function

`src/lib/utils/deal-calculator.ts`, line 163 — `calculateDeal()`

### Formula

```ts
const cocReturn = netEquity > 0 ? (distributableCashFlow / netEquity) * 100 : 0;
```

### Input Variables

| Variable | Source |
|----------|--------|
| `distributableCashFlow` | Derived (see waterfall above) |
| `netEquity` | Derived (see equity section above) |

### Verification

69,467 / 145,100 × 100 = **47.87%**

### Why It's So High

The $500K seller credit shrinks the equity denominator from $645,100 to $145,100. Without seller credit, CoC would be 69,467 / 645,100 = 10.8%.

---

## 12. LENDER DSCR — 1.45x

### File & Function

`src/lib/utils/deal-calculator.ts`, line 165 — `calculateDeal()`

### Formula

```ts
const lenderDSCR = annualSeniorDS > 0 ? noi / annualSeniorDS : 0;
```

### Plain English

NOI divided by senior debt service only. Mezz payments are excluded.

### Verification

415,323 / 286,843 = **1.448x**

---

## 13. COMBINED DSCR — 1.26x

### File & Function

`src/lib/utils/deal-calculator.ts`, lines 166–167 — `calculateDeal()`

### Formula

```ts
const totalAnnualDS = annualSeniorDS + annualMezzPayment;
const combinedDSCR = totalAnnualDS > 0 ? noi / totalAnnualDS : 0;
```

### Plain English

NOI divided by total debt service (senior P&I + mezz IO).

### Verification

415,323 / (286,843 + 42,400) = 415,323 / 329,243 = **1.261x**

---

## 14. IRR — 66.0%

### File & Function

`src/lib/utils/deal-calculator.ts`, lines 179–223 — `calculateDeal()`, solver at lines 251–282

### Step 1: Exit Price

```ts
const exitCap = exitCapInput > 0 ? exitCapInput / 100 : capRate / 100;  // line 180
const exitPrice = exitCap > 0 ? noi / exitCap : 0;                       // line 181
const dispositionCosts = exitPrice * 0.02;                                // line 182
```

- Exit cap = entry cap (since exit_cap_rate input = 0, defaults to computed capRate)
- Exit price = 415,323 / 0.0784 ≈ $5,300,000 (equals purchase price when exit=entry)
- Disposition costs = 5,300,000 × 0.02 = **$106,000**

### Step 2: Senior Loan Balance at Exit

```ts
let seniorPayoffAtExit = loanAmount;
if (monthlyRate > 0 && numPayments > 0) {
  const paymentsAtExit = holdPeriodYears * 12;           // 60
  seniorPayoffAtExit = loanAmount *
    (Math.pow(1 + monthlyRate, numPayments) - Math.pow(1 + monthlyRate, paymentsAtExit)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
}
```

Standard remaining balance formula after 5 years (60 payments) of a 25-year amortizing loan.

### Step 3: Mezz Payoff at Exit

```ts
const mezzDueInHold = sellerFinancing && (mezzTermMonths / 12) <= holdPeriodYears;
const mezzPayoffAtExit = mezzDueInHold ? mezzBalloon : 0;
```

- 60 months / 12 = 5 years ≤ 5 years → **TRUE**
- Mezz payoff = **$1,060,000** (full balloon)

### Step 4: Gross Sale Proceeds

```ts
const grossSaleProceeds = exitPrice - seniorPayoffAtExit - mezzPayoffAtExit - dispositionCosts;
```

### Step 5: Annual Cash Flows (Flat — No Rent Growth)

```ts
const annualCashFlows: number[] = [];
let cumulativeDistributions = 0;

for (let yr = 0; yr < holdPeriodYears; yr++) {
  const cf = distributableCashFlow;    // SAME value every year
  annualCashFlows.push(cf);
  cumulativeDistributions += cf;
}
```

- Cash flows: [$69,467, $69,467, $69,467, $69,467, $69,467]
- Cumulative: $347,335

### Step 6: GP/LP Waterfall

```ts
const totalProfit = grossSaleProceeds + cumulativeDistributions - netEquity;
const prefReturnDollar = netEquity * (prefReturn / 100) * holdPeriodYears;  // SIMPLE interest
let gpShare = 0;
if (totalProfit > prefReturnDollar) {
  gpShare = (totalProfit - prefReturnDollar) * (gpCarry / 100);
}
const netSaleProceeds = grossSaleProceeds - gpShare;
```

- Pref return: 145,100 × 0.08 × 5 = **$58,040** (simple, not compound)
- If totalProfit > $58,040 → GP takes 20% of excess

### Step 7: IRR Cash Flow Series

```ts
const irrCashFlows = [-netEquity, ...annualCashFlows.slice(0, -1)];
if (annualCashFlows.length > 0) {
  irrCashFlows.push(annualCashFlows[annualCashFlows.length - 1] + netSaleProceeds);
}
```

| Year | Cash Flow |
|------|-----------|
| 0 | −$145,100 (equity outflow) |
| 1 | $69,467 (distributable CF) |
| 2 | $69,467 |
| 3 | $69,467 |
| 4 | $69,467 |
| 5 | $69,467 + netSaleProceeds (CF + sale proceeds net of GP carry) |

### Step 8: Newton's Method Solver

```ts
function solveIRR(cashFlows: number[], guess = 0.10, maxIter = 100, tol = 1e-7): number | null {
  if (cashFlows.length < 2) return null;
  let rate = guess;

  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dnpv = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      const denom = Math.pow(1 + rate, t);
      npv += cashFlows[t] / denom;
      if (t > 0) dnpv -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
    }

    if (Math.abs(dnpv) < 1e-10) return null;
    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < tol) {
      return newRate * 100; // return as percentage
    }

    rate = newRate;
    if (rate < -0.99 || rate > 10) return null;
  }

  return null;
}
```

| Parameter | Value |
|-----------|-------|
| Initial guess | 10% |
| Max iterations | 100 |
| Tolerance | 1e-7 |
| Bounds | -99% to 1000% |
| Return format | Percentage (rate × 100) |
| Failure mode | Returns `null` if doesn't converge or hits bounds |

### Key Characteristics

- **No rent growth** — flat NOI every year
- **No cap rate compression/expansion** — exit uses current NOI
- **Preferred return is simple interest**, not compound
- **GP carry is single-tier** — flat percentage above pref, not a promote waterfall

---

## 15. EQUITY MULTIPLE — 6.59x

### File & Function

`src/lib/utils/deal-calculator.ts`, lines 234–236 — `calculateDeal()`

### Formula

```ts
const equityMultiple = netEquity > 0
  ? (cumulativeDistributions + netSaleProceeds) / netEquity
  : 0;
```

### Plain English

Total cash returned to investors (cumulative annual distributions + net sale proceeds after GP carry) divided by initial equity investment.

---

## 16. SELLER CREDIT — Complete Trace

### Every Line That Touches `sellerCredit`

| File | Line | What Happens |
|------|------|--------------|
| `deal-calculator.ts` | 24 | Interface definition: `sellerCredit: number` (dollar amount) |
| `deal-calculator.ts` | 106 | `parseDealInputs()`: `sellerCredit: p(deal.seller_credit as string) \|\| 0` |
| `deal-calculator.ts` | 121 | Destructured from inputs into local variable |
| `deal-calculator.ts` | **154** | **THE ONLY CALCULATION LINE:** `netEquity = grossEquity + closingCosts - sellerCredit` |
| `deal-calculator.ts` | 289 | `calculateTraditionalClose()`: zeroed out with `sellerCredit: 0` |

### What Seller Credit Does NOT Affect

- Purchase price
- Debt sizing (loan amount is % of purchase price, unaffected)
- Mezzanine sizing (also % of purchase price, unaffected)
- Cap rate calculation
- NOI
- Closing cost basis

### What Seller Credit DOES Affect

- **Net equity** — reduced dollar-for-dollar
- **CoC return** — denominator is smaller, so CoC is higher
- **IRR** — Year 0 outflow is smaller, so IRR is higher
- **Equity multiple** — denominator is smaller, so EM is higher

---

## 17. WHERE METRICS ARE STORED vs. COMPUTED

### Admin Save (Persists to DB)

**File:** `src/app/[locale]/(admin)/admin/deals/[id]/page.tsx`, lines 496–504

```ts
const computedInputs = parseDealInputs(updateData as Record<string, unknown>);
const computedMetrics = calculateDeal(computedInputs);
updateData.cap_rate = computedMetrics.capRate > 0 ? computedMetrics.capRate.toFixed(2) : null;
updateData.irr = computedMetrics.irr !== null ? computedMetrics.irr.toFixed(2) : null;
updateData.coc = computedMetrics.cocReturn !== 0 ? computedMetrics.cocReturn.toFixed(2) : null;
updateData.dscr = computedMetrics.lenderDSCR > 0 ? computedMetrics.lenderDSCR.toFixed(2) : null;
updateData.equity_required = computedMetrics.netEquity > 0 ? String(Math.round(computedMetrics.netEquity)) : null;
updateData.loan_estimate = computedMetrics.loanAmount > 0 ? String(Math.round(computedMetrics.loanAmount)) : null;
```

### DB Columns Populated on Admin Save

| DB Column | Source Metric | Notes |
|-----------|--------------|-------|
| `cap_rate` | `capRate` | Stored as string with 2 decimal places |
| `irr` | `irr` | Stored as string with 2 decimal places |
| `coc` | `cocReturn` | Stored as string with 2 decimal places |
| `dscr` | **`lenderDSCR`** | **NOT combinedDSCR** |
| `equity_required` | `netEquity` | Stored as rounded integer string |
| `loan_estimate` | `loanAmount` | Stored as rounded integer string |

### All Calculation Paths

| Context | Method | File | Lines |
|---------|--------|------|-------|
| Admin save | Computed → stored in DB | `admin/deals/[id]/page.tsx` | 496–504 |
| Admin live panel | Computed on-the-fly from form state | `admin/deals/[id]/page.tsx` | 942–953 |
| Investor detail page | Computed client-side via `useMemo` | `DealDetailClient.tsx` | 1668–1669 |
| Investor portal cards | Computed server-side, DB fallback | `portal/page.tsx` | 118–139 |
| Financial Modeling tab | **Separate simplified calculator** | `DealDetailClient.tsx` | 617–642 |
| Custom Terms IRR | Adjustment formula on base IRR | `irr-calculator.ts` | 7–14 |

---

## 18. ADMIN vs. TERMINAL DRIFT ANALYSIS

### Same Engine, Same Function

The **Admin live panel** (`admin/deals/[id]/page.tsx`, lines 942–953) and the **Investor detail page** (`DealDetailClient.tsx`, lines 1668–1669) both call the identical `parseDealInputs()` + `calculateDeal()` functions from `deal-calculator.ts`. No formula divergence between these two paths.

### Portal Cards — Hybrid Path with Drift Risk

The **portal deal cards** (`portal/page.tsx`, lines 118–139) use a hybrid approach:

```ts
const inputs = parseDealInputs(deal as unknown as Record<string, unknown>);
const computed = calculateDeal(inputs);

// Use computed if valid, else fall back to DB-stored value
cap_rate: computed.capRate > 0 ? computed.capRate : dbCapRate,
irr: computed.irr !== null && computed.irr !== 0 ? computed.irr : dbIrr,
coc: computed.cocReturn !== 0 ? computed.cocReturn : dbCoc,
dscr: computed.combinedDSCR > 0 ? computed.combinedDSCR : dbDscr,
equity_required: computed.netEquity > 0 ? computed.netEquity : dbEquity,
```

**Drift risk:** If the server-side recalculation fails (missing input columns in the select query, null values, etc.), cards fall back to stale DB values. The DB stores `lenderDSCR` in the `dscr` column, but the card fallback path uses `combinedDSCR` from the fresh calculation. If the fresh calculation works, cards show combined DSCR; if it falls back, they show lender DSCR.

---

## 19. THE FINANCIAL MODELING TAB — WHY NUMBERS DIFFER

### File & Function

`src/components/portal/DealDetailClient.tsx`, lines 617–642 — `FinancialModelingTab()`

### This Is a Completely Separate Calculator

The Financial Modeling tab does **NOT** use `deal-calculator.ts`. It has its own inline formulas.

### Code

```ts
const noiNum = parseFloat(deal.noi ?? '0') || 0;
const priceNum = parseFloat(deal.purchase_price ?? '0') || 0;
const exitCapNum = parseFloat(exitCap) || 7.5;
const holdNum = parseInt(holdYears) || 5;
const growthNum = parseFloat(rentGrowth) || 3;
const ltvNum = parseFloat(ltv) || 65;
const rateNum = parseFloat(rate) || 5.5;

const futureNOI = noiNum * Math.pow(1 + growthNum / 100, holdNum);
const exitValue = futureNOI / (exitCapNum / 100);
const totalReturn = exitValue - priceNum;
const equityIn = priceNum * (1 - ltvNum / 100);
const annualDebt = priceNum * (ltvNum / 100) * (rateNum / 100);
const totalCashFlow = Array.from({ length: holdNum }, (_, i) =>
  noiNum * Math.pow(1 + growthNum / 100, i) - annualDebt
).reduce((a, b) => a + b, 0);
const equityMultiple = equityIn > 0
  ? ((totalCashFlow + exitValue - priceNum * (ltvNum / 100)) / equityIn).toFixed(2) : '0';
const irrEst = equityIn > 0
  ? (Math.pow((totalCashFlow + exitValue - priceNum * (ltvNum / 100)) / equityIn, 1 / holdNum) - 1) * 100 : 0;
```

### Feature Comparison

| Feature | Official Engine (`deal-calculator.ts`) | Financial Modeling Tab |
|---------|---------------------------------------|----------------------|
| Debt service | Full amortization P&I | **Interest-only** (`price × ltv × rate`) |
| Rent growth | None (flat NOI) | **Compound growth** (slider, default 3%) |
| Mezzanine | Yes (if seller financing enabled) | **No** |
| Seller credit | Yes ($500K) | **No** |
| GP carry | Yes (20% above pref) | **No** |
| Preferred return | Yes (8% simple) | **No** |
| Closing costs | Yes ($115K) | **No** |
| Asset mgmt fee | Yes (4% of NOI) | **No** |
| Disposition costs | Yes (2% of exit) | **No** |
| Assignment fee | Yes (3%) | **No** |
| IRR method | Newton's method (exact) | **Geometric mean** (approximation) |
| Equity basis | Net (after CC and SC) | **Gross** (`price × (1 - ltv)`) |
| Default LTV | From deal data (70%) | **65%** (hardcoded slider default) |
| Default rate | From deal data (6%) | **5.5%** (hardcoded slider default) |
| Default exit cap | From deal data or entry cap | **7.5%** (hardcoded slider default) |

### Why It Shows Equity Required $1,855,000

```ts
equityIn = priceNum * (1 - ltvNum / 100);
// = 5,300,000 * (1 - 0.65)
// = 5,300,000 * 0.35
// = $1,855,000
```

Uses the **hardcoded default LTV of 65%** and computes **gross equity only** (no mezz subtracted, no seller credit, no closing costs).

### Why It Shows Annual DS $189,475

```ts
annualDebt = priceNum * (ltvNum / 100) * (rateNum / 100);
// = 5,300,000 * 0.65 * 0.055
// = $189,475
```

Uses **interest-only** at the **default 5.5% rate** on the **default 65% LTV** loan.

The official engine shows $286,843 because it uses **fully amortizing P&I** at **6% on 70% LTV**.

---

## 20. CUSTOM TERMS IRR ADJUSTMENT

### File & Function

`src/lib/utils/irr-calculator.ts`, lines 7–14 — `calculateCustomIRR()`

### Formula

```ts
export function calculateCustomIRR(baseIRR: number, terms: CustomTerms): number {
  const adjustedIRR =
    baseIRR +
    (terms.lpSplit - 80) * 0.15 -
    (terms.acqFee - 1) * 0.8 +
    (terms.prefReturn - 8) * -0.3;

  return Math.max(0, Math.round(adjustedIRR * 100) / 100);
}
```

### Sensitivity Factors

| Input | Baseline | Effect per 1% change |
|-------|----------|---------------------|
| LP Split | 80% | +0.15% IRR per 1% increase |
| Acquisition Fee | 1% | −0.80% IRR per 1% increase |
| Preferred Return | 8% | −0.30% IRR per 1% increase |

### Usage

Used in the investor-facing "Custom Terms" tab to let investors experiment with carry/pref/acqFee sliders. Takes the official engine's IRR as the base and applies linear adjustments. Not a full recalculation — just an approximation.

---

## 21. `calculateTraditionalClose()` — Comparison Metrics

### File & Function

`src/lib/utils/deal-calculator.ts`, lines 284–291

### Formula

```ts
export function calculateTraditionalClose(inputs: DealInputs): DealMetrics {
  return calculateDeal({
    ...inputs,
    sellerFinancing: false,
    sellerCredit: 0,
  });
}
```

### Purpose

Computes the same deal but with no mezzanine and no seller credit. Used on the investor detail page to show a side-by-side "Traditional Close vs. With Seller Mezz" comparison. Called at `DealDetailClient.tsx`, line 1670.

---

# DISCREPANCY INVENTORY

Issues where the code's behavior doesn't match what a CRE underwriter would expect. No code changes proposed — inventory only.

---

### D1: Senior Debt Sized Off Gross Purchase Price

**Location:** `src/lib/utils/deal-calculator.ts`, line 128

**Code:** `loanAmount = purchasePrice * (ltv / 100)`

**Issue:** In CRE, lenders typically size the loan against the **lesser of purchase price or appraised value**, and some will argue the effective basis should be net of seller credits. Here the loan is always sized off the unadjusted gross purchase price. With a $500K seller credit, the effective purchase cost is $4.8M but the loan is still 70% of $5.3M.

---

### D2: Mezzanine Sized Off Gross Purchase Price

**Location:** `src/lib/utils/deal-calculator.ts`, line 146

**Code:** `mezzAmount = purchasePrice * (mezzPercent / 100)`

**Issue:** The total capital stack (senior + mezz) is 90% of gross PP ($4,770,000). But the $500K seller credit effectively means the deal's net cost basis is $4,800,000 — making true leverage ~99.4% of the effective cost. An underwriter would flag this as near-total leverage against the economic cost of the asset.

---

### D3: Cap Rate Doesn't Reflect Total Acquisition Cost

**Location:** `src/lib/utils/deal-calculator.ts`, line 158

**Code:** `capRate = (noi / purchasePrice) * 100`

**Issue:** Cap rate is NOI / PP. An underwriter would often compute a "going-in yield" against total cost basis (PP + closing costs), which would be lower: 415,323 / (5,300,000 + 115,100) = 7.67% vs. the reported 7.84%.

---

### D4: Hardcoded $25,000 Legal/Title Estimate

**Location:** `src/lib/utils/deal-calculator.ts`, line 151

**Code:** `const legalTitleEstimate = 25000;`

**Issue:** A fixed placeholder that doesn't scale with deal size. A $5.3M deal may have $50K+ in legal/title costs; a $50M deal would be much higher. This is not parametrized in the admin UI.

---

### D5: Hardcoded 2% Disposition Costs

**Location:** `src/lib/utils/deal-calculator.ts`, line 182

**Code:** `const dispositionCosts = exitPrice * 0.02;`

**Issue:** Not parametrized. Industry standard ranges from 1–3% depending on deal size and broker arrangement. No admin input for this.

---

### D6: Exit Price Uses Current NOI, Not Grown NOI

**Location:** `src/lib/utils/deal-calculator.ts`, line 181

**Code:** `exitPrice = noi / exitCap`

**Issue:** With 0% rent growth assumption and exit cap = entry cap, the exit price equals the purchase price exactly. A CRE underwriter would typically model at least some NOI growth (rent escalators, market rent growth) over the hold period. The Financial Modeling tab DOES model rent growth, but the official engine does not — creating an inconsistency between tabs on the same deal.

---

### D7: Flat Cash Flows — No Rent Growth in IRR Projection

**Location:** `src/lib/utils/deal-calculator.ts`, lines 203–204

**Code:** `const cf = distributableCashFlow;` (same value every year)

**Issue:** No rent escalation, no vacancy changes, no expense growth modeled. The IRR is entirely driven by leverage structure and exit, not operating performance improvement. This is a conservative assumption that may understate IRR for deals with below-market rents or contractual escalators.

---

### D8: Simple (Not Compound) Preferred Return

**Location:** `src/lib/utils/deal-calculator.ts`, line 210

**Code:** `prefReturnDollar = netEquity * (prefReturn / 100) * holdPeriodYears;`

**Issue:** This is simple interest: 145,100 × 8% × 5 = $58,040. Most institutional LP agreements use a **compounded** preferred return (8% compounded annually would be ~$68,300). Simple pref benefits the GP because less of the total profit falls below the pref hurdle, resulting in more carry to the GP.

---

### D9: Single-Tier GP Carry Instead of Promote Waterfall

**Location:** `src/lib/utils/deal-calculator.ts`, lines 212–213

**Code:**
```ts
if (totalProfit > prefReturnDollar) {
  gpShare = (totalProfit - prefReturnDollar) * (gpCarry / 100);
}
```

**Issue:** This is a single-tier carry: GP gets 20% of everything above the pref hurdle. Most institutional deals use a **multi-tier promote waterfall** (e.g., 20% carry above 8% pref IRR, 30% carry above 15% IRR, 40% above 20% IRR). The single-tier approach may not match actual partnership agreements.

---

### D10: DB `dscr` Column Stores Lender DSCR, Not Combined

**Location:** `src/app/[locale]/(admin)/admin/deals/[id]/page.tsx`, line 502

**Code:** `updateData.dscr = computedMetrics.lenderDSCR > 0 ? computedMetrics.lenderDSCR.toFixed(2) : null;`

**Issue:** Only lender DSCR (senior debt only) is persisted to the DB `dscr` column. The portal card page falls back to the DB `dscr` value if recalculation fails. If that happens, cards would show lender DSCR (1.45x) while the detail page shows combined DSCR (1.26x), creating a silent mismatch for deals with mezzanine financing.

---

### D11: Financial Modeling Tab Is a Completely Different Engine

**Location:** `src/components/portal/DealDetailClient.tsx`, lines 617–642

**Issue:** The tab uses interest-only debt service, compound rent growth, geometric-mean IRR, no mezz/fees/carry, and different default assumptions (LTV 65%, rate 5.5%, exit cap 7.5%). An investor comparing the "Deal Structure" tab numbers to the "Financial Modeling" tab numbers on the same deal will see dramatically different equity requirements, debt service, and IRR with no explanation of why they differ.

---

### D12: Asset Management Fee Basis Is NOI

**Location:** `src/lib/utils/deal-calculator.ts`, line 161

**Code:** `assetMgmtFeeDollar = noi * (assetMgmtFee / 100);`

**Issue:** In practice, asset management fees are typically charged as a percentage of **gross revenue**, **committed equity**, or **assets under management**, not NOI. Using NOI means the fee scales with net operating performance rather than the asset base. For Knox Mall: 4% of $415K NOI = $16.6K. If it were 4% of equity ($145K), it would be only $5.8K — very different impact.

---

### D13: IO Period Computed But Not Used in Cash Flow Waterfall

**Location:** `src/lib/utils/deal-calculator.ts`, line 143

**Code:** `const annualIODS = ioPeriodMonths > 0 ? loanAmount * (interestRate / 100) : 0;`

**Issue:** The IO debt service is calculated and returned in the metrics object, but the cash flow waterfall (line 159) and IRR projection (lines 203–204) always use `annualSeniorDS` (the fully amortizing payment). If a deal has a 24-month IO period, the first 2 years should have lower debt service and higher distributable CF, but the engine treats every year identically with the amortizing payment.

---

### D14: Mezz Balloon Timing Assumption

**Location:** `src/lib/utils/deal-calculator.ts`, lines 194–195

**Code:** `mezzDueInHold = sellerFinancing && (mezzTermMonths / 12) <= holdPeriodYears;`

**Issue:** For Knox Mall, 60 months / 12 = 5 years ≤ 5 year hold → TRUE. The entire $1,060,000 mezz balloon is deducted from exit proceeds. But the code doesn't model WHERE in the final year the balloon is due. If mezz matures at month 60 (beginning of year 5) and the sale closes at end of year 5, there's a 12-month gap where the mezz principal needs to be refinanced or held — this isn't modeled. Also, if mezzTermMonths were 61, the balloon would be excluded entirely (61/12 = 5.083 > 5).

---

### D15: `parseFloat` Bug in Financial Modeling Tab

**Location:** `src/components/portal/DealDetailClient.tsx`, lines 625–626

**Code:**
```ts
const noiNum = parseFloat(deal.noi ?? '0') || 0;
const priceNum = parseFloat(deal.purchase_price ?? '0') || 0;
```

**Issue:** This has the same comma-truncation bug that was previously fixed in `portal/page.tsx` with the `num()` helper. If NOI is stored as text `"591,604"` in the database, `parseFloat("591,604")` returns `591` instead of `591604`. The official engine's `p()` function (line 87–91) strips commas correctly, but the Financial Modeling tab uses raw `parseFloat`.

---

*End of audit. No files were modified.*
