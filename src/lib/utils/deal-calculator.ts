// RePrime Terminal — Financial Calculation Engine
// All metrics computed from admin inputs. Nothing hardcoded.
// When any input changes, every downstream metric recalculates.

export interface DealInputs {
  // Property Basics
  purchasePrice: number;
  noi: number;

  // Senior Debt
  ltv: number;           // % (e.g. 75)
  interestRate: number;  // % (e.g. 6.00)
  amortYears: number;    // years (e.g. 30)
  loanFeePoints: number; // points (e.g. 1)
  ioPeriodMonths: number; // months IO before amortizing (0 = fully amortizing)

  // Seller Mezzanine
  sellerFinancing: boolean;
  mezzPercent: number;   // % of purchase price (e.g. 15)
  mezzRate: number;      // % (e.g. 5.00)
  mezzTermMonths: number; // months (e.g. 60)

  // Credits
  sellerCredit: number;  // dollar amount

  // Fees
  assignmentFee: number;  // % (e.g. 3)
  acqFee: number;         // % (e.g. 1)
  assetMgmtFee: number;   // % (e.g. 4)
  gpCarry: number;        // % (e.g. 20)
  prefReturn: number;     // % (e.g. 8)

  // Hold/Exit
  holdPeriodYears: number; // years (e.g. 5)
  exitCapRate: number;     // % (blank/0 defaults to entry cap + 1%)

  // Growth
  rentGrowth?: number;     // annual % rent growth, defaults to 0

  // Closing / Disposition (beta: all optional, default 0)
  legalTitleEstimate?: number;  // flat $ estimate for legal + title at close
  dispositionCostPct?: number;  // % of exit price (e.g. 2 = 2%)

  // CapEx / Capital Reserves
  capex?: number;               // flat annual $ capital reserve, deducted from NOI
}

export interface DealMetrics {
  // Basis
  netBasis: number;         // purchasePrice - sellerCredit

  // Senior Debt
  loanAmount: number;
  monthlyPayment: number;
  annualSeniorDS: number;
  loanFeeDollar: number;
  annualIODS: number;       // if IO period > 0

  // Mezzanine
  mezzAmount: number;
  annualMezzPayment: number;
  mezzBalloon: number;

  // Equity & Capital Stack
  closingCosts: number;
  grossEquity: number;
  netEquity: number;        // investor check size
  totalLeverage: number;    // % of net basis

  // Return Metrics
  capRate: number;
  cashFlowAfterSenior: number;
  cashFlowAfterAllDS: number;
  assetMgmtFeeDollar: number;
  distributableCashFlow: number;
  // CoC is null when netEquity <= 0 (no investor equity = undefined % return).
  // UI interprets null + positive CF as an "infinite" return (fully financed deal).
  cocReturn: number | null;
  lenderDSCR: number;
  combinedDSCR: number;

  // CapEx (exposed for investor UI rendering)
  capex: number;
  adjustedNOI: number;

  // IRR (multi-year)
  irr: number | null;          // GP/LP net IRR (after all fees and carry)
  assignmentIRR: number | null; // Assignment structure IRR (net of assignment fee)
  // Equity multiple is null when netEquity <= 0 (same "∞" semantics as CoC).
  equityMultiple: number | null;

  // Fee Dollars
  assignmentFeeDollar: number;
  acqFeeDollar: number;

  // Cash Flow Projections
  annualCashFlows: number[];
  exitPrice: number;
  seniorPayoffAtExit: number;
  netSaleProceeds: number;

  // Warnings
  warnings: string[];
}

// Parse a string value to number, handling $, %, commas
function p(val: string | number | null | undefined): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.replace(/[$,%\s]/g, '')) || 0;
}

export function parseDealInputs(deal: Record<string, unknown>): DealInputs {
  return {
    purchasePrice: p(deal.purchase_price as string),
    noi: p(deal.noi as string),
    ltv: p(deal.ltv as string) || 75,
    interestRate: p(deal.interest_rate as string) || 6.00,
    amortYears: p(deal.amortization_years as string) || 30,
    loanFeePoints: p(deal.loan_fee_points as string) || 0,
    ioPeriodMonths: p(deal.io_period_months as string) || 0,
    sellerFinancing: !!deal.seller_financing,
    mezzPercent: p(deal.mezz_percent as string) || 15,
    mezzRate: p(deal.mezz_rate as string) || 5.00,
    mezzTermMonths: p(deal.mezz_term_months as string) || 60,
    sellerCredit: p(deal.seller_credit as string) || 0,
    assignmentFee: p(deal.assignment_fee as string) || 0,
    acqFee: p(deal.acq_fee as string) || 0,
    assetMgmtFee: p(deal.asset_mgmt_fee as string) || 0,
    gpCarry: p(deal.gp_carry as string) || 0,
    prefReturn: p(deal.pref_return as string) || 0,
    holdPeriodYears: p(deal.hold_period_years as string) || 5,
    exitCapRate: p(deal.exit_cap_rate as string) || 0,
    rentGrowth: p(deal.rent_growth as string) || 0,
    legalTitleEstimate: p(deal.legal_title_estimate as string) || 0,
    dispositionCostPct: p(deal.disposition_cost_pct as string) || 0,
    capex: p(deal.capex as string) || 0,
  };
}

export function calculateDeal(inputs: DealInputs): DealMetrics {
  const {
    purchasePrice, noi, ltv, interestRate, amortYears, loanFeePoints, ioPeriodMonths,
    sellerFinancing, mezzPercent, mezzRate, mezzTermMonths,
    sellerCredit, assignmentFee, acqFee, assetMgmtFee, gpCarry, prefReturn,
    holdPeriodYears, exitCapRate: exitCapInput,
    rentGrowth = 0,
    legalTitleEstimate: legalTitleEstimateInput,
    dispositionCostPct: dispositionCostPctInput,
    capex: capexInput,
  } = inputs;

  const legalTitleEstimate = legalTitleEstimateInput ?? 0;
  const dispositionCostPct = dispositionCostPctInput ?? 0;
  const capex = capexInput ?? 0;

  const warnings: string[] = [];

  // ═══════ NET BASIS ═══════
  const netBasis = purchasePrice - sellerCredit;

  // ═══════ SENIOR DEBT ═══════
  const loanAmount = netBasis * (ltv / 100);
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = amortYears * 12;

  // P&I monthly payment (amortizing)
  let monthlyPayment = 0;
  if (monthlyRate > 0 && numPayments > 0) {
    monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
  }

  const annualSeniorDS = monthlyPayment * 12;
  const loanFeeDollar = loanAmount * (loanFeePoints / 100);

  // IO debt service (if IO period specified)
  const annualIODS = ioPeriodMonths > 0 ? loanAmount * (interestRate / 100) : 0;

  // ═══════ MEZZANINE ═══════
  const mezzAmount = sellerFinancing ? netBasis * (mezzPercent / 100) : 0;
  const annualMezzPayment = sellerFinancing ? mezzAmount * (mezzRate / 100) : 0; // IO ONLY. Always.
  const mezzBalloon = mezzAmount; // full principal at maturity

  // ═══════ EQUITY & CAPITAL STACK ═══════
  const closingCosts = loanFeeDollar + (purchasePrice * (acqFee / 100)) + legalTitleEstimate;
  const grossEquity = netBasis - loanAmount - mezzAmount;
  const netEquity = grossEquity + closingCosts;
  const totalLeverage = netBasis > 0 ? ((loanAmount + mezzAmount) / netBasis) * 100 : 0;

  // ═══════ RETURN METRICS ═══════
  const capRate = netBasis > 0 ? (noi / netBasis) * 100 : 0;
  // CapEx is a fixed annual capital reserve deducted from NOI before debt service
  // and asset-level distributable cash flow. AMF is still computed on NOI (income-
  // based fee, not income-after-capex), which is correct when AMF > 0.
  const adjustedNOI = noi - capex;
  const cashFlowAfterSenior = adjustedNOI - annualSeniorDS;
  const cashFlowAfterAllDS = adjustedNOI - annualSeniorDS - annualMezzPayment;
  const assetMgmtFeeDollar = noi * (assetMgmtFee / 100);
  const distributableCashFlow = cashFlowAfterAllDS - assetMgmtFeeDollar;
  // Return null (not 0) when no investor equity is required — the UI renders
  // this as "∞" for fully-financed deals with positive cash flow.
  const cocReturn = netEquity > 0 ? (distributableCashFlow / netEquity) * 100 : null;

  const lenderDSCR = annualSeniorDS > 0 ? adjustedNOI / annualSeniorDS : 0;
  const totalAnnualDS = annualSeniorDS + annualMezzPayment;
  const combinedDSCR = totalAnnualDS > 0 ? adjustedNOI / totalAnnualDS : 0;

  // Fee dollars
  const assignmentFeeDollar = purchasePrice * (assignmentFee / 100);
  const acqFeeDollar = purchasePrice * (acqFee / 100);

  // ═══════ WARNINGS ═══════
  if (lenderDSCR > 0 && lenderDSCR < 1.0) warnings.push('Lender DSCR below 1.0x — deal may not be financeable');
  if (combinedDSCR > 0 && combinedDSCR < 1.0) warnings.push('Combined DSCR below 1.0x — negative cash flow after debt service');
  if (cocReturn !== null && cocReturn < 0) warnings.push('Negative Cash-on-Cash return');
  if (totalLeverage > 90) warnings.push('Total leverage exceeds 90% — extremely thin equity position');

  // ═══════ IRR CALCULATION ═══════
  // Default exit cap = entry cap + 1% (conservative exit assumption).
  // Explicit values override. 0/blank falls back to entry + 100 bps expansion.
  const exitCap = exitCapInput > 0 ? exitCapInput / 100 : (capRate + 1) / 100;
  // Exit NOI is one period ahead of final operating year — a buyer in
  // year 5 is purchasing the forward income stream (year 6), which is
  // standard CRE underwriting practice.
  const exitGrowthFactor = Math.pow(1 + (rentGrowth / 100), holdPeriodYears);
  const exitNOI = noi * exitGrowthFactor;
  const exitPrice = exitCap > 0 ? exitNOI / exitCap : 0;
  const dispositionCosts = exitPrice * (dispositionCostPct / 100);

  // Remaining senior loan balance after hold period
  let seniorPayoffAtExit = loanAmount;
  if (monthlyRate > 0 && numPayments > 0) {
    const paymentsAtExit = holdPeriodYears * 12;
    seniorPayoffAtExit = loanAmount *
      (Math.pow(1 + monthlyRate, numPayments) - Math.pow(1 + monthlyRate, paymentsAtExit)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
  }

  // Mezz balloon (if due within hold period)
  const mezzDueInHold = sellerFinancing && (mezzTermMonths / 12) <= holdPeriodYears;
  const mezzPayoffAtExit = mezzDueInHold ? mezzBalloon : 0;

  const grossSaleProceeds = exitPrice - seniorPayoffAtExit - mezzPayoffAtExit - dispositionCosts;

  // GP/LP waterfall
  const annualCashFlows: number[] = [];
  let cumulativeDistributions = 0;

  for (let yr = 0; yr < holdPeriodYears; yr++) {
    const growthFactor = Math.pow(1 + (rentGrowth / 100), yr);
    const yearNOI = noi * growthFactor;
    // CapEx is a flat annual amount (not grown with rents). AMF is still
    // applied to the grown yearNOI since it is an income-based fee.
    const yearAdjustedNOI = yearNOI - capex;
    const yearCashFlow = yearAdjustedNOI - annualSeniorDS - annualMezzPayment - (yearNOI * (assetMgmtFee / 100));
    annualCashFlows.push(yearCashFlow);
    cumulativeDistributions += yearCashFlow;
  }

  const totalProfit = grossSaleProceeds + cumulativeDistributions - netEquity;
  const prefReturnDollar = netEquity * (prefReturn / 100) * holdPeriodYears;
  let gpShare = 0;
  if (totalProfit > prefReturnDollar) {
    gpShare = (totalProfit - prefReturnDollar) * (gpCarry / 100);
  }
  const netSaleProceeds = grossSaleProceeds - gpShare;

  // IRR: solve for rate where NPV = 0
  const irrCashFlows = [-netEquity, ...annualCashFlows.slice(0, -1)];
  if (annualCashFlows.length > 0) {
    irrCashFlows.push(annualCashFlows[annualCashFlows.length - 1] + netSaleProceeds);
  }

  const irr = solveIRR(irrCashFlows);

  // Assignment IRR: same deal but assignment fee deducted from Year 0 equity
  const assignmentFeeDollarCalc = purchasePrice * (assignmentFee / 100);
  const assignmentEquity = netEquity + assignmentFeeDollarCalc; // fee increases investor outlay
  const assignmentCashFlows = [-assignmentEquity, ...annualCashFlows.slice(0, -1)];
  if (annualCashFlows.length > 0) {
    assignmentCashFlows.push(annualCashFlows[annualCashFlows.length - 1] + netSaleProceeds);
  }
  const assignmentIRR = solveIRR(assignmentCashFlows);

  const equityMultiple = netEquity > 0
    ? (cumulativeDistributions + netSaleProceeds) / netEquity
    : null;

  return {
    netBasis,
    loanAmount, monthlyPayment, annualSeniorDS, loanFeeDollar, annualIODS,
    mezzAmount, annualMezzPayment, mezzBalloon,
    closingCosts, grossEquity, netEquity, totalLeverage,
    capRate, cashFlowAfterSenior, cashFlowAfterAllDS, assetMgmtFeeDollar,
    distributableCashFlow, cocReturn, lenderDSCR, combinedDSCR,
    capex, adjustedNOI,
    irr, assignmentIRR, equityMultiple,
    assignmentFeeDollar, acqFeeDollar,
    annualCashFlows, exitPrice, seniorPayoffAtExit, netSaleProceeds,
    warnings,
  };
}

// Newton's method IRR solver
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

    if (Math.abs(dnpv) < 1e-10) return null; // avoid division by zero

    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < tol) {
      return newRate * 100; // return as percentage
    }

    rate = newRate;

    // Bound check
    if (rate < -0.99 || rate > 10) return null;
  }

  return null; // didn't converge
}

/**
 * Compute property-level metrics by forcing every fee input to 0 before
 * running the engine. Headline surfaces (metric strip, portal cards, admin
 * live panel, FM tab) use this so fees entered in the admin don't contaminate
 * cap rate / CoC / IRR / equity / DSCR.
 *
 * The Returns Calculator and Fee Disclosure section continue reading the deal
 * record's real fee values — this helper is display-only.
 */
export function calculatePropertyMetrics(inputs: DealInputs): DealMetrics {
  return calculateDeal({
    ...inputs,
    loanFeePoints: 0,
    acqFee: 0,
    assignmentFee: 0,
    assetMgmtFee: 0,
    gpCarry: 0,
    prefReturn: 0,
    legalTitleEstimate: 0,
    dispositionCostPct: 0,
  });
}

// Compute "Traditional Close" metrics (no mezz) for comparison — also
// property-level (no fees) so the comparison is apples-to-apples.
export function calculateTraditionalClose(inputs: DealInputs): DealMetrics {
  return calculatePropertyMetrics({
    ...inputs,
    sellerFinancing: false,
    sellerCredit: 0, // seller credits contingent on mezz structure excluded
  });
}
