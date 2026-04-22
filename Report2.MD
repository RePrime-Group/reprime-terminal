# Report 2 — Zero/Negative Equity Display Logic

## 1. Files Modified

| File | Changes |
|------|---------|
| `src/lib/utils/deal-calculator.ts` | `cocReturn` and `equityMultiple` typed as `number \| null`; return `null` instead of `0` when `netEquity <= 0`; negative-CoC warning now guards for null. |
| `src/lib/utils/format.ts` | Added `INFINITY_SYMBOL = '∞'`, `INFINITY_GREEN`, and `formatInfinityMetric()` helper for the ∞/N/A decision. |
| `src/app/[locale]/(admin)/admin/deals/[id]/page.tsx` | Live metrics panel shows ∞/N/A for CoC/IRR/EqMultiple and `$0` for Net Equity when fully financed; save path writes null for CoC (not "0.00"). |
| `src/app/[locale]/(admin)/admin/deals/new/page.tsx` | Same treatment for the live preview + save path. |
| `src/app/[locale]/(portal)/portal/page.tsx` | Enrichment adds `fully_financed` + `has_positive_cash_flow` flags. CoC fallback handles null-or-zero. |
| `src/app/[locale]/(admin-preview)/admin/preview/page.tsx` | Same enrichment flags for admin-preview of the portal. |
| `src/components/portal/PortalDashboardClient.tsx` | `DealCardData` interface extended with the two new flags. |
| `src/components/portal/DealCard.tsx` | Portal cards render ∞ in green for CoC/IRR and `$0` in green for equity when `fully_financed`. |
| `src/components/portal/DealDetailClient.tsx` | 7-metric strip uses ∞ + `$0`; prominent gold "Annual Cash Flow to Investor" callout added above OverviewFinancials on fully-financed deals; FM-tab metric cards show ∞ + `$0`; Deal-Structure projected-IRR card renders ∞; `IRRCalculatorPanel` accepts `fullyFinanced`/`hasPositiveCashFlow` and renders ∞ in Assignment / GP-LP / Custom modes. |
| `src/components/portal/FinancialOverview.tsx` | Capital Stack widget: rescales debt widths to fill 100% when over-leveraged, hides equity segment, shows "Fully Financed" label and "Funded By" breakdown. Return Comparison renders ∞/`$0` in the mezz column. |
| `src/messages/en.json` + `he.json` | Added: `financial.fullyFinanced`, `financial.fundedBy`, `financial.totalFinancing`, `dealDetail.annualCashFlowToInvestor`, `dealDetail.zeroEquityCallout`. |
| `updateDealMetrics.ts` | CoC save path + log line null-safe. |

## 2. Knox Mall Verification (engine output confirmed)

Ran `calculateDeal()` against Knox's live DB inputs (PP $5.3M, NOI $415,323, SC $500K, LTV 70%, Mezz 35% @ 1.5% IO):

```
netEquity       : -240000   (< 0, fully financed)
distributableCF : $124,144  (positive — ∞ applies)
cocReturn       : null      → UI renders ∞ in green
equityMultiple  : null      → UI renders ∞ in green
irr             : null      → UI renders ∞ in green
lenderDSCR      : 1.56x     (unchanged)
combinedDSCR    : 1.43x     (unchanged)
```

Every fully-financed surface will show:
- **Metric strip:** Equity Required `$0` (green), CoC `∞` (green), IRR `∞` (green), DSCR `1.43x`
- **Cash-flow callout:** gold banner with `$124,144` in large green
- **Capital Stack:** Senior 70% + Mezz 35% bars fill 100% width; equity row shows `$0`; "Fully Financed" label; "Funded By" sub-section lists $3.36M + $1.68M = $5.04M financing with `$0` investor equity
- **Return Comparison** (mezz column): equity `$0`, CoC `∞`, IRR `∞` — all green

## 3. Positive-Equity Regression

West Weber (DuBois, $500K positive equity) still computes:

- cocReturn = 17.057%
- equityMultiple = 3.32x
- irr = 32.72%
- All metric displays render as percentages/`x` — no ∞ symbols anywhere.

## 4. Null-Guard Locations Added

Every site that previously called `.toFixed()` on CoC or equityMultiple — covered:

- [src/lib/utils/deal-calculator.ts:216](src/lib/utils/deal-calculator.ts#L216) — negative-CoC warning guard
- [src/app/[locale]/(admin)/admin/deals/[id]/page.tsx:545](src/app/%5Blocale%5D/(admin)/admin/deals/%5Bid%5D/page.tsx#L545) — admin save path
- [src/app/[locale]/(admin)/admin/deals/[id]/page.tsx:1194-1196](src/app/%5Blocale%5D/(admin)/admin/deals/%5Bid%5D/page.tsx#L1194-L1196) — admin live panel (CoC + Eq Multiple)
- [src/app/[locale]/(admin)/admin/deals/[id]/page.tsx:1214](src/app/%5Blocale%5D/(admin)/admin/deals/%5Bid%5D/page.tsx#L1214) — Net Equity check-size row
- [src/app/[locale]/(admin)/admin/deals/new/page.tsx:461](src/app/%5Blocale%5D/(admin)/admin/deals/new/page.tsx#L461) — new deal save
- [src/app/[locale]/(admin)/admin/deals/new/page.tsx:859-861](src/app/%5Blocale%5D/(admin)/admin/deals/new/page.tsx#L859-L861) — new deal live preview
- [src/app/[locale]/(admin)/admin/deals/new/page.tsx:868](src/app/%5Blocale%5D/(admin)/admin/deals/new/page.tsx#L868) — Net Equity display
- [src/app/[locale]/(portal)/portal/page.tsx:137](src/app/%5Blocale%5D/(portal)/portal/page.tsx#L137) — enrichment fallback
- [src/app/[locale]/(admin-preview)/admin/preview/page.tsx:146](src/app/%5Blocale%5D/(admin-preview)/admin/preview/page.tsx#L146) — preview enrichment
- [src/components/portal/FinancialOverview.tsx:343-354](src/components/portal/FinancialOverview.tsx#L343-L354) — Return Comparison table
- [src/components/portal/DealDetailClient.tsx:737-743](src/components/portal/DealDetailClient.tsx#L737-L743) — FM tab metric cards
- [src/components/portal/DealDetailClient.tsx:2185-2191](src/components/portal/DealDetailClient.tsx#L2185-L2191) — investor metric strip
- [src/components/portal/DealDetailClient.tsx:2776](src/components/portal/DealDetailClient.tsx#L2776) — Deal-Structure projected-IRR card
- [src/components/portal/DealDetailClient.tsx:1184, 1213, 1304](src/components/portal/DealDetailClient.tsx#L1184) — IRR Calculator panel (all 3 modes)
- [updateDealMetrics.ts:48, 59](updateDealMetrics.ts#L48) — script

## 5. Ambiguities / Judgement Calls

1. **"Projected IRR" big-number card on Deal-Structure tab** — not in the spec's enumerated surface list, but it's visible to investors on the Deal Structure tab. Applied the same ∞/N/A treatment for consistency. Flagging in case you'd rather keep it as `--`.

2. **IRR Calculator Panel** — spec listed FM tab and Return Comparison but not this slider panel. I passed through `fullyFinanced`/`hasPositiveCashFlow` and rendered ∞ in all three modes (Assignment, GP/LP, Custom). Alternative: leave the panel unchanged and let it render 0.00% — but that conflicts with the "∞ everywhere" principle, so I applied it.

3. **AMF visibility logic** already hides the AMF row when `assetMgmtFee === 0` (from the beta-simplification pass). Left untouched.

4. **DealCard `highlight` color scheme** — I added `infinityValue` flag so fully-financed cards show ∞ in a slightly larger (`text-[18px]`) green. Minor visual bump; easy to revert if you prefer uniform sizing.

5. **Total Capital Required walk** — when fully financed, I clamp `totalCapital = netBasis + closingCosts`. Under the old formula (`loan + mezz + netEquity`) Knox would show `$3.36M + $1.68M + (-$240K) = $4.8M`, coincidentally equal to net basis. Mathematically the same for Knox, but the new clamp is robust for any over-leverage edge case. Flagging the arithmetic identity in case you expected the old formula.

6. **Engine still computes `netSaleProceeds`, `totalProfit`, IRR cash flows off the negative `netEquity`** — I did not touch those. The IRR solver already returns `null` for pathological cash flows (negative initial outlay + positive cash flows), which is what produces the `∞` display naturally.

7. **DB sync (stored `coc` column)** — when engine returns null for CoC, the admin save path now writes `null` to `terminal_deals.coc`. For Knox this matches the existing DB state (already `null`). No migration needed.

8. **Typecheck** — `npx tsc --noEmit` clean (pre-existing stale `.next/types/validator.ts` error unrelated to this work still shows).
