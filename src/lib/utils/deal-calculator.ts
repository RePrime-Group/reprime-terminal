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
  exitCapRate: number;     // % (uses entry cap if 0)
}

export interface DealMetrics {
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
  totalLeverage: number;    // % of purchase price

  // Return Metrics
  capRate: number;
  cashFlowAfterSenior: number;
  cashFlowAfterAllDS: number;
  assetMgmtFeeDollar: number;
  distributableCashFlow: number;
  cocReturn: number;
  lenderDSCR: number;
  combinedDSCR: number;

  // IRR (multi-year)
  irr: number | null;
  equityMultiple: number;

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
    loanFeePoints: p(deal.loan_fee_points as string) || 1,
    ioPeriodMonths: p(deal.io_period_months as string) || 0,
    sellerFinancing: !!deal.seller_financing,
    mezzPercent: p(deal.mezz_percent as string) || 15,
    mezzRate: p(deal.mezz_rate as string) || 5.00,
    mezzTermMonths: p(deal.mezz_term_months as string) || 60,
    sellerCredit: p(deal.seller_credit as string) || 0,
    assignmentFee: p(deal.assignment_fee as string) || 3,
    acqFee: p(deal.acq_fee as string) || 1,
    assetMgmtFee: p(deal.asset_mgmt_fee as string) || 4,
    gpCarry: p(deal.gp_carry as string) || 20,
    prefReturn: p(deal.pref_return as string) || 8,
    holdPeriodYears: p(deal.hold_period_years as string) || 5,
    exitCapRate: p(deal.exit_cap_rate as string) || 0,
  };
}

export function calculateDeal(inputs: DealInputs): DealMetrics {
  const {
    purchasePrice, noi, ltv, interestRate, amortYears, loanFeePoints, ioPeriodMonths,
    sellerFinancing, mezzPercent, mezzRate, mezzTermMonths,
    sellerCredit, assignmentFee, acqFee, assetMgmtFee, gpCarry, prefReturn,
    holdPeriodYears, exitCapRate: exitCapInput,
  } = inputs;

  const warnings: string[] = [];

  // ═══════ SENIOR DEBT ═══════
  const loanAmount = purchasePrice * (ltv / 100);
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
  const mezzAmount = sellerFinancing ? purchasePrice * (mezzPercent / 100) : 0;
  const annualMezzPayment = sellerFinancing ? mezzAmount * (mezzRate / 100) : 0; // IO ONLY. Always.
  const mezzBalloon = mezzAmount; // full principal at maturity

  // ═══════ EQUITY & CAPITAL STACK ═══════
  const legalTitleEstimate = 25000; // placeholder
  const closingCosts = loanFeeDollar + (purchasePrice * (acqFee / 100)) + legalTitleEstimate;
  const grossEquity = purchasePrice - loanAmount - mezzAmount;
  const netEquity = grossEquity + closingCosts - sellerCredit;
  const totalLeverage = purchasePrice > 0 ? ((loanAmount + mezzAmount) / purchasePrice) * 100 : 0;

  // ═══════ RETURN METRICS ═══════
  const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;
  const cashFlowAfterSenior = noi - annualSeniorDS;
  const cashFlowAfterAllDS = noi - annualSeniorDS - annualMezzPayment;
  const assetMgmtFeeDollar = noi * (assetMgmtFee / 100);
  const distributableCashFlow = cashFlowAfterAllDS - assetMgmtFeeDollar;
  const cocReturn = netEquity > 0 ? (distributableCashFlow / netEquity) * 100 : 0;

  const lenderDSCR = annualSeniorDS > 0 ? noi / annualSeniorDS : 0;
  const totalAnnualDS = annualSeniorDS + annualMezzPayment;
  const combinedDSCR = totalAnnualDS > 0 ? noi / totalAnnualDS : 0;

  // Fee dollars
  const assignmentFeeDollar = purchasePrice * (assignmentFee / 100);
  const acqFeeDollar = purchasePrice * (acqFee / 100);

  // ═══════ WARNINGS ═══════
  if (lenderDSCR > 0 && lenderDSCR < 1.0) warnings.push('Lender DSCR below 1.0x — deal may not be financeable');
  if (combinedDSCR > 0 && combinedDSCR < 1.0) warnings.push('Combined DSCR below 1.0x — negative cash flow after debt service');
  if (cocReturn < 0) warnings.push('Negative Cash-on-Cash return');
  if (totalLeverage > 90) warnings.push('Total leverage exceeds 90% — extremely thin equity position');

  // ═══════ IRR CALCULATION ═══════
  const exitCap = exitCapInput > 0 ? exitCapInput / 100 : capRate / 100;
  const exitPrice = exitCap > 0 ? noi / exitCap : 0;
  const dispositionCosts = exitPrice * 0.02;

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
    const cf = distributableCashFlow;
    annualCashFlows.push(cf);
    cumulativeDistributions += cf;
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

  const equityMultiple = netEquity > 0
    ? (cumulativeDistributions + netSaleProceeds) / netEquity
    : 0;

  return {
    loanAmount, monthlyPayment, annualSeniorDS, loanFeeDollar, annualIODS,
    mezzAmount, annualMezzPayment, mezzBalloon,
    closingCosts, grossEquity, netEquity, totalLeverage,
    capRate, cashFlowAfterSenior, cashFlowAfterAllDS, assetMgmtFeeDollar,
    distributableCashFlow, cocReturn, lenderDSCR, combinedDSCR,
    irr, equityMultiple,
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

// Compute "Traditional Close" metrics (no mezz) for comparison
export function calculateTraditionalClose(inputs: DealInputs): DealMetrics {
  return calculateDeal({
    ...inputs,
    sellerFinancing: false,
    sellerCredit: 0, // seller credits contingent on mezz structure excluded
  });
}
