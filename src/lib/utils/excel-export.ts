// Excel export for Financial Modeling tab.
// Builds a multi-sheet .xlsx with LIVE Excel formulas so investors can
// re-run scenarios in their own spreadsheet. Uses xlsx-js-style for
// cell-level styling (bold headers, navy/gold accents, alternating rows).

import * as XLSX from 'xlsx-js-style';
import type { DealWithDetails } from '@/lib/types/database';
import type { DealInputs, DealMetrics } from './deal-calculator';
import { calculateDeal } from './deal-calculator';

interface ModelOverrides {
  ltv: number;
  rate: number;
  holdYears: number;
  exitCap: number;
  rentGrowth: number;
}

// 0-indexed → A1-style column letter
function colLetter(n: number): string {
  let s = '';
  let v = n;
  while (v >= 0) {
    s = String.fromCharCode(65 + (v % 26)) + s;
    v = Math.floor(v / 26) - 1;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Style palette (matches the Terminal's navy / gold design)
// ---------------------------------------------------------------------------

const NAVY = '1B365D';
const GOLD = 'BC9C45';
const GOLD_BG = 'FDF8ED';
const INPUT_YELLOW = 'FFFFF0';
const ROW_ALT = 'F7F8FA';
const TEXT_DARK = '0E3470';
const TEXT_GRAY = '6B7280';
const BORDER_LIGHT = 'D1D5DB';
const GREEN = '0B8A4D';

const FMT_USD = '"$"#,##0';
const FMT_USD_PAREN = '"$"#,##0;[Red]("$"#,##0)';
const FMT_PCT = '0.00%';
const FMT_INT = '#,##0';
const FMT_X = '0.00"x"';

type CellStyle = NonNullable<XLSX.CellObject['s']>;

const STYLES = {
  title: {
    font: { bold: true, sz: 16, color: { rgb: NAVY } },
    alignment: { horizontal: 'left', vertical: 'center' },
  } satisfies CellStyle,

  sectionHeader: {
    font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: NAVY } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder(NAVY),
  } satisfies CellStyle,

  colHeader: {
    font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: NAVY } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: thinBorder(NAVY),
  } satisfies CellStyle,

  colHeaderLeft: {
    font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: NAVY } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder(NAVY),
  } satisfies CellStyle,

  label: {
    font: { sz: 10, color: { rgb: TEXT_DARK } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder(BORDER_LIGHT),
  } satisfies CellStyle,

  labelBold: {
    font: { bold: true, sz: 10, color: { rgb: TEXT_DARK } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder(BORDER_LIGHT),
  } satisfies CellStyle,

  value: {
    font: { sz: 10, color: { rgb: TEXT_DARK } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: thinBorder(BORDER_LIGHT),
  } satisfies CellStyle,

  valueBold: {
    font: { bold: true, sz: 10, color: { rgb: TEXT_DARK } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: thinBorder(BORDER_LIGHT),
  } satisfies CellStyle,

  // Input cell — light yellow with gold border (assumption cells the investor edits)
  input: {
    font: { bold: true, sz: 11, color: { rgb: NAVY } },
    fill: { patternType: 'solid', fgColor: { rgb: INPUT_YELLOW } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: thinBorder(GOLD),
  } satisfies CellStyle,

  inputLabel: {
    font: { sz: 10, color: { rgb: TEXT_DARK } },
    fill: { patternType: 'solid', fgColor: { rgb: GOLD_BG } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder(GOLD),
  } satisfies CellStyle,

  // Returns rows — gold accent for emphasis
  returnsLabel: {
    font: { bold: true, sz: 10, color: { rgb: GOLD } },
    fill: { patternType: 'solid', fgColor: { rgb: GOLD_BG } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder(GOLD),
  } satisfies CellStyle,

  returnsValue: {
    font: { bold: true, sz: 11, color: { rgb: GREEN } },
    fill: { patternType: 'solid', fgColor: { rgb: GOLD_BG } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: thinBorder(GOLD),
  } satisfies CellStyle,

  body: {
    font: { sz: 10, color: { rgb: TEXT_GRAY } },
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
  } satisfies CellStyle,
};

function thinBorder(rgb: string) {
  const side = { color: { rgb }, style: 'thin' as const };
  return { top: side, bottom: side, left: side, right: side };
}

// Row styling helpers — apply alternating shading by cloning a base style
function withFill(style: CellStyle, rgb: string): CellStyle {
  return {
    ...style,
    fill: { patternType: 'solid', fgColor: { rgb } },
  };
}

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------

function num(v: number, z?: string, s?: CellStyle): XLSX.CellObject {
  const c: XLSX.CellObject = { t: 'n', v };
  if (z) c.z = z;
  if (s) c.s = s;
  return c;
}

function txt(v: string, s?: CellStyle): XLSX.CellObject {
  const c: XLSX.CellObject = { t: 's', v };
  if (s) c.s = s;
  return c;
}

function fml(f: string, fallback: number | string, z?: string, s?: CellStyle): XLSX.CellObject {
  const c: XLSX.CellObject = {
    t: typeof fallback === 'number' ? 'n' : 's',
    v: fallback,
    f,
  };
  if (z) c.z = z;
  if (s) c.s = s;
  return c;
}

function setCell(ws: XLSX.WorkSheet, addr: string, cell: XLSX.CellObject) {
  ws[addr] = cell;
}

function recomputeRef(ws: XLSX.WorkSheet) {
  let maxRow = 0;
  let maxCol = 0;
  for (const key of Object.keys(ws)) {
    if (key.startsWith('!')) continue;
    const m = /^([A-Z]+)(\d+)$/.exec(key);
    if (!m) continue;
    const colStr = m[1];
    const row = parseInt(m[2], 10);
    let c = 0;
    for (let i = 0; i < colStr.length; i++) {
      c = c * 26 + (colStr.charCodeAt(i) - 64);
    }
    c -= 1;
    if (row > maxRow) maxRow = row;
    if (c > maxCol) maxCol = c;
  }
  ws['!ref'] = `A1:${colLetter(maxCol)}${maxRow}`;
}

function merge(ws: XLSX.WorkSheet, range: string) {
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push(XLSX.utils.decode_range(range));
}

// ---------------------------------------------------------------------------
// SHEET 1: Deal Summary (static)
// ---------------------------------------------------------------------------

function buildSummarySheet(deal: DealWithDetails, mm: DealMetrics, inputs: DealInputs): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const fullyFinanced = mm.netEquity <= 0;
  const hasMezz = inputs.sellerFinancing && mm.mezzAmount > 0;

  // Title
  setCell(ws, 'A1', txt('REPRIME TERMINAL — DEAL SUMMARY', STYLES.title));
  merge(ws, 'A1:B1');
  ws['!rows'] = [{ hpt: 28 }];

  // Helper to write a label/value pair on a given row with alternating shading
  let rowIdx = 0;
  const writeRow = (
    row: number,
    label: string,
    value: XLSX.CellObject,
    opts: { labelStyle?: CellStyle; valueStyle?: CellStyle } = {},
  ) => {
    const isAlt = rowIdx % 2 === 1;
    const lStyle = opts.labelStyle ?? (isAlt ? withFill(STYLES.label, ROW_ALT) : STYLES.label);
    const vStyle = opts.valueStyle ?? (isAlt ? withFill(STYLES.value, ROW_ALT) : STYLES.value);
    setCell(ws, `A${row}`, txt(label, lStyle));
    if (value.s == null) value.s = vStyle;
    setCell(ws, `B${row}`, value);
    rowIdx++;
  };

  const writeSectionHeader = (row: number, label: string) => {
    setCell(ws, `A${row}`, txt(label, STYLES.sectionHeader));
    setCell(ws, `B${row}`, txt('', STYLES.sectionHeader));
    merge(ws, `A${row}:B${row}`);
    rowIdx = 0; // restart alternating shading after each section
  };

  // Property section
  writeRow(3, 'Property', txt(deal.name));
  writeRow(4, 'Address', txt([deal.city, deal.state].filter(Boolean).join(', ')));
  writeRow(5, 'Property Type', txt(deal.property_type));
  writeRow(6, 'Class', txt(deal.class_type ?? '—'));
  writeRow(7, 'Square Footage', txt(deal.square_footage ?? '—'));
  writeRow(8, 'Year Built', txt(deal.year_built?.toString() ?? '—'));
  writeRow(9, 'Occupancy', txt(deal.occupancy ?? '—'));

  // Financial Summary
  writeSectionHeader(11, 'FINANCIAL SUMMARY');
  writeRow(12, 'Purchase Price', num(inputs.purchasePrice, FMT_USD));
  writeRow(13, 'Seller Credit', num(-inputs.sellerCredit, FMT_USD_PAREN));
  writeRow(14, 'Net Basis', num(mm.netBasis, FMT_USD));
  writeRow(15, 'NOI', num(inputs.noi, FMT_USD));
  writeRow(16, 'Cap Rate', num(mm.capRate / 100, FMT_PCT));

  // Capital Stack
  writeSectionHeader(18, 'CAPITAL STACK');
  let stackRow = 19;
  writeRow(stackRow++, `Senior Debt (${inputs.ltv.toFixed(1)}% LTV)`, num(mm.loanAmount, FMT_USD));
  if (hasMezz) {
    writeRow(stackRow++, `Seller Mezzanine (${inputs.mezzPercent.toFixed(1)}%)`, num(mm.mezzAmount, FMT_USD));
  }
  writeRow(stackRow++, 'Investor Equity', num(fullyFinanced ? 0 : mm.netEquity, FMT_USD));
  writeRow(
    stackRow++,
    'Total',
    num(mm.loanAmount + (hasMezz ? mm.mezzAmount : 0) + Math.max(0, mm.netEquity), FMT_USD, STYLES.valueBold),
    { labelStyle: STYLES.labelBold },
  );

  // Returns
  const returnsHeaderRow = stackRow + 1;
  writeSectionHeader(returnsHeaderRow, 'RETURNS (In-Place)');
  let rRow = returnsHeaderRow + 1;
  if (fullyFinanced) {
    setCell(ws, `A${rRow}`, txt('Cash-on-Cash', STYLES.returnsLabel));
    setCell(ws, `B${rRow}`, txt('∞', STYLES.returnsValue));
    rRow++;
  } else {
    setCell(ws, `A${rRow}`, txt('Cash-on-Cash', STYLES.returnsLabel));
    setCell(
      ws,
      `B${rRow}`,
      mm.cocReturn !== null ? num(mm.cocReturn / 100, FMT_PCT, STYLES.returnsValue) : txt('—', STYLES.returnsValue),
    );
    rRow++;
  }
  writeRow(
    rRow++,
    'Combined DSCR',
    mm.combinedDSCR > 0 ? num(mm.combinedDSCR, FMT_X) : txt('—'),
  );
  writeRow(rRow++, 'Total Leverage', num(mm.totalLeverage / 100, FMT_PCT));

  ws['!cols'] = [{ wch: 32 }, { wch: 26 }];
  recomputeRef(ws);
  return ws;
}

// ---------------------------------------------------------------------------
// SHEET 2: Cash Flow Projection (LIVE FORMULAS)
// ---------------------------------------------------------------------------

function buildProjectionSheet(
  deal: DealWithDetails,
  mm: DealMetrics,
  inputs: DealInputs,
  overrides: ModelOverrides,
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const holdYears = Math.max(1, Math.round(overrides.holdYears));
  const fullyFinanced = mm.netEquity <= 0;
  const equityCellValue = fullyFinanced ? 0 : mm.netEquity;
  const hasMezz = inputs.sellerFinancing && mm.mezzAmount > 0;
  const mezzAnnual = hasMezz ? mm.annualMezzPayment : 0;
  const mezzBalloon = hasMezz ? mm.mezzBalloon : 0;
  const yearCol = (yearIdx: number) => colLetter(yearIdx); // B = year 1
  const lastYearCol = yearCol(holdYears);

  // ---- Assumptions block ----
  setCell(ws, 'A1', txt('ASSUMPTIONS', STYLES.sectionHeader));
  setCell(ws, 'B1', txt('', STYLES.sectionHeader));
  merge(ws, 'A1:B1');

  const assumptionRows: Array<[string, XLSX.CellObject]> = [
    ['Annual Rent Growth', num(overrides.rentGrowth / 100, FMT_PCT, STYLES.input)],
    ['Exit Cap Rate', num(overrides.exitCap / 100, FMT_PCT, STYLES.input)],
    ['Hold Period (years)', num(holdYears, FMT_INT, STYLES.input)],
    ['Senior Interest Rate', num(overrides.rate / 100, FMT_PCT, STYLES.input)],
    ['Amortization (years)', num(inputs.amortYears, FMT_INT, STYLES.input)],
    ['LTV', num(overrides.ltv / 100, FMT_PCT, STYLES.input)],
    ['In-Place NOI', num(inputs.noi, FMT_USD, STYLES.input)],
    ['Net Basis', num(mm.netBasis, FMT_USD, STYLES.input)],
  ];
  assumptionRows.forEach(([label, cell], i) => {
    const r = 2 + i;
    setCell(ws, `A${r}`, txt(label, STYLES.inputLabel));
    setCell(ws, `B${r}`, cell);
  });

  // ---- Projection header (row 12) ----
  setCell(ws, 'A12', txt('PROJECTED CASH FLOW', STYLES.colHeaderLeft));
  for (let y = 1; y <= holdYears; y++) {
    setCell(ws, `${yearCol(y)}12`, txt(`Year ${y}`, STYLES.colHeader));
  }

  // Project body row helper — applies alternating shading
  const projRow = (
    row: number,
    label: string,
    perYear: (y: number, c: string) => XLSX.CellObject,
    opts: { isTotal?: boolean } = {},
  ) => {
    const isAlt = (row - 13) % 2 === 1;
    const baseLabel = opts.isTotal ? STYLES.labelBold : STYLES.label;
    const baseValue = opts.isTotal ? STYLES.valueBold : STYLES.value;
    const lStyle = isAlt && !opts.isTotal ? withFill(baseLabel, ROW_ALT) : baseLabel;
    const vStyle = isAlt && !opts.isTotal ? withFill(baseValue, ROW_ALT) : baseValue;
    setCell(ws, `A${row}`, txt(label, lStyle));
    for (let y = 1; y <= holdYears; y++) {
      const cell = perYear(y, yearCol(y));
      if (cell.s == null) cell.s = vStyle;
      setCell(ws, `${yearCol(y)}${row}`, cell);
    }
  };

  // Row 13: NOI = B8 * (1+B2)^(year-1)
  projRow(13, 'Net Operating Income', (y, c) => {
    const v = inputs.noi * Math.pow(1 + overrides.rentGrowth / 100, y - 1);
    void c;
    return fml(`B8*(1+B2)^${y - 1}`, v, FMT_USD);
  });

  // Row 14: CapEx
  projRow(14, '− CapEx / Reserves', () => num(inputs.capex ?? 0, FMT_USD));

  // Row 15: Adjusted NOI
  projRow(15, 'Adjusted NOI', (y, c) => {
    const noi = inputs.noi * Math.pow(1 + overrides.rentGrowth / 100, y - 1);
    return fml(`${c}13-${c}14`, noi - (inputs.capex ?? 0), FMT_USD);
  });

  // Row 16: Senior Debt Service = -PMT(B5/12, B6*12, B9*B7)*12 (negative outflow)
  projRow(16, '− Senior Debt Service', () => {
    return fml(`-(-PMT(B5/12,B6*12,B9*B7)*12)`, -mm.annualSeniorDS, FMT_USD_PAREN);
  });

  // Row 17: Mezz IO (constant)
  projRow(17, '− Mezzanine IO', () => num(-mezzAnnual, FMT_USD_PAREN));

  // Row 18: Distributable Cash Flow (bold)
  projRow(
    18,
    'Distributable Cash Flow',
    (y, c) => {
      const noi = inputs.noi * Math.pow(1 + overrides.rentGrowth / 100, y - 1);
      const dcf = (noi - (inputs.capex ?? 0)) - mm.annualSeniorDS - mezzAnnual;
      return fml(`${c}15+${c}16+${c}17`, dcf, FMT_USD);
    },
    { isTotal: true },
  );

  // ---- Exit analysis (last-year column only) ----
  setCell(ws, 'A20', txt('EXIT ANALYSIS', STYLES.colHeaderLeft));
  setCell(ws, `${lastYearCol}20`, txt(`Year ${holdYears}`, STYLES.colHeader));

  const exitNOI = inputs.noi * Math.pow(1 + overrides.rentGrowth / 100, holdYears);
  const exitVal = overrides.exitCap > 0 ? exitNOI / (overrides.exitCap / 100) : 0;

  setCell(ws, 'A21', txt('Exit NOI', STYLES.label));
  setCell(ws, `${lastYearCol}21`, fml(`B8*(1+B2)^B4`, exitNOI, FMT_USD, STYLES.value));

  setCell(ws, 'A22', txt('Exit Value', STYLES.labelBold));
  setCell(ws, `${lastYearCol}22`, fml(`${lastYearCol}21/B3`, exitVal, FMT_USD, STYLES.valueBold));

  setCell(ws, 'A23', txt('− Senior Payoff', STYLES.label));
  setCell(
    ws,
    `${lastYearCol}23`,
    fml(`-FV(B5/12,B4*12,-PMT(B5/12,B6*12,B9*B7),B9*B7)`, -mm.seniorPayoffAtExit, FMT_USD_PAREN, STYLES.value),
  );

  setCell(ws, 'A24', txt('− Mezz Balloon', STYLES.label));
  setCell(ws, `${lastYearCol}24`, num(-mezzBalloon, FMT_USD_PAREN, STYLES.value));

  setCell(ws, 'A25', txt('Net Sale Proceeds', STYLES.labelBold));
  setCell(
    ws,
    `${lastYearCol}25`,
    fml(
      `${lastYearCol}22+${lastYearCol}23+${lastYearCol}24`,
      exitVal - mm.seniorPayoffAtExit - mezzBalloon,
      FMT_USD,
      STYLES.valueBold,
    ),
  );

  // ---- Returns block ----
  setCell(ws, 'A27', txt('RETURNS', STYLES.colHeaderLeft));
  // Color the header row across the year columns too
  for (let y = 1; y <= holdYears; y++) {
    setCell(ws, `${yearCol(y)}27`, txt('', STYLES.colHeader));
  }

  const totalCF = mm.annualCashFlows.reduce((a, b) => a + b, 0);
  setCell(ws, 'A28', txt('Total Cash Flow (hold)', STYLES.label));
  setCell(ws, 'B28', fml(`SUM(B18:${lastYearCol}18)`, totalCF, FMT_USD, STYLES.value));

  setCell(ws, 'A29', txt('Total Return (CF + Sale)', STYLES.labelBold));
  setCell(
    ws,
    'B29',
    fml(`B28+${lastYearCol}25`, totalCF + (exitVal - mm.seniorPayoffAtExit - mezzBalloon), FMT_USD, STYLES.valueBold),
  );

  setCell(ws, 'A30', txt('Equity Invested', STYLES.label));
  setCell(ws, 'B30', num(equityCellValue, FMT_USD, STYLES.value));

  setCell(ws, 'A31', txt('Equity Multiple', STYLES.returnsLabel));
  if (fullyFinanced) {
    setCell(ws, 'B31', fml(`IF(B30>0,B29/B30,"∞")`, '∞', undefined, STYLES.returnsValue));
  } else {
    const multiple = mm.equityMultiple ?? 0;
    setCell(ws, 'B31', fml(`IF(B30>0,B29/B30,"∞")`, multiple, FMT_X, STYLES.returnsValue));
  }

  setCell(ws, 'A32', txt('IRR', STYLES.returnsLabel));

  // Hidden cash flow series for IRR (row 33)
  setCell(ws, 'A33', txt('IRR Cash Flow Series', STYLES.label));
  setCell(ws, 'B33', fml(`-B30`, -equityCellValue, FMT_USD, STYLES.value));
  for (let y = 1; y <= holdYears; y++) {
    const c = colLetter(1 + y); // C..G for year 1..5
    const noi = inputs.noi * Math.pow(1 + overrides.rentGrowth / 100, y - 1);
    const dcf = (noi - (inputs.capex ?? 0)) - mm.annualSeniorDS - mezzAnnual;
    if (y === holdYears) {
      const sale = exitVal - mm.seniorPayoffAtExit - mezzBalloon;
      setCell(ws, `${c}33`, fml(`${yearCol(y)}18+${lastYearCol}25`, dcf + sale, FMT_USD, STYLES.value));
    } else {
      setCell(ws, `${c}33`, fml(`${yearCol(y)}18`, dcf, FMT_USD, STYLES.value));
    }
  }

  const irrSeriesEnd = colLetter(1 + holdYears);
  if (fullyFinanced) {
    setCell(ws, 'B32', fml(`IFERROR(IRR(B33:${irrSeriesEnd}33),"∞")`, '∞', undefined, STYLES.returnsValue));
  } else {
    const irrVal = mm.irr !== null ? mm.irr / 100 : 0;
    setCell(ws, 'B32', fml(`IFERROR(IRR(B33:${irrSeriesEnd}33),"∞")`, irrVal, FMT_PCT, STYLES.returnsValue));
  }

  // Column widths + freeze panes
  const cols: XLSX.ColInfo[] = [{ wch: 30 }];
  for (let i = 0; i < holdYears; i++) cols.push({ wch: 16 });
  ws['!cols'] = cols;

  (ws as unknown as { '!views': unknown })['!views'] = [
    { xSplit: 1, ySplit: 12, topLeftCell: 'B13', state: 'frozen' },
  ];

  recomputeRef(ws);
  void deal;
  return ws;
}

// ---------------------------------------------------------------------------
// SHEET 3: Sensitivity Analysis
// ---------------------------------------------------------------------------

function buildSensitivitySheet(
  mm: DealMetrics,
  inputs: DealInputs,
  overrides: ModelOverrides,
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  // ---- Section A: Cap rate sensitivity ----
  setCell(ws, 'A1', txt('SECTION A — EXIT VALUE BY EXIT CAP', STYLES.sectionHeader));
  for (let i = 1; i <= 11; i++) setCell(ws, `${colLetter(i)}1`, txt('', STYLES.sectionHeader));
  merge(ws, `A1:${colLetter(11)}1`);

  setCell(ws, 'A2', txt('Exit Cap Rate', STYLES.colHeaderLeft));
  setCell(ws, 'A3', txt('Exit Value', STYLES.labelBold));

  const caps = [0.06, 0.065, 0.07, 0.075, 0.08, 0.085, 0.09, 0.095, 0.10, 0.11, 0.12];
  const exitNOI = inputs.noi * Math.pow(1 + overrides.rentGrowth / 100, Math.max(1, Math.round(overrides.holdYears)));
  const lastYearCol = colLetter(Math.max(1, Math.round(overrides.holdYears)));
  caps.forEach((cap, i) => {
    const c = colLetter(1 + i);
    setCell(ws, `${c}2`, num(cap, FMT_PCT, STYLES.colHeader));
    setCell(
      ws,
      `${c}3`,
      fml(`'Cash Flow Projection'!${lastYearCol}21/${c}2`, exitNOI / cap, FMT_USD, STYLES.value),
    );
  });

  // ---- Section B: CoC matrix ----
  setCell(ws, 'A6', txt('SECTION B — CASH-ON-CASH BY LTV × RATE', STYLES.sectionHeader));
  for (let i = 1; i <= 5; i++) setCell(ws, `${colLetter(i)}6`, txt('', STYLES.sectionHeader));
  merge(ws, 'A6:F6');

  setCell(ws, 'A7', txt('LTV \\ Rate', STYLES.colHeaderLeft));

  const rates = [0.05, 0.055, 0.06, 0.065, 0.07];
  const ltvs = [0.60, 0.65, 0.70, 0.75, 0.80];

  rates.forEach((r, i) => {
    setCell(ws, `${colLetter(1 + i)}7`, num(r, FMT_PCT, STYLES.colHeader));
  });

  ltvs.forEach((ltv, rowIdx) => {
    const r = 8 + rowIdx;
    const isAlt = rowIdx % 2 === 1;
    const labelStyle = isAlt ? withFill(STYLES.labelBold, ROW_ALT) : STYLES.labelBold;
    const valueStyle = isAlt ? withFill(STYLES.value, ROW_ALT) : STYLES.value;
    setCell(ws, `A${r}`, num(ltv, FMT_PCT, labelStyle));
    rates.forEach((rate, colIdx) => {
      const c = colLetter(1 + colIdx);
      const noi = inputs.noi;
      const netBasis = mm.netBasis;
      const loan = netBasis * ltv;
      const equity = netBasis * (1 - ltv);
      const formula = `IFERROR(('Cash Flow Projection'!B8-(-PMT(${c}$7/12,'Cash Flow Projection'!B6*12,'Cash Flow Projection'!B9*$A${r})*12))/('Cash Flow Projection'!B9*(1-$A${r})),"∞")`;
      let computed: number | string = '∞';
      if (equity > 0) {
        const monthly = (rate / 12) * loan / (1 - Math.pow(1 + rate / 12, -inputs.amortYears * 12));
        const annualDS = monthly * 12;
        computed = (noi - annualDS) / equity;
      }
      setCell(
        ws,
        `${c}${r}`,
        fml(formula, computed, equity > 0 ? FMT_PCT : undefined, valueStyle),
      );
    });
  });

  // ---- Section C: IRR matrix (static — labeled accordingly) ----
  setCell(ws, 'A16', txt('SECTION C — IRR BY RENT GROWTH × EXIT CAP', STYLES.sectionHeader));
  for (let i = 1; i <= 6; i++) setCell(ws, `${colLetter(i)}16`, txt('', STYLES.sectionHeader));
  merge(ws, 'A16:G16');

  setCell(
    ws,
    'A17',
    txt(
      '(Computed at export — change assumptions on Cash Flow Projection sheet for live recalculation)',
      STYLES.body,
    ),
  );
  merge(ws, 'A17:G17');

  setCell(ws, 'A18', txt('Rent Growth \\ Exit Cap', STYLES.colHeaderLeft));

  const exitCaps = [0.07, 0.08, 0.09, 0.10, 0.11, 0.12];
  const growths = [0.0, 0.01, 0.02, 0.03, 0.04, 0.05];

  exitCaps.forEach((ec, i) => {
    setCell(ws, `${colLetter(1 + i)}18`, num(ec, FMT_PCT, STYLES.colHeader));
  });

  growths.forEach((g, rowIdx) => {
    const r = 19 + rowIdx;
    const isAlt = rowIdx % 2 === 1;
    const labelStyle = isAlt ? withFill(STYLES.labelBold, ROW_ALT) : STYLES.labelBold;
    const valueStyle = isAlt ? withFill(STYLES.value, ROW_ALT) : STYLES.value;
    setCell(ws, `A${r}`, num(g, FMT_PCT, labelStyle));
    exitCaps.forEach((ec, colIdx) => {
      const c = colLetter(1 + colIdx);
      const scenarioInputs: DealInputs = {
        ...inputs,
        rentGrowth: g * 100,
        exitCapRate: ec * 100,
        ltv: overrides.ltv,
        interestRate: overrides.rate,
        holdPeriodYears: Math.max(1, Math.round(overrides.holdYears)),
      };
      const scenarioMM = calculateDeal(scenarioInputs);
      if (scenarioMM.netEquity <= 0) {
        setCell(ws, `${c}${r}`, txt(scenarioMM.distributableCashFlow > 0 ? '∞' : 'N/A', valueStyle));
      } else if (scenarioMM.irr === null) {
        setCell(ws, `${c}${r}`, txt('N/A', valueStyle));
      } else {
        setCell(ws, `${c}${r}`, num(scenarioMM.irr / 100, FMT_PCT, valueStyle));
      }
    });
  });

  // Column widths
  const cols: XLSX.ColInfo[] = [{ wch: 28 }];
  for (let i = 1; i < 12; i++) cols.push({ wch: 14 });
  ws['!cols'] = cols;

  recomputeRef(ws);
  return ws;
}

// ---------------------------------------------------------------------------
// SHEET 4: Assumptions & Disclaimer
// ---------------------------------------------------------------------------

function buildDisclaimerSheet(
  deal: DealWithDetails,
  inputs: DealInputs,
  mm: DealMetrics,
  overrides: ModelOverrides,
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const today = new Date().toISOString().slice(0, 10);
  const hasMezz = inputs.sellerFinancing && mm.mezzAmount > 0;

  setCell(ws, 'A1', txt('REPRIME TERMINAL — FINANCIAL MODEL', STYLES.title));
  setCell(ws, 'A2', txt(`Property: ${deal.name}`, STYLES.body));
  setCell(ws, 'A3', txt(`Generated: ${today}`, STYLES.body));

  setCell(ws, 'A5', txt('ASSUMPTIONS USED', STYLES.sectionHeader));

  const assumpLines = [
    `Rent Growth: ${overrides.rentGrowth.toFixed(2)}% (adjustable on Cash Flow Projection sheet)`,
    `Exit Cap Rate: ${overrides.exitCap.toFixed(2)}% (adjustable)`,
    `Hold Period: ${Math.round(overrides.holdYears)} years (adjustable)`,
    `Senior Debt: ${overrides.ltv.toFixed(1)}% LTV at ${overrides.rate.toFixed(2)}%, ${inputs.amortYears}yr amortization`,
  ];
  if (hasMezz) {
    assumpLines.push(`Mezzanine: ${inputs.mezzPercent.toFixed(1)}% at ${inputs.mezzRate.toFixed(2)}% IO`);
  }
  assumpLines.push(`CapEx Reserves: $${(inputs.capex ?? 0).toLocaleString()}/year`);

  assumpLines.forEach((line, i) => {
    setCell(ws, `A${6 + i}`, txt(line, STYLES.label));
  });

  const discRow = 6 + assumpLines.length + 1;
  setCell(ws, `A${discRow}`, txt('DISCLAIMER', STYLES.sectionHeader));

  const disclaimerText =
    'Beta: Returns shown reflect property-level economics. Closing costs, disposition fees, and ' +
    'sponsor economics are not included in this projection. Final offering terms may include additional ' +
    'costs that affect investor returns.\n\n' +
    'This financial model is provided for informational purposes only and does not constitute an offer ' +
    'to sell or solicitation of an offer to buy any security. All investments involve risk. Past ' +
    'performance is not indicative of future results.';

  setCell(ws, `A${discRow + 1}`, txt(disclaimerText, STYLES.body));
  ws['!rows'] = [];
  ws['!rows'][discRow] = { hpt: 110 };

  ws['!cols'] = [{ wch: 110 }];
  recomputeRef(ws);
  return ws;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function exportDealToExcel(
  deal: DealWithDetails,
  inputs: DealInputs,
  mm: DealMetrics,
  overrides: ModelOverrides,
): void {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildSummarySheet(deal, mm, inputs), 'Deal Summary');
  XLSX.utils.book_append_sheet(wb, buildProjectionSheet(deal, mm, inputs, overrides), 'Cash Flow Projection');
  XLSX.utils.book_append_sheet(wb, buildSensitivitySheet(mm, inputs, overrides), 'Sensitivity Analysis');
  XLSX.utils.book_append_sheet(wb, buildDisclaimerSheet(deal, inputs, mm, overrides), 'Assumptions & Disclaimer');

  const safeName = (deal.name || 'Deal').replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Deal';
  XLSX.writeFile(wb, `${safeName} — Financial Model.xlsx`);
}
