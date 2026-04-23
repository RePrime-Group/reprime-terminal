// ─────────────────────────────────────────────────────────────────────────────
// Exit Strategy math — standalone. Does NOT import deal-calculator.ts.
// The scenarios tab imports from here only. Engine-computed inputs
// (distributableCashFlow, netEquity, loanAmount, etc.) flow in as data,
// not as function calls.
// ─────────────────────────────────────────────────────────────────────────────

// Newton's method IRR solver — local copy. Matches the solver in
// deal-calculator.ts to keep scenario IRRs consistent with headline IRRs
// on the same cash flow shape. Returns percentage (e.g. 8.2 for 8.2%).
export function solveScenarioIRR(
  cashFlows: number[],
  guess = 0.10,
  maxIter = 100,
  tol = 1e-7,
): number | null {
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
    if (Math.abs(newRate - rate) < tol) return newRate * 100;
    rate = newRate;
    if (rate < -0.99 || rate > 10) return null;
  }
  return null;
}

// Remaining balance on an amortizing loan after `atYear × 12` payments.
// Formula: B(n) = L × (r^T - r^n) / (r^T - 1) where r = 1 + monthlyRate,
// T = totalPayments, n = payments made. If fully paid off (n >= T) returns 0.
export function computeRemainingBalance(
  loanAmount: number,
  annualRatePct: number,
  amortYears: number,
  atYear: number,
): number {
  if (loanAmount <= 0 || amortYears <= 0) return 0;
  const mr = annualRatePct / 100 / 12;
  if (mr <= 0) {
    // interest-free edge: straight-line amortization
    const paid = Math.max(0, Math.min(1, atYear / amortYears)) * loanAmount;
    return Math.max(0, loanAmount - paid);
  }
  const T = amortYears * 12;
  const n = Math.max(0, Math.min(T, atYear * 12));
  const rT = Math.pow(1 + mr, T);
  const rn = Math.pow(1 + mr, n);
  const bal = loanAmount * (rT - rn) / (rT - 1);
  return Math.max(0, bal);
}

// Monthly P&I on an amortizing loan.
export function computeMonthlyPI(
  loanAmount: number,
  annualRatePct: number,
  amortYears: number,
): number {
  if (loanAmount <= 0 || amortYears <= 0) return 0;
  const mr = annualRatePct / 100 / 12;
  const T = amortYears * 12;
  if (mr <= 0) return loanAmount / T;
  return loanAmount * (mr * Math.pow(1 + mr, T)) / (Math.pow(1 + mr, T) - 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sale scenarios (Conservative / Moderate / Aggressive)
// ─────────────────────────────────────────────────────────────────────────────

export interface SaleScenarioInputs {
  exitNOI: number;
  exitCapRatePct: number;
  exitYear: number;
  // Loan (senior)
  loanAmount: number;
  seniorRatePct: number;
  seniorAmortYears: number;
  // Mezzanine (optional)
  hasMezz: boolean;
  mezzAmount: number;
  mezzTermMonths: number;
  // Cash flow + equity
  distributableCashFlow: number;  // annual, from headline metrics
  equityInvested: number;         // netEquity from headline metrics
}

export interface SaleScenarioResult {
  exitValue: number;
  dispositionCosts: number;
  seniorPayoff: number;
  mezzPayoff: number;
  netProceeds: number;
  holdCashFlow: number;
  totalReturn: number;
  equityMultiple: number | null;  // null = fully financed (display ∞)
  irr: number | null;             // null = indeterminate or fully financed
  isFullyFinanced: boolean;
}

export function computeSaleScenario(inp: SaleScenarioInputs): SaleScenarioResult {
  const {
    exitNOI, exitCapRatePct, exitYear,
    loanAmount, seniorRatePct, seniorAmortYears,
    hasMezz, mezzAmount, mezzTermMonths,
    distributableCashFlow, equityInvested,
  } = inp;

  const exitValue = exitCapRatePct > 0 ? exitNOI / (exitCapRatePct / 100) : 0;
  const dispositionCosts = exitValue * 0.02;  // hardcoded 2% per spec
  const seniorPayoff = computeRemainingBalance(
    loanAmount, seniorRatePct, seniorAmortYears, exitYear,
  );
  const mezzPayoff = hasMezz && mezzTermMonths / 12 <= exitYear ? mezzAmount : 0;
  const netProceeds = exitValue - dispositionCosts - seniorPayoff - mezzPayoff;
  const holdCashFlow = distributableCashFlow * exitYear;
  const totalReturn = netProceeds + holdCashFlow;

  const isFullyFinanced = equityInvested <= 0;
  const equityMultiple = isFullyFinanced
    ? null
    : totalReturn / equityInvested;

  // IRR cash flows: -equity at t=0, distributableCF at t=1..exitYear-1,
  // distributableCF + netProceeds at t=exitYear.
  let irr: number | null = null;
  if (!isFullyFinanced && exitYear >= 1) {
    const flows: number[] = [-equityInvested];
    for (let yr = 1; yr < exitYear; yr++) flows.push(distributableCashFlow);
    flows.push(distributableCashFlow + netProceeds);
    irr = solveScenarioIRR(flows);
  }

  return {
    exitValue,
    dispositionCosts,
    seniorPayoff,
    mezzPayoff,
    netProceeds,
    holdCashFlow,
    totalReturn,
    equityMultiple,
    irr,
    isFullyFinanced,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Refinance scenario
// ─────────────────────────────────────────────────────────────────────────────

export interface RefiScenarioInputs {
  refiNOI: number;
  refiCapRatePct: number;
  refiYear: number;
  refiLTVPct: number;
  refiRatePct: number;
  refiAmortYears: number;
  // Existing senior
  existingLoanAmount: number;
  existingRatePct: number;
  existingAmortYears: number;
  // Mezz (optional)
  hasMezz: boolean;
  mezzAmount: number;
  mezzTermMonths: number;
  // Equity / CF
  distributableCashFlow: number;
  equityInvested: number;
}

export interface RefiScenarioResult {
  propertyValue: number;
  newLoan: number;
  existingSeniorPayoff: number;
  mezzPayoff: number;
  cashOut: number;
  newAnnualDS: number;
  postRefiCF: number;
  totalCapitalReturned: number;   // cashOut + pre-refi cumulative CF
  remainingEquity: number;        // original equity - cashOut
  cashOnRemainingPct: number | null;  // null if remainingEquity <= 0
}

export function computeRefinanceScenario(inp: RefiScenarioInputs): RefiScenarioResult {
  const {
    refiNOI, refiCapRatePct, refiYear, refiLTVPct, refiRatePct, refiAmortYears,
    existingLoanAmount, existingRatePct, existingAmortYears,
    hasMezz, mezzAmount, mezzTermMonths,
    distributableCashFlow, equityInvested,
  } = inp;

  const propertyValue = refiCapRatePct > 0 ? refiNOI / (refiCapRatePct / 100) : 0;
  const newLoan = propertyValue * (refiLTVPct / 100);
  const existingSeniorPayoff = computeRemainingBalance(
    existingLoanAmount, existingRatePct, existingAmortYears, refiYear,
  );
  const mezzPayoff = hasMezz && mezzTermMonths / 12 <= refiYear ? mezzAmount : 0;
  const cashOut = newLoan - existingSeniorPayoff - mezzPayoff;

  const newMonthly = computeMonthlyPI(newLoan, refiRatePct, refiAmortYears);
  const newAnnualDS = newMonthly * 12;
  const postRefiCF = refiNOI - newAnnualDS;

  const cumulativeCFPreRefi = distributableCashFlow * refiYear;
  const totalCapitalReturned = cashOut + cumulativeCFPreRefi;

  const remainingEquity = Math.max(0, equityInvested - cashOut);
  const cashOnRemainingPct = remainingEquity > 0
    ? (postRefiCF / remainingEquity) * 100
    : null;

  return {
    propertyValue,
    newLoan,
    existingSeniorPayoff,
    mezzPayoff,
    cashOut,
    newAnnualDS,
    postRefiCF,
    totalCapitalReturned,
    remainingEquity,
    cashOnRemainingPct,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensitivity helpers
// ─────────────────────────────────────────────────────────────────────────────

export function exitCapSensitivity(
  baseInputs: SaleScenarioInputs,
  deltasBps: number[] = [-50, 0, 50],
): Array<{ capRatePct: number; result: SaleScenarioResult; isBase: boolean }> {
  return deltasBps.map((bps) => {
    const capRatePct = baseInputs.exitCapRatePct + bps / 100;
    const result = computeSaleScenario({ ...baseInputs, exitCapRatePct: capRatePct });
    return { capRatePct, result, isBase: bps === 0 };
  });
}

export function refiLTVSensitivity(
  baseInputs: RefiScenarioInputs,
  ltvs: number[] = [65, 75, 80],
): Array<{ ltvPct: number; result: RefiScenarioResult; isBase: boolean }> {
  return ltvs.map((ltvPct) => ({
    ltvPct,
    result: computeRefinanceScenario({ ...baseInputs, refiLTVPct: ltvPct }),
    isBase: ltvPct === baseInputs.refiLTVPct,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters (mirror the format helpers used elsewhere — standalone so the
// exit-strategy code has no incidental dependency on capex.ts or rent-roll.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function fmtMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

export function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

// ∞ semantics for equity multiple + IRR on fully-financed deals: when the
// result is null *and* total return is positive, show ∞; otherwise N/A.
export function fmtMultiple(
  multiple: number | null | undefined,
  positiveReturn: boolean,
): string {
  if (multiple === null || multiple === undefined) {
    return positiveReturn ? '∞' : 'N/A';
  }
  if (!Number.isFinite(multiple)) return positiveReturn ? '∞' : 'N/A';
  return `${multiple.toFixed(2)}x`;
}

export function fmtIRR(
  irr: number | null | undefined,
  positiveReturn: boolean,
): string {
  if (irr === null || irr === undefined) {
    return positiveReturn ? '∞' : 'N/A';
  }
  return fmtPct(irr, 2);
}
