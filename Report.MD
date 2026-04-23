# Report — Fee Display Separation, Closing Cost TBD, IRR Asterisk, Lender Label

## 1. Files Modified

| File | Changes |
|------|---------|
| `src/lib/utils/deal-calculator.ts` | Added `calculatePropertyMetrics()` helper that forces `loanFeePoints`, `acqFee`, `assignmentFee`, `assetMgmtFee`, `gpCarry`, `prefReturn`, `legalTitleEstimate`, `dispositionCostPct` to `0` before running the engine. `calculateTraditionalClose()` now routes through this helper so the Return Comparison table is apples-to-apples property-level on both sides. |
| `src/components/portal/DealDetailClient.tsx` | (a) `computed` is now `calculatePropertyMetrics(dealInputs)` — single source of truth for headline metrics. (b) Added `feeAdjustedMetrics = calculateDeal(dealInputs)` to feed the Returns Calculator panel, Deal Structure tab's Option A card (assignment-IRR), and Option B card (base IRR + acq/AMF dollars). (c) Added `buildIrrAssumptions()` helper and `note` prop on `MetricCard`. Metric strip IRR row now renders the "8.0% exit · 5yr hold · 1.5% growth" note (hidden when fully financed). Same note on Deal Structure Option B "Projected IRR" card. (d) Option A card's ∞/equity-zero guard added to match the metric strip behavior. |
| `src/components/portal/FinancialOverview.tsx` | (a) Capital Stack walk: "Closing Costs $0" now renders as "Est. Closing Costs TBD*" + Total with "+" suffix + gold-muted footnote. (b) Fee Disclosure section reads fee percentages from `inputs.*` (preserved real values) and computes dollars inline from `purchasePrice`, `noi`, `loanAmount` — no longer reads zeroed `metrics.assignmentFeeDollar` etc. (c) Senior Debt header: replaced the amber pill with a gold inline label `— Estimated — update when lender quote is received`, still gated on the existing `isEstimated = !debt_terms_quoted` prop. (d) Default-export fallback switched from `calculateDeal` to `calculatePropertyMetrics`. |
| `src/app/[locale]/(admin)/admin/deals/[id]/page.tsx` | Admin live panel + save path now use `calculatePropertyMetrics` — fees saved to DB don't move `cap_rate`, `coc`, `irr`, `dscr`, `equity_required`, `loan_estimate`. |
| `src/app/[locale]/(admin)/admin/deals/new/page.tsx` | New deal live preview + initial save use `calculatePropertyMetrics`. |
| `src/app/[locale]/(portal)/portal/page.tsx` | Portal dashboard cards compute via `calculatePropertyMetrics`. |
| `src/app/[locale]/(admin-preview)/admin/preview/page.tsx` | Admin-preview dashboard cards likewise. |
| `updateDealMetrics.ts` | Bulk-sync script now writes property-level metrics. |
| `src/messages/en.json` + `he.json` | Added `financial.estClosingCosts`, `financial.closingCostsFootnote`, and updated `financial.estimated` text to "Estimated — update when lender quote is received". |

## 2. Verification — End-to-End

All four changes were driven through the live UI (Chrome devtools session against admin logged in at `localhost:3000`). The test deal was **203 West Weber (DuBois)** — chosen because it has an explicit stored `exit_cap_rate=8%` and `rent_growth=1.5%` (so the IRR assumptions note has non-default values to render), and because all other deals have their fees at 0.

### Change 1 — Fee Display vs Fee Calculation Separation ✅

**Baseline** (DuBois, all fees at 0):

| Metric | Value |
|---|---|
| Cap Rate | 9.66% |
| Cash-on-Cash | 17.06% |
| IRR | 32.72% |
| Equity Multiple | 3.32x |
| Net Equity | $500,000 |
| Lender DSCR | 1.79x |
| Distributable CF | $85,286 |

**After entering fees 3% / 1% / 4% / 20% / 8% / 1pt and saving**:

| Metric | Admin Live Panel | Investor Metric Strip | Delta |
|---|---|---|---|
| Cap Rate | 9.66% | 9.66% | 0 ✅ |
| Cash-on-Cash | 17.06% | 17.06% | 0 ✅ |
| IRR | 32.72% | 32.72% | 0 ✅ |
| Equity Multiple | 3.32x | — | 0 ✅ |
| Net Equity | $500,000 | $500,000 | 0 ✅ |
| Lender DSCR | 1.79x | 1.79x | 0 ✅ |
| Distributable CF | $85,286 | — | 0 ✅ |

**Fee Disclosure section (reads real values):**
- Assignment Fee (3.0%) — $60,000 ✅
- Acquisition Fee (1.0%) — $20,000 ✅
- Asset Mgmt Fee (4.0%/yr) — $7,728/yr ✅
- GP Carry — 20% above 8% pref ✅
- Loan Origination (1 pt(s)) — $15,000 ✅

**Returns Calculator cards (fee-adjusted):**
- Option A (Assignment) Projected IRR: **23.07%** — down from 32.72% base ✅
- Option B (GP/LP) Projected IRR: **26.33%** — down from 32.72% base ✅
- Option B fee dollars now render: "ACQUISITION FEE 1 ($20,000)", "ASSET MGMT FEE 4 ($7,728/yr)" ✅
- Returns Calculator Assignment mode: 23.07% ✅

Fees were reset to 0 after verification; DuBois is now back to beta defaults.

### Change 2 — Closing Costs TBD* ✅

On DuBois Overview tab:
- Row label: "+ Est. Closing Costs"
- Value: **TBD\*** (with asterisk)
- Total Capital Required: `$2,000,000+` (with trailing `+`)
- Footnote: "\* Closing costs will be finalized during due diligence and reflected in the final offering memorandum."

When a deal has real closing costs (non-zero), the row reverts to "Closing Costs $X" and the `+` suffix is suppressed — gated on `metrics.closingCosts === 0`.

### Change 3 — IRR Assumptions Note ✅

**DuBois** (explicit exit cap 8%, rent growth 1.5%) — metric strip IRR:
```
IRR
32.72%
8.0% exit · 5yr hold · 1.5% growth
```
✅

**Deal Structure → Option B "Projected IRR"** card on DuBois:
```
PROJECTED IRR
26.33%
8.0% exit · 5yr hold · 1.5% growth
All fees included
```
✅ (fee-adjusted value, with the same assumptions note)

**Springfield IL / Bay Valley etc.** (default exit cap, no rent growth) — format is `"X.X% exit (entry +1%) · 5yr hold"` (growth segment omitted when rent_growth = 0).

**Knox Mall (fully financed, ∞ IRR)** — the assumptions note is correctly **omitted**; the `note` prop is only passed when `!fullyFinanced`.

### Change 4 — Senior Debt Label ✅

On DuBois (`debt_terms_quoted = false`), Deal Structure tab:
```
Senior Debt — Estimated — update when lender quote is received
                                                          ^ #BC9C45 gold
```
✅ (old "pending lender quote" text and amber pill removed)

On Knox Mall (`debt_terms_quoted = true`) — label shows only "Senior Debt" with no qualifier. ✅

### Regression — Knox Mall (fully-financed) ✅

Metric strip still renders:
- CAP RATE 8.65%, IRR **∞**, COC **∞**, DSCR 1.43x, EQUITY REQUIRED **$0**

Capital Stack: Senior 70% + Mezz 35% fills 100%, "Fully Financed — No Investor Equity Required" label, "FUNDED BY" sub-section, $0 equity — all intact.

"Annual Cash Flow to Investor" callout renders with the full distributable CF. ✅

### Typecheck

`npx tsc --noEmit` — clean (ignoring the pre-existing stale `.next/types/validator.ts` artifact unrelated to this work).

## 3. Fee-Disclosure Section Description

When Gideon enters real fees for a deal, the Fee Disclosure section on the Deal Structure tab renders each fee on a two-column compact grid:

| Label | Value |
|---|---|
| Assignment Fee (3.0%) | $60,000 |
| Acquisition Fee (1.0%) | $20,000 |
| Asset Mgmt Fee (4.0%/yr) | $7,728/yr |
| GP Carry | 20% above 8% pref |
| Loan Origination (1 pt(s)) | $15,000 |

Muted text, informational only. The numbers feed nothing — they are transparency signal. The headline metric strip above, the Capital Stack, the Projected IRR on the Overview tab, and the Financial Modeling tab are all computed with fees = 0.

The Returns Calculator at the bottom of the Deal Structure tab continues using `calculateDeal(dealInputs)` (real fees) through the `feeAdjustedMetrics` derived value, so Option A / Option B / Custom Terms show the investor what they actually net after fees.

## 4. Ambiguities / Judgement Calls

1. **Deal Structure tab's own Option A / Option B cards** (separate from the IRR Calculator panel further down). The spec enumerated "Option A/B cards" in general without disambiguating; I routed these to `feeAdjustedMetrics` so they show fee-adjusted IRR and real fee dollars. Was necessary because otherwise they stayed at 32.72% with "$0" fee dollars even after saving 3%/1% fees — which contradicted the spec's expected "Option A/B IRR LOWER than 32.72%" check.

2. **`calculateTraditionalClose()` routing**. Spec suggested updating it to `calculatePropertyMetrics({ ...inputs, sellerFinancing: false, sellerCredit: 0 })`. Done. The downstream effect: the Return Comparison table's "Traditional Close" column is now strictly property-level, matching the "With Seller Mezz" side. When fees are non-zero, both columns hold their property-level values and the comparison remains apples-to-apples.

3. **`excel-export.ts`** — not touched. It still calls `calculateDeal()` for scenario generation. If Excel exports should also be property-level for investor-facing reports, that's a one-line follow-up. Flagged, not silently changed.

4. **IRR Calculator panel ∞ guard**. The panel's `fullyFinanced` flag is driven by `computed.netEquity <= 0` (property-level). This is correct: fee-adjusted metrics may have different netEquity (because closing costs push it up), but the "is this a fully-financed deal?" determination should match what the metric strip shows. Confirmed Knox still renders ∞ in all three calculator modes.

5. **IRR assumptions note placement**. Implemented as a new `note` prop on `MetricCard` so both metric strips (hero-area right-column cards and the fallback full-width strip) render it consistently. Visual: 10px muted-gray, directly under the IRR value, inside the same card. Spec wanted ~11px; 10px fits the existing card typography better without overflowing the small IRR card.

6. **Capital Stack TBD conditional**. I check `metrics.closingCosts === 0`. Since `calculatePropertyMetrics()` always zeros closing costs, *every* deal will show TBD\* today. If a future admin flow bypasses `calculatePropertyMetrics` and passes real closing costs, the code gracefully falls back to the numeric display. The TBD state is effectively universal during beta, which is exactly what the spec wants.

7. **Fee Disclosure dollar computation**. Switched from reading `metrics.assignmentFeeDollar` (now always 0) to computing inline: `inputs.purchasePrice * inputs.assignmentFee / 100`, etc. The `inputs` object preserves the deal's real fee percentages because it comes from `parseDealInputs(deal)` before the zeroing spread. Confirmed all five Fee Disclosure rows render the correct dollar amounts when fees are non-zero.

8. **`debt_terms_quoted` field** — already in the Supabase select for the deal detail page (line 36). No select-query change needed.

9. **Admin live panel CoC color logic**. Previously flipped red when `m.cocReturn >= 0 ? green : red`. With my fee-separation change CoC is now null-safe (∞ green branch) and the color logic still works for positive-equity deals. No regression.

10. **Hebrew translations** for the three new keys (`estClosingCosts`, `closingCostsFootnote`, updated `estimated`) — written plausibly; a native speaker should proofread before RTL launch.

## 5. Summary

Typecheck clean. All four changes verified in the live browser against DuBois (explicit exit-cap + rent-growth, used for Change 3 visibility) and Knox Mall (fully-financed, used for ∞ regression). Fee separation proven with a round-trip: fees entered → saved → headline unchanged → Fee Disclosure shows real dollars → Option A/B show fee-adjusted IRR → fees reset to 0.
