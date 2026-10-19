'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  computeSaleScenario,
  computeRefinanceScenario,
  exitCapSensitivity,
  refiLTVSensitivity,
  fmtMoney,
  fmtPct,
  fmtMultiple,
  fmtIRR,
  type SaleScenarioInputs,
  type RefiScenarioInputs,
  type SaleScenarioResult,
  type RefiScenarioResult,
} from '@/lib/utils/exit-strategy-math';
import type { ExitScenario, ExitScenarioType } from '@/lib/types/database';

// ─────────────────────────────────────────────────────────────────────────────
// Investor-facing exit strategy tab. Pure display — no engine imports.
// Engine outputs (distributableCF, loanAmount, etc.) arrive as plain-data
// props from DealDetailClient.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExitStrategyContext {
  distributableCF: number;
  loanAmount: number;
  seniorRatePct: number;
  amortYears: number;
  hasMezz: boolean;
  mezzAmount: number;
  mezzTermMonths: number;
  equityInvested: number;
}

interface ExitStrategyTabProps {
  scenarios: ExitScenario[];
  context: ExitStrategyContext;
}

const TYPE_LABEL: Record<ExitScenarioType, string> = {
  conservative: 'Conservative',
  moderate: 'Moderate',
  aggressive: 'Aggressive',
  refinance: 'Refinance',
};

const TYPE_COLOR: Record<ExitScenarioType, { chip: string; accent: string }> = {
  conservative: { chip: 'bg-[#0E3470]/10 text-[#0E3470]', accent: 'border-l-[#0E3470]' },
  moderate: { chip: 'bg-[#BC9C45]/15 text-[#BC9C45]', accent: 'border-l-[#BC9C45]' },
  aggressive: { chip: 'bg-[#0B8A4D]/10 text-[#0B8A4D]', accent: 'border-l-[#0B8A4D]' },
  refinance: { chip: 'bg-[#6D28D9]/10 text-[#6D28D9]', accent: 'border-l-[#6D28D9]' },
};

function toNum(v: string | number | null | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[$,%\s]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export default function ExitStrategyTab({ scenarios, context }: ExitStrategyTabProps) {
  const t = useTranslations('portal.exitStrategy');
  const enabled = scenarios.filter((s) => s.is_enabled);

  if (enabled.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-10 text-center">
        <p className="text-[14px] text-rp-gray-500">
          {t('emptyState')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {enabled.map((s) => (
          <ScenarioCard key={s.id} scenario={s} context={context} />
        ))}
      </div>

      <ComparisonTable scenarios={enabled} context={context} />

      <p className="text-[11px] text-rp-gray-400 italic">
        {t('disclaimer')}
      </p>
    </div>
  );
}

function ScenarioCard({
  scenario,
  context,
}: {
  scenario: ExitScenario;
  context: ExitStrategyContext;
}) {
  const isRefi = scenario.scenario_type === 'refinance';
  const color = TYPE_COLOR[scenario.scenario_type];
  const t = useTranslations('portal.exitStrategy');
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [showProforma, setShowProforma] = useState(false);

  // One interactive slider per scenario. Drives a what-if computation client-
  // side only; the stored scenario values are untouched. Refreshing resets.
  const [sliderVal, setSliderVal] = useState<number>(() => {
    if (isRefi) return scenario.refi_params?.ltv ?? 75;
    return toNum(scenario.exit_cap_rate);
  });

  const baseSale: SaleScenarioInputs | null = !isRefi
    ? {
        exitNOI: toNum(scenario.exit_noi),
        exitCapRatePct: toNum(scenario.exit_cap_rate),
        exitYear: scenario.exit_year,
        loanAmount: context.loanAmount,
        seniorRatePct: context.seniorRatePct,
        seniorAmortYears: context.amortYears,
        hasMezz: context.hasMezz,
        mezzAmount: context.mezzAmount,
        mezzTermMonths: context.mezzTermMonths,
        distributableCashFlow: context.distributableCF,
        equityInvested: context.equityInvested,
      }
    : null;

  const baseRefi: RefiScenarioInputs | null = isRefi
    ? {
        refiNOI: toNum(scenario.exit_noi),
        refiCapRatePct: toNum(scenario.exit_cap_rate),
        refiYear: scenario.exit_year,
        refiLTVPct: scenario.refi_params?.ltv ?? 75,
        refiRatePct: scenario.refi_params?.rate ?? context.seniorRatePct,
        refiAmortYears: scenario.refi_params?.amortYears ?? context.amortYears,
        existingLoanAmount: context.loanAmount,
        existingRatePct: context.seniorRatePct,
        existingAmortYears: context.amortYears,
        hasMezz: context.hasMezz,
        mezzAmount: context.mezzAmount,
        mezzTermMonths: context.mezzTermMonths,
        distributableCashFlow: context.distributableCF,
        equityInvested: context.equityInvested,
      }
    : null;

  // Base (stored) result and live slider-adjusted result.
  const base = isRefi && baseRefi
    ? { kind: 'refi' as const, result: computeRefinanceScenario(baseRefi) }
    : baseSale
      ? { kind: 'sale' as const, result: computeSaleScenario(baseSale) }
      : null;

  const live = useMemo(() => {
    if (isRefi && baseRefi) {
      return {
        kind: 'refi' as const,
        result: computeRefinanceScenario({ ...baseRefi, refiLTVPct: sliderVal }),
      };
    }
    if (baseSale) {
      return {
        kind: 'sale' as const,
        result: computeSaleScenario({ ...baseSale, exitCapRatePct: sliderVal }),
      };
    }
    return null;
  }, [isRefi, baseSale, baseRefi, sliderVal]);

  if (!base || !live) return null;

  // Slider ranges per spec:
  // Conservative: ±200bps around base exit cap
  // Aggressive: ±100bps (tighter)
  // Moderate: ±150bps (between)
  // Refinance: 60%-80% LTV
  const sliderBounds = (() => {
    if (isRefi) return { min: 60, max: 80, step: 1, suffix: t('suffixLtv') };
    const baseCap = toNum(scenario.exit_cap_rate);
    const range = scenario.scenario_type === 'aggressive' ? 1.0
      : scenario.scenario_type === 'moderate' ? 1.5
      : 2.0;
    return {
      min: Math.max(0.25, baseCap - range),
      max: baseCap + range,
      step: 0.05,
      suffix: t('suffixExitCap'),
    };
  })();

  const positive = live.kind === 'sale'
    ? live.result.totalReturn > 0
    : live.result.cashOut > 0;

  return (
    <div className={`bg-white rounded-2xl border border-rp-gray-200 border-l-4 ${color.accent} p-5 space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={`text-[9px] font-bold tracking-[1.5px] uppercase px-2 py-1 rounded ${color.chip}`}>
            {t.has(`types.${scenario.scenario_type}`) ? t(`types.${scenario.scenario_type}`) : TYPE_LABEL[scenario.scenario_type]}
          </span>
          <h3 dir="auto" className="mt-2 text-[16px] font-semibold text-rp-navy font-[family-name:var(--font-playfair)]">
            {scenario.scenario_name}
          </h3>
          <p className="mt-1 text-[11px] text-rp-gray-500">
            {t('yearCap', { year: scenario.exit_year, cap: fmtPct(toNum(scenario.exit_cap_rate), 2) })}
            {scenario.buyer_profile
              ? ` · ${t.has(`buyerProfiles.${scenario.buyer_profile.replace(/[^A-Za-z0-9]/g, '')}`) ? t(`buyerProfiles.${scenario.buyer_profile.replace(/[^A-Za-z0-9]/g, '')}`) : scenario.buyer_profile}`
              : ''}
          </p>
        </div>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        {live.kind === 'sale' ? (
          <>
            <MetricBlock label={t('exitValue')} value={fmtMoney(live.result.exitValue)} />
            <MetricBlock label={t('netProceeds')} value={fmtMoney(live.result.netProceeds)} />
            <MetricBlock
              label={t('equityMultiple')}
              value={fmtMultiple(live.result.equityMultiple, positive).replace('N/A', t('na'))}
              strong
            />
            <MetricBlock
              label={t('scenarioIrr')}
              value={fmtIRR(live.result.irr, positive).replace('N/A', t('na'))}
              strong
            />
          </>
        ) : (
          <>
            <MetricBlock label={t('propertyValue')} value={fmtMoney(live.result.propertyValue)} />
            <MetricBlock label={t('cashOut')} value={fmtMoney(live.result.cashOut)} />
            <MetricBlock label={t('postRefiCf')} value={fmtMoney(live.result.postRefiCF)} />
            <MetricBlock
              label={t('cashOnRemaining')}
              value={live.result.cashOnRemainingPct !== null ? fmtPct(live.result.cashOnRemainingPct) : '—'}
              strong
            />
          </>
        )}
      </div>

      {/* Interactive slider */}
      <div className="bg-rp-gray-50/50 rounded-lg p-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-semibold text-rp-gray-600 uppercase tracking-wider">
            {isRefi ? t('whatIfRefiLtv') : t('whatIfExitCap')}
          </label>
          <span className="text-[12px] font-semibold text-rp-navy tabular-nums">
            {sliderVal.toFixed(isRefi ? 0 : 2)}{sliderBounds.suffix}
          </span>
        </div>
        <input
          type="range"
          min={sliderBounds.min}
          max={sliderBounds.max}
          step={sliderBounds.step}
          value={sliderVal}
          onChange={(e) => setSliderVal(parseFloat(e.target.value))}
          className="w-full accent-rp-gold"
        />
        <p className="mt-1 text-[10px] text-rp-gray-400">
          {t('sliderHint')}
        </p>
      </div>

      {/* Narrative */}
      {scenario.strategy_narrative && (
        <p dir="auto" className="text-[12px] text-rp-gray-600 leading-relaxed italic border-l-2 border-rp-gray-200 pl-3">
          {scenario.strategy_narrative}
        </p>
      )}

      {/* Expandable sections */}
      <div className="flex items-center gap-4 pt-2 border-t border-rp-gray-100">
        <button
          onClick={() => setShowSensitivity((v) => !v)}
          className="text-[11px] font-medium text-rp-navy hover:text-rp-gold"
        >
          {showSensitivity ? '▲' : '▼'} {t('sensitivity')}
        </button>
        <button
          onClick={() => setShowProforma((v) => !v)}
          className="text-[11px] font-medium text-rp-navy hover:text-rp-gold"
        >
          {showProforma ? '▲' : '▼'} {t('fullProforma')}
        </button>
      </div>

      {showSensitivity && (
        <div className="bg-rp-gray-50/50 rounded-lg p-3">
          {live.kind === 'sale' && baseSale ? (
            <SaleSensitivity inputs={baseSale} />
          ) : baseRefi ? (
            <RefiSensitivity inputs={baseRefi} />
          ) : null}
        </div>
      )}

      {showProforma && (
        <div className="bg-rp-gray-50/50 rounded-lg p-4">
          {live.kind === 'sale' ? (
            <SaleProforma
              scenario={scenario}
              result={live.result}
              context={context}
            />
          ) : (
            <RefiProforma
              scenario={scenario}
              result={live.result}
              context={context}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MetricBlock({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-rp-gray-500">{label}</div>
      <div
        className={`mt-0.5 tabular-nums ${strong ? 'text-[16px] font-semibold text-rp-navy' : 'text-[13px] font-medium text-rp-gray-800'}`}
      >
        {value}
      </div>
    </div>
  );
}

function SaleSensitivity({ inputs }: { inputs: SaleScenarioInputs }) {
  const t = useTranslations('portal.exitStrategy');
  const rows = exitCapSensitivity(inputs);
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wider text-rp-gray-500">
          <th className="py-1.5">{t('exitCap')}</th>
          <th className="py-1.5 text-right">{t('exitValue')}</th>
          <th className="py-1.5 text-right">{t('multiple')}</th>
          <th className="py-1.5 text-right">IRR</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const positive = r.result.totalReturn > 0;
          return (
            <tr key={i} className={`border-t border-rp-gray-200 ${r.isBase ? 'font-semibold text-rp-navy' : 'text-rp-gray-700'}`}>
              <td className="py-1.5">{fmtPct(r.capRatePct, 2)}</td>
              <td className="py-1.5 text-right tabular-nums">{fmtMoney(r.result.exitValue)}</td>
              <td className="py-1.5 text-right tabular-nums">{fmtMultiple(r.result.equityMultiple, positive).replace('N/A', t('na'))}</td>
              <td className="py-1.5 text-right tabular-nums">{fmtIRR(r.result.irr, positive).replace('N/A', t('na'))}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RefiSensitivity({ inputs }: { inputs: RefiScenarioInputs }) {
  const t = useTranslations('portal.exitStrategy');
  const rows = refiLTVSensitivity(inputs);
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wider text-rp-gray-500">
          <th className="py-1.5">{t('refiLtv')}</th>
          <th className="py-1.5 text-right">{t('cashOut')}</th>
          <th className="py-1.5 text-right">{t('postRefiCf')}</th>
          <th className="py-1.5 text-right">{t('cashOnRemaining')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={`border-t border-rp-gray-200 ${r.isBase ? 'font-semibold text-rp-navy' : 'text-rp-gray-700'}`}>
            <td className="py-1.5">{r.ltvPct}%</td>
            <td className="py-1.5 text-right tabular-nums">{fmtMoney(r.result.cashOut)}</td>
            <td className="py-1.5 text-right tabular-nums">{fmtMoney(r.result.postRefiCF)}</td>
            <td className="py-1.5 text-right tabular-nums">
              {r.result.cashOnRemainingPct !== null ? fmtPct(r.result.cashOnRemainingPct) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SaleProforma({
  scenario,
  result,
  context,
}: {
  scenario: ExitScenario;
  result: SaleScenarioResult;
  context: ExitStrategyContext;
}) {
  const t = useTranslations('portal.exitStrategy');
  const positive = result.totalReturn > 0;
  return (
    <div className="space-y-1 text-[12px]">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-rp-gray-500 mb-2">
        {t.rich('saleProformaTitle', {
          name: scenario.scenario_name,
          year: scenario.exit_year,
          bdi: (chunks) => <bdi>{chunks}</bdi>,
        })}
      </h4>
      <Line label={t('exitNoi')} value={fmtMoney(toNum(scenario.exit_noi))} />
      <Line label={t('exitCapRate')} value={fmtPct(toNum(scenario.exit_cap_rate), 2)} />
      <Line label={t('grossExitValue')} value={fmtMoney(result.exitValue)} bold />
      <Line label={t('dispositionCosts')} value={fmtMoney(result.dispositionCosts)} muted />
      <Line label={t('seniorLoanPayoff')} value={fmtMoney(result.seniorPayoff)} muted />
      {context.hasMezz && <Line label={t('mezzBalloon')} value={fmtMoney(result.mezzPayoff)} muted />}
      <Line label={t('netSaleProceeds')} value={fmtMoney(result.netProceeds)} bold />
      <div className="border-t border-rp-gray-200 my-2" />
      <Line
        label={t('holdCashFlow', { years: scenario.exit_year, amount: fmtMoney(context.distributableCF) })}
        value={fmtMoney(result.holdCashFlow)}
      />
      <Line label={t('totalReturn')} value={fmtMoney(result.totalReturn)} bold />
      <Line label={t('equityInvested')} value={context.equityInvested <= 0 ? '$0' : fmtMoney(context.equityInvested)} muted />
      <Line label={t('equityMultiple')} value={fmtMultiple(result.equityMultiple, positive).replace('N/A', t('na'))} bold />
      <Line label={t('scenarioIrr')} value={fmtIRR(result.irr, positive).replace('N/A', t('na'))} bold />
    </div>
  );
}

function RefiProforma({
  scenario,
  result,
  context,
}: {
  scenario: ExitScenario;
  result: RefiScenarioResult;
  context: ExitStrategyContext;
}) {
  const t = useTranslations('portal.exitStrategy');
  return (
    <div className="space-y-1 text-[12px]">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-rp-gray-500 mb-2">
        {t.rich('refiProformaTitle', {
          name: scenario.scenario_name,
          year: scenario.exit_year,
          bdi: (chunks) => <bdi>{chunks}</bdi>,
        })}
      </h4>
      <Line label={t('propertyValueAtRefi')} value={fmtMoney(result.propertyValue)} bold />
      <Line label={t('newSeniorLoan', { ltv: scenario.refi_params?.ltv ?? 75 })} value={fmtMoney(result.newLoan)} />
      <Line label={t('existingSeniorPayoff')} value={fmtMoney(result.existingSeniorPayoff)} muted />
      {context.hasMezz && <Line label={t('mezzPayoff')} value={fmtMoney(result.mezzPayoff)} muted />}
      <Line label={t('netRefiProceeds')} value={fmtMoney(result.cashOut)} bold />
      <div className="border-t border-rp-gray-200 my-2" />
      <Line label={t('newDebtService')} value={fmtMoney(result.newAnnualDS)} />
      <Line label={t('cashFlowPostRefi')} value={fmtMoney(result.postRefiCF)} bold />
      <div className="border-t border-rp-gray-200 my-2" />
      <Line
        label={t('capitalReturned', { years: scenario.exit_year })}
        value={fmtMoney(result.totalCapitalReturned)}
        bold
      />
      <Line label={t('remainingEquity')} value={fmtMoney(result.remainingEquity)} muted />
      <Line
        label={t('cashOnRemaining')}
        value={result.cashOnRemainingPct !== null ? fmtPct(result.cashOnRemainingPct) : '—'}
        bold
      />
    </div>
  );
}

function Line({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-rp-gray-500' : 'text-rp-gray-700'}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-semibold text-rp-navy' : muted ? 'text-rp-gray-500' : 'text-rp-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison table: all enabled scenarios side by side.
// ─────────────────────────────────────────────────────────────────────────────
function ComparisonTable({
  scenarios,
  context,
}: {
  scenarios: ExitScenario[];
  context: ExitStrategyContext;
}) {
  const t = useTranslations('portal.exitStrategy');
  const rows = scenarios.map((s) => {
    const isRefi = s.scenario_type === 'refinance';
    if (isRefi) {
      const result = computeRefinanceScenario({
        refiNOI: toNum(s.exit_noi),
        refiCapRatePct: toNum(s.exit_cap_rate),
        refiYear: s.exit_year,
        refiLTVPct: s.refi_params?.ltv ?? 75,
        refiRatePct: s.refi_params?.rate ?? context.seniorRatePct,
        refiAmortYears: s.refi_params?.amortYears ?? context.amortYears,
        existingLoanAmount: context.loanAmount,
        existingRatePct: context.seniorRatePct,
        existingAmortYears: context.amortYears,
        hasMezz: context.hasMezz,
        mezzAmount: context.mezzAmount,
        mezzTermMonths: context.mezzTermMonths,
        distributableCashFlow: context.distributableCF,
        equityInvested: context.equityInvested,
      });
      return {
        scenario: s,
        exitYear: s.exit_year,
        exitCap: fmtPct(toNum(s.exit_cap_rate), 2),
        exitOrValue: t('valueSuffix', { amount: fmtMoney(result.propertyValue) }),
        netOrCash: t('cashOutSuffix', { amount: fmtMoney(result.cashOut) }),
        hold: fmtMoney(context.distributableCF * s.exit_year),
        total: t('ongoing'),
        multiple: t('na'),
        irr: t('na'),
      };
    }
    const result = computeSaleScenario({
      exitNOI: toNum(s.exit_noi),
      exitCapRatePct: toNum(s.exit_cap_rate),
      exitYear: s.exit_year,
      loanAmount: context.loanAmount,
      seniorRatePct: context.seniorRatePct,
      seniorAmortYears: context.amortYears,
      hasMezz: context.hasMezz,
      mezzAmount: context.mezzAmount,
      mezzTermMonths: context.mezzTermMonths,
      distributableCashFlow: context.distributableCF,
      equityInvested: context.equityInvested,
    });
    const positive = result.totalReturn > 0;
    return {
      scenario: s,
      exitYear: s.exit_year,
      exitCap: fmtPct(toNum(s.exit_cap_rate), 2),
      exitOrValue: fmtMoney(result.exitValue),
      netOrCash: fmtMoney(result.netProceeds),
      hold: fmtMoney(result.holdCashFlow),
      total: fmtMoney(result.totalReturn),
      multiple: fmtMultiple(result.equityMultiple, positive).replace('N/A', t('na')),
      irr: fmtIRR(result.irr, positive).replace('N/A', t('na')),
    };
  });

  return (
    <div className="bg-white rounded-2xl border border-rp-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-rp-gray-200">
        <h3 className="text-[15px] font-semibold text-rp-navy font-[family-name:var(--font-playfair)]">
          {t('scenarioComparison')}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-rp-gray-500 bg-rp-gray-50/50">
              <th className="py-2.5 px-5">{t('metric')}</th>
              {rows.map((r) => (
                <th key={r.scenario.id} className="py-2.5 px-3 text-right">
                  {t.has(`types.${r.scenario.scenario_type}`) ? t(`types.${r.scenario.scenario_type}`) : TYPE_LABEL[r.scenario.scenario_type]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <CompRow label={t('exitYear')} cells={rows.map((r) => String(r.exitYear))} />
            <CompRow label={t('capRate')} cells={rows.map((r) => r.exitCap)} />
            <CompRow label={t('exitOrPropertyValue')} cells={rows.map((r) => r.exitOrValue)} />
            <CompRow label={t('netProceedsOrCashOut')} cells={rows.map((r) => r.netOrCash)} />
            <CompRow label={t('cashFlowHold')} cells={rows.map((r) => r.hold)} />
            <CompRow label={t('totalReturn')} cells={rows.map((r) => r.total)} />
            <CompRow label={t('equityMultiple')} cells={rows.map((r) => r.multiple)} strong />
            <CompRow label={t('scenarioIrr')} cells={rows.map((r) => r.irr)} strong />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompRow({ label, cells, strong = false }: { label: string; cells: string[]; strong?: boolean }) {
  return (
    <tr className="border-t border-rp-gray-100">
      <td className="py-2 px-5 text-rp-gray-600">{label}</td>
      {cells.map((c, i) => (
        <td
          key={i}
          className={`py-2 px-3 text-right tabular-nums ${strong ? 'font-semibold text-rp-navy' : 'text-rp-gray-700'}`}
        >
          {c}
        </td>
      ))}
    </tr>
  );
}
