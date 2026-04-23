'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import DealSubNav from '@/components/admin/DealSubNav';
// Engine used ONLY to derive deal-level context (distributable CF, loan
// amount, equity) that the scenario math needs as data. The scenario math
// itself lives in exit-strategy-math.ts and imports nothing from the engine.
import { parseDealInputs, calculatePropertyMetrics } from '@/lib/utils/deal-calculator';
import {
  computeSaleScenario,
  computeRefinanceScenario,
  fmtMoney,
  fmtPct,
  fmtMultiple,
  fmtIRR,
} from '@/lib/utils/exit-strategy-math';
import type {
  ExitScenario,
  ExitScenarioType,
  BuyerProfile,
  ExitRefiParams,
} from '@/lib/types/database';

const BUYER_PROFILES: BuyerProfile[] = [
  'Value Investor',
  'Stabilized Asset Buyer',
  'Institutional',
  'Net Lease Buyer',
  '1031 Exchange Buyer',
  'Private Equity',
  'Local Investor',
  'N/A',
];

const SCENARIO_ORDER: ExitScenarioType[] = ['conservative', 'moderate', 'aggressive', 'refinance'];

interface DealContext {
  distributableCF: number;
  loanAmount: number;
  seniorRatePct: number;
  amortYears: number;
  hasMezz: boolean;
  mezzAmount: number;
  mezzTermMonths: number;
  equityInvested: number;
  entryCapPct: number;
  noi: number;
}

interface ScenarioForm {
  scenario_name: string;
  exit_year: string;
  exit_cap_rate: string;
  exit_noi: string;
  additional_capex: string;
  strategy_narrative: string;
  buyer_profile: string;
  market_comps: string;
  is_enabled: boolean;
  refi_ltv: string;
  refi_rate: string;
  refi_amort: string;
}

function toForm(s: ExitScenario): ScenarioForm {
  // Supabase returns NUMERIC columns as numbers at runtime even though the
  // typed shape says string|null — coerce defensively so the text inputs
  // always receive strings.
  const str = (v: unknown): string =>
    v === null || v === undefined ? '' : String(v);
  return {
    scenario_name: s.scenario_name ?? '',
    exit_year: String(s.exit_year ?? 5),
    exit_cap_rate: str(s.exit_cap_rate),
    exit_noi: str(s.exit_noi),
    additional_capex: str(s.additional_capex) || '0',
    strategy_narrative: s.strategy_narrative ?? '',
    buyer_profile: s.buyer_profile ?? '',
    market_comps: s.market_comps ?? '',
    is_enabled: !!s.is_enabled,
    refi_ltv: s.refi_params?.ltv != null ? String(s.refi_params.ltv) : '75',
    refi_rate: s.refi_params?.rate != null ? String(s.refi_params.rate) : '',
    refi_amort: s.refi_params?.amortYears != null ? String(s.refi_params.amortYears) : '30',
  };
}

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  const n = parseFloat(s.replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default function ExitStrategyAdminPage() {
  const params = useParams();
  const dealId = params.id as string;
  const locale = (params.locale as string) ?? 'en';
  const supabase = createClient();

  const [dealName, setDealName] = useState('');
  const [scenarios, setScenarios] = useState<ExitScenario[]>([]);
  const [forms, setForms] = useState<Record<string, ScenarioForm>>({});
  const [ctx, setCtx] = useState<DealContext | null>(null);
  const [loading, setLoading] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [narrativeFor, setNarrativeFor] = useState<string | null>(null);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [dealRes, scenariosRes] = await Promise.all([
      supabase.from('terminal_deals').select('*').eq('id', dealId).single(),
      supabase
        .from('exit_scenarios')
        .select('*')
        .eq('deal_id', dealId)
        .order('sort_order', { ascending: true }),
    ]);
    if (dealRes.data) {
      setDealName(dealRes.data.name as string);
      const inputs = parseDealInputs(dealRes.data as unknown as Record<string, unknown>);
      const metrics = calculatePropertyMetrics(inputs);
      setCtx({
        distributableCF: metrics.distributableCashFlow,
        loanAmount: metrics.loanAmount,
        seniorRatePct: inputs.interestRate,
        amortYears: inputs.amortYears,
        hasMezz: inputs.sellerFinancing && metrics.mezzAmount > 0,
        mezzAmount: metrics.mezzAmount,
        mezzTermMonths: inputs.mezzTermMonths,
        equityInvested: metrics.netEquity,
        entryCapPct: metrics.capRate,
        noi: inputs.noi,
      });
    }
    if (scenariosRes.data) {
      const list = scenariosRes.data as ExitScenario[];
      setScenarios(list);
      const nextForms: Record<string, ScenarioForm> = {};
      for (const s of list) nextForms[s.id] = toForm(s);
      setForms(nextForms);
    }
    setLoading(false);
  }, [dealId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/deals/${dealId}/exit-scenarios/generate`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(`Generation failed: ${json.error ?? 'unknown error'}`);
      } else {
        setMessage(`Created ${json.inserted ?? 0} default scenarios. Review and customize.`);
        await fetchData();
      }
    } catch (err) {
      setMessage(`Generation failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setGenerating(false);
      setConfirmReset(false);
    }
  }

  async function handleGenerateNarrative(scenarioId: string) {
    if (narrativeFor !== null) return;
    setNarrativeFor(scenarioId);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/deals/${dealId}/exit-scenarios/${scenarioId}/generate-narrative`,
        { method: 'POST' },
      );
      const json = await res.json();
      if (!res.ok) {
        setMessage(`Narrative generation failed: ${json.error ?? 'unknown error'}`);
      } else if (json.narrative) {
        setForms((prev) => ({
          ...prev,
          [scenarioId]: { ...prev[scenarioId], strategy_narrative: json.narrative },
        }));
      }
    } catch (err) {
      setMessage(`Narrative generation failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setNarrativeFor(null);
    }
  }

  async function handleSave(scenarioId: string) {
    const form = forms[scenarioId];
    if (!form) return;
    const existing = scenarios.find((s) => s.id === scenarioId);
    if (!existing) return;
    if (savingFor !== null) return;
    setSavingFor(scenarioId);
    setMessage(null);
    try {
      const refiParams: ExitRefiParams | null = existing.scenario_type === 'refinance'
        ? {
            ltv: num(form.refi_ltv),
            rate: num(form.refi_rate),
            amortYears: num(form.refi_amort),
          }
        : null;
      const payload = {
        scenario_name: form.scenario_name.trim() || existing.scenario_name,
        exit_year: Math.max(1, Math.round(num(form.exit_year) || 1)),
        exit_cap_rate: num(form.exit_cap_rate),
        exit_noi: num(form.exit_noi),
        additional_capex: num(form.additional_capex),
        strategy_narrative: form.strategy_narrative.trim() || null,
        buyer_profile: form.buyer_profile.trim() || null,
        market_comps: form.market_comps.trim() || null,
        is_enabled: form.is_enabled,
        refi_params: refiParams,
      };
      const { data, error } = await supabase
        .from('exit_scenarios')
        .update(payload)
        .eq('id', scenarioId)
        .select()
        .maybeSingle();
      if (error) {
        setMessage(`Save failed: ${error.message}`);
      } else if (data) {
        setScenarios((prev) => prev.map((s) => (s.id === scenarioId ? (data as ExitScenario) : s)));
        setMessage('Saved.');
      } else {
        await fetchData();
      }
    } catch (err) {
      setMessage(`Save failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setSavingFor(null);
    }
  }

  const orderedScenarios = useMemo(() => {
    const byType = new Map(scenarios.map((s) => [s.scenario_type, s]));
    return SCENARIO_ORDER.map((t) => byType.get(t)).filter((s): s is ExitScenario => !!s);
  }, [scenarios]);

  const hasScenarios = scenarios.length > 0;

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1400px] mx-auto">
      <DealSubNav dealId={dealId} dealName={dealName} locale={locale} />

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-rp-gold/10 border border-rp-gold/30 text-[12px] text-rp-navy">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-rp-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !hasScenarios ? (
        <div className="bg-white rounded-2xl border border-rp-gray-200 p-10 text-center">
          <h2 className="text-[18px] font-semibold text-rp-navy mb-2">No exit scenarios yet.</h2>
          <p className="text-[13px] text-rp-gray-500 mb-6 max-w-[520px] mx-auto">
            Generate four default scenarios (Conservative, Moderate, Aggressive, Refinance)
            from this deal&rsquo;s entry cap, NOI, and hold period. You can edit each one after.
          </p>
          <Button variant="gold" size="md" onClick={handleGenerate} loading={generating}>
            Generate Scenarios
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[20px] font-semibold text-rp-navy font-[family-name:var(--font-playfair)]">
                Exit Strategy
              </h1>
              <p className="text-[12px] text-rp-gray-500 mt-1">
                Display-only projections. Headline metrics unchanged.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
              Reset to Defaults
            </Button>
          </div>

          {orderedScenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              form={forms[scenario.id]}
              ctx={ctx}
              onChange={(patch) =>
                setForms((prev) => ({ ...prev, [scenario.id]: { ...prev[scenario.id], ...patch } }))
              }
              onSave={() => handleSave(scenario.id)}
              onGenerateNarrative={() => handleGenerateNarrative(scenario.id)}
              saving={savingFor === scenario.id}
              generatingNarrative={narrativeFor === scenario.id}
              disabledNarrative={narrativeFor !== null && narrativeFor !== scenario.id}
            />
          ))}
        </div>
      )}

      {confirmReset && (
        <Modal isOpen={confirmReset} onClose={() => setConfirmReset(false)} title="Reset to Defaults">
          <p className="text-sm text-rp-gray-600 mb-6">
            Overwrite the four scenarios with freshly-generated defaults from the current deal
            inputs? Any custom narratives, comps, buyer profiles, or numeric tweaks will be lost.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleGenerate} loading={generating}>
              Reset
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ScenarioCard({
  scenario,
  form,
  ctx,
  onChange,
  onSave,
  onGenerateNarrative,
  saving,
  generatingNarrative,
  disabledNarrative,
}: {
  scenario: ExitScenario;
  form: ScenarioForm | undefined;
  ctx: DealContext | null;
  onChange: (patch: Partial<ScenarioForm>) => void;
  onSave: () => void;
  onGenerateNarrative: () => void;
  saving: boolean;
  generatingNarrative: boolean;
  disabledNarrative: boolean;
}) {
  if (!form) return null;
  const isRefi = scenario.scenario_type === 'refinance';

  const analysis = useMemo(() => {
    if (!ctx) return null;
    if (isRefi) {
      return {
        kind: 'refi' as const,
        result: computeRefinanceScenario({
          refiNOI: num(form.exit_noi),
          refiCapRatePct: num(form.exit_cap_rate),
          refiYear: Math.max(1, num(form.exit_year)),
          refiLTVPct: num(form.refi_ltv),
          refiRatePct: num(form.refi_rate) || ctx.seniorRatePct,
          refiAmortYears: num(form.refi_amort) || ctx.amortYears,
          existingLoanAmount: ctx.loanAmount,
          existingRatePct: ctx.seniorRatePct,
          existingAmortYears: ctx.amortYears,
          hasMezz: ctx.hasMezz,
          mezzAmount: ctx.mezzAmount,
          mezzTermMonths: ctx.mezzTermMonths,
          distributableCashFlow: ctx.distributableCF,
          equityInvested: ctx.equityInvested,
        }),
      };
    }
    return {
      kind: 'sale' as const,
      result: computeSaleScenario({
        exitNOI: num(form.exit_noi),
        exitCapRatePct: num(form.exit_cap_rate),
        exitYear: Math.max(1, num(form.exit_year)),
        loanAmount: ctx.loanAmount,
        seniorRatePct: ctx.seniorRatePct,
        seniorAmortYears: ctx.amortYears,
        hasMezz: ctx.hasMezz,
        mezzAmount: ctx.mezzAmount,
        mezzTermMonths: ctx.mezzTermMonths,
        distributableCashFlow: ctx.distributableCF,
        equityInvested: ctx.equityInvested,
      }),
    };
  }, [ctx, isRefi, form]);

  const typeColor: Record<ExitScenarioType, string> = {
    conservative: 'text-[#0E3470] bg-[#0E3470]/10',
    moderate: 'text-[#BC9C45] bg-[#BC9C45]/10',
    aggressive: 'text-[#0B8A4D] bg-[#0B8A4D]/10',
    refinance: 'text-[#6D28D9] bg-[#6D28D9]/10',
  };

  return (
    <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold tracking-[1.5px] uppercase px-2 py-1 rounded ${typeColor[scenario.scenario_type]}`}>
            {scenario.scenario_type}
          </span>
          <Input
            label=""
            value={form.scenario_name}
            onChange={(e) => onChange({ scenario_name: e.target.value })}
            placeholder="Scenario name"
          />
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={form.is_enabled}
            onChange={(e) => onChange({ is_enabled: e.target.checked })}
            className="w-4 h-4 rounded text-rp-gold focus:ring-rp-gold"
          />
          Enabled (show to investors)
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={isRefi ? 'Refi Year' : 'Exit Year'}
              value={form.exit_year}
              onChange={(e) => onChange({ exit_year: e.target.value })}
            />
            <Input
              label={isRefi ? 'Valuation Cap Rate %' : 'Exit Cap Rate %'}
              value={form.exit_cap_rate}
              onChange={(e) => onChange({ exit_cap_rate: e.target.value })}
              placeholder="e.g. 8.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={isRefi ? 'NOI at Refi' : 'Exit NOI'}
              value={form.exit_noi}
              onChange={(e) => onChange({ exit_noi: e.target.value })}
              placeholder="e.g. 415000"
            />
            <Input
              label="Additional CapEx"
              value={form.additional_capex}
              onChange={(e) => onChange({ additional_capex: e.target.value })}
              placeholder="0"
            />
          </div>

          {isRefi && (
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Refi LTV %"
                value={form.refi_ltv}
                onChange={(e) => onChange({ refi_ltv: e.target.value })}
                placeholder="75"
              />
              <Input
                label="Refi Rate %"
                value={form.refi_rate}
                onChange={(e) => onChange({ refi_rate: e.target.value })}
                placeholder={ctx ? ctx.seniorRatePct.toFixed(2) : '6.00'}
              />
              <Input
                label="Refi Amort (yrs)"
                value={form.refi_amort}
                onChange={(e) => onChange({ refi_amort: e.target.value })}
                placeholder="30"
              />
            </div>
          )}

          {!isRefi && (
            <div>
              <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">
                Buyer Profile
              </label>
              <select
                value={form.buyer_profile}
                onChange={(e) => onChange({ buyer_profile: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 bg-white focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold"
              >
                <option value="">Select…</option>
                {BUYER_PROFILES.map((bp) => (
                  <option key={bp} value={bp}>{bp}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[13px] font-medium text-rp-gray-700">
                Strategy Narrative
              </label>
              <button
                onClick={onGenerateNarrative}
                disabled={generatingNarrative || disabledNarrative}
                className="text-[11px] text-rp-gold hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generatingNarrative ? 'Generating…' : 'Generate with AI'}
              </button>
            </div>
            <textarea
              value={form.strategy_narrative}
              onChange={(e) => onChange({ strategy_narrative: e.target.value })}
              rows={3}
              placeholder="2-4 sentence strategy description…"
              className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold"
            />
            {scenario.ai_generated_narrative && (
              <p className="mt-1 text-[10px] text-rp-gray-400">AI-drafted; edit freely before saving.</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">
              Market Comps
            </label>
            <textarea
              value={form.market_comps}
              onChange={(e) => onChange({ market_comps: e.target.value })}
              rows={2}
              placeholder="Comparable sales supporting the exit cap…"
              className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold"
            />
          </div>
        </div>

        {/* Live Exit Analysis */}
        <div className="bg-rp-gray-50/70 rounded-xl border border-rp-gray-200 p-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-rp-gray-500 mb-3">
            {isRefi ? 'Refinance Analysis (live)' : 'Exit Analysis (live)'}
          </h3>
          {!ctx || !analysis ? (
            <p className="text-[12px] text-rp-gray-400">Computing…</p>
          ) : analysis.kind === 'sale' ? (
            <SaleAnalysis ctx={ctx} result={analysis.result} />
          ) : (
            <RefiAnalysis result={analysis.result} />
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="gold" size="sm" onClick={onSave} loading={saving}>
          Save Scenario
        </Button>
      </div>
    </div>
  );
}

function SaleAnalysis({
  ctx,
  result,
}: {
  ctx: DealContext;
  result: ReturnType<typeof computeSaleScenario>;
}) {
  const positive = result.totalReturn > 0;
  return (
    <div className="space-y-1.5 text-[12px]">
      <Row label="Exit Value" value={fmtMoney(result.exitValue)} />
      <Row label="− Disposition Costs (2%)" value={fmtMoney(result.dispositionCosts)} muted />
      <Row label="− Senior Payoff" value={fmtMoney(result.seniorPayoff)} muted />
      {ctx.hasMezz && <Row label="− Mezz Balloon" value={fmtMoney(result.mezzPayoff)} muted />}
      <Row label="Net Sale Proceeds" value={fmtMoney(result.netProceeds)} bold />
      <div className="border-t border-rp-gray-200 my-2" />
      <Row label="Cash Flow During Hold" value={fmtMoney(result.holdCashFlow)} />
      <Row label="Total Return" value={fmtMoney(result.totalReturn)} bold />
      <Row label="Equity Invested" value={ctx.equityInvested <= 0 ? '$0' : fmtMoney(ctx.equityInvested)} muted />
      <Row label="Equity Multiple" value={fmtMultiple(result.equityMultiple, positive)} bold />
      <Row label="Scenario IRR" value={fmtIRR(result.irr, positive)} bold />
    </div>
  );
}

function RefiAnalysis({
  result,
}: {
  result: ReturnType<typeof computeRefinanceScenario>;
}) {
  return (
    <div className="space-y-1.5 text-[12px]">
      <Row label="Property Value at Refi" value={fmtMoney(result.propertyValue)} />
      <Row label="New Senior Loan" value={fmtMoney(result.newLoan)} />
      <Row label="− Existing Senior Payoff" value={fmtMoney(result.existingSeniorPayoff)} muted />
      <Row label="− Mezz Payoff" value={fmtMoney(result.mezzPayoff)} muted />
      <Row label="Net Refi Proceeds (Cash Out)" value={fmtMoney(result.cashOut)} bold />
      <div className="border-t border-rp-gray-200 my-2" />
      <Row label="New Debt Service" value={fmtMoney(result.newAnnualDS)} />
      <Row label="Cash Flow Post-Refi" value={fmtMoney(result.postRefiCF)} bold />
      <div className="border-t border-rp-gray-200 my-2" />
      <Row label="Capital Returned" value={fmtMoney(result.totalCapitalReturned)} bold />
      <Row label="Remaining Equity" value={fmtMoney(result.remainingEquity)} muted />
      <Row
        label="Cash-on-Remaining"
        value={result.cashOnRemainingPct !== null ? fmtPct(result.cashOnRemainingPct) : '—'}
        bold
      />
    </div>
  );
}

function Row({
  label,
  value,
  muted = false,
  bold = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-rp-gray-500' : 'text-rp-gray-700'}>{label}</span>
      <span
        className={`tabular-nums ${bold ? 'font-semibold text-rp-navy' : muted ? 'text-rp-gray-500' : 'text-rp-gray-800'}`}
      >
        {value}
      </span>
    </div>
  );
}
