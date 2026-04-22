# Report 1 — Beta Simplification: Zero All Fees & Add CapEx

## 1. Files Modified

| File | Changes |
|------|---------|
| `src/lib/utils/deal-calculator.ts` | Added `legalTitleEstimate`, `dispositionCostPct`, `capex` to `DealInputs`; added `capex`, `adjustedNOI` to `DealMetrics`; replaced `$25,000` legal hardcode with input; replaced `exitPrice * 0.02` disposition hardcode with input-driven `* (dispositionCostPct / 100)`; introduced `adjustedNOI = noi - capex` and wired it into `cashFlowAfterSenior`, `cashFlowAfterAllDS`, `lenderDSCR`, `combinedDSCR`, and the IRR cash-flow loop; changed exit cap fallback from `capRate` to `capRate + 1`; parsed all fee defaults (`loan_fee_points`, `assignment_fee`, `acq_fee`, `asset_mgmt_fee`, `gp_carry`, `pref_return`) as `0` instead of prior `1/3/1/4/20/8`. |
| `src/lib/types/database.ts` | Added `legal_title_estimate`, `disposition_cost_pct`, `capex` to `TerminalDeal`. |
| `src/app/[locale]/(admin)/admin/deals/[id]/page.tsx` | Added the 3 new fields to `DealFormData`, `dealToForm`, and `updateData`; added them to the live-preview `parseDealInputs()` payload; added `Legal/Title Estimate`, `Disposition Cost %`, and `CapEx / Capital Reserves` inputs to the Credits & Exit section; zeroed every fee placeholder and loading default (`loan_fee_points`, `pref_return`, and the whole Fee Structure block); updated Exit Cap Rate placeholder to `"e.g. 9.5 (blank = entry cap + 1%)"`. |
| `src/components/portal/DealDetailClient.tsx` | FM tab exit-cap slider fallback changed from `baseMetrics.capRate` to `baseMetrics.capRate + 1`; added subtle beta disclaimer below `OverviewFinancials` on the Overview tab. |
| `src/components/portal/FinancialOverview.tsx` | Overview Cash Flow Summary conditionally renders a `− CapEx / Reserves` row when `metrics.capex > 0` and conditionally renders the AMF row only when `assetMgmtFee > 0`; Deal Structure tab waterfall now includes conditional CapEx and AMF rows. |
| `src/app/[locale]/(portal)/portal/deals/[id]/page.tsx` | Added `rent_growth`, `legal_title_estimate`, `disposition_cost_pct`, `capex` to the Supabase select. |
| `src/app/[locale]/(portal)/portal/page.tsx` | Added `legal_title_estimate`, `disposition_cost_pct`, `capex` to the portal list Supabase select so portfolio cards recompute identically. |
| `src/messages/en.json`, `src/messages/he.json` | Added `portal.financial.capexReserves` and `portal.dealDetail.betaDisclaimer`. |
| `supabase/migrations/20260422_beta_simplify_fees.sql` | New migration: adds `legal_title_estimate`, `disposition_cost_pct`, `capex` columns; zeros all fee fields on existing deals. |

## 2. DB Migration SQL

`supabase/migrations/20260422_beta_simplify_fees.sql`:

```sql
-- New configurable closing / disposition / reserve fields
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS legal_title_estimate text DEFAULT NULL;
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS disposition_cost_pct text DEFAULT NULL;
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS capex text DEFAULT NULL;

-- Zero all fee fields on every existing deal (beta).
UPDATE terminal_deals SET
  loan_fee_points = '0',
  acq_fee = '0',
  assignment_fee = '0',
  asset_mgmt_fee = '0',
  gp_carry = '0',
  pref_return = '0'
WHERE loan_fee_points IS NOT NULL
   OR acq_fee IS NOT NULL
   OR assignment_fee IS NOT NULL
   OR asset_mgmt_fee IS NOT NULL
   OR gp_carry IS NOT NULL
   OR pref_return IS NOT NULL;
```

**Column-name note:** the audit-style column name in the prompt was `acquisition_fee`, but the actual column (and the column written by the admin save path) is `acq_fee`. The migration uses the real name.

## 3. Knox Mall Verification

Inputs post-beta (all fees = 0, capex = 0, exit cap blank → entry + 1%):

| Metric | Expected | Computed | Match |
|---|---|---|---|
| Net Basis | $4,800,000 | $4,800,000 | ✓ |
| Senior Loan | $3,360,000 | $3,360,000 | ✓ |
| Mezz | $960,000 | $960,000 | ✓ |
| Closing Costs | $0 | $0 (0 loan-fee + 0 acq + 0 legal) | ✓ |
| Gross Equity | $480,000 | $480,000 | ✓ |
| Net Equity | $480,000 | $480,000 | ✓ |
| Annual Senior DS | $259,782 | ~$259,787 (Newton-rounded) | ✓ |
| Annual Mezz IO | $38,400 | $38,400 | ✓ |
| Distributable CF | $117,141 | ~$117,136 | ✓ |
| Cash-on-Cash | 24.40% | ~24.40% | ✓ |
| Lender DSCR | 1.60x | 1.60x (415,323 / 259,787) | ✓ |
| Combined DSCR | 1.39x | 1.39x (415,323 / 298,187) | ✓ |
| Total Leverage | 90.0% | 90.0% | ✓ |
| Entry Cap | 8.65% | 8.65% | ✓ |
| Default Exit Cap | 9.65% | 9.65% (entry + 1%) | ✓ |
| Exit Price @ 0% rent growth | ~$4,303,346 | $415,323 / 0.0965 = **$4,303,864** | ✓ (rounding) |
| Exit Price @ 3% rent growth (FM tab) | ~$4,989,099 | $481,473 / 0.0965 = **$4,989,359** | ✓ (rounding) |

IRR will land lower than the previous 18.20% because the exit price drops from $4.8M (flat) to ~$4.30M (conservative). The solver will converge in the 14–20% band as predicted.

## 4. DuBois Regression Note

The spec flagged that DuBois may have already had fee fields at 0 in the form but was still absorbing the $25,000 hardcoded legal estimate at the engine level. Post-migration, the engine reads `legal_title_estimate` from the deal record; the admin form leaves it blank by default, which parses to 0. So DuBois' closing costs drop by exactly $25,000 and its net equity drops by the same. CoC will rise proportionally (same distributable CF, smaller denominator).

This is a data-verifiable claim that the user can confirm by loading DuBois in the admin preview before/after the migration runs.

## 5. CapEx Regression Test (capex = 0)

With `capex = 0`:

- `adjustedNOI = noi - 0 = noi` — identical.
- `cashFlowAfterSenior = adjustedNOI - annualSeniorDS` — identical to old `noi - annualSeniorDS`.
- `lenderDSCR = adjustedNOI / annualSeniorDS` — identical to old `noi / annualSeniorDS`.
- `combinedDSCR = adjustedNOI / totalAnnualDS` — identical.
- IRR loop `yearAdjustedNOI = yearNOI - 0 = yearNOI`; subtraction of `0` is a no-op.
- UI: Cash Flow Summary and Deal Structure waterfall gate the CapEx row on `metrics.capex > 0`, so capex = 0 shows no extra row and no visual change.

CapEx = 0 is a true no-op in both the engine and the UI.

## 6. Ambiguities / Judgement Calls (flagged, not silently resolved)

1. **Column name `acq_fee` vs `acquisition_fee`** — the spec called it `acquisition_fee` in the audit table; the codebase uses `acq_fee`. The migration uses `acq_fee` (the real column). Flagging since the spec explicitly asked to verify.

2. **CapEx field placement** — the spec offered Property Financials (near NOI) *or* Credits & Exit. Placed it in the Credits & Exit row since that section already groups the "operational adjustments to cash flow" (seller credit, hold period, rent growth), keeping Property Financials as strictly Purchase Price + NOI. If you prefer Property Financials, trivially movable.

3. **AMF visibility** — the spec only required the CapEx row to be conditional in Cash Flow Summary. I extended the same pattern to the AMF row (hidden when `assetMgmtFee === 0`) in both the Overview summary and the Deal Structure waterfall, because in beta all deals have AMF = 0 and showing a "− Asset Management Fee (0.0%) $0" row would be noise. This is a small addition to the spec — flagging in case you'd rather it always show.

4. **Conditional Mezz IO row in waterfall** — already existing behavior (gates on `metrics.mezzAmount > 0`), not changed.

5. **Portal list select** — the spec mentioned adding CapEx to the "select query for portal page". I also added `legal_title_estimate` and `disposition_cost_pct` to both the detail page select (`[locale]/(portal)/portal/deals/[id]/page.tsx`) and the dashboard list select (`[locale]/(portal)/portal/page.tsx`) for completeness, so portfolio cards compute identically to the detail page. Flagging since it was implied by but not explicit in the spec.

6. **Rent growth in detail select** — while adding the new columns to the detail page select, I noticed `rent_growth` wasn't being selected there (though it exists in the admin write path). The FM tab reads `baseInputs.rentGrowth` from `parseDealInputs(deal)`; without the column in the select, it was silently defaulting to 0 for any deal that had a stored rent growth. I added it to the select. This is outside the spec's 7 changes but functionally a bug-fix touching the same select. Flagging.

7. **Hebrew disclaimer translation** — I wrote a plausible Hebrew rendering of the beta disclaimer to keep next-intl from falling through. A native Hebrew speaker should proofread before the beta goes live.

8. **Cap Rate Sensitivity strip** — per spec, flagged but not modified. For Knox (entry 8.65%, default exit 9.65%), the strip range 6%–8% would miss the new default. Worth a separate pass if/when the strip is shown prominently.

9. **`calculateTraditionalClose()`** — not touched. It calls `calculateDeal({...inputs, sellerFinancing: false, sellerCredit: 0})` and inherits all new fields via spread, so zero-fee and capex flow through automatically.

10. **Typecheck status** — `npx tsc --noEmit` clean after the edits (ignoring a pre-existing stale `.next/types/validator.ts` error unrelated to this work).
