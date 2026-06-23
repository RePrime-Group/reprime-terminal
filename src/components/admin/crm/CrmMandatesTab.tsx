'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { TerminalCrmMandate } from '@/lib/types/database';
import { formatPrice } from '@/lib/utils/format';
import {
  PROPERTY_TYPE_LABEL,
  STRATEGY_LABEL,
  STRUCTURE_LABEL,
  LISTING_TYPE_LABEL,
  PROPERTY_CLASS_LABEL,
  TENANT_CREDIT_LABEL,
} from './CrmConstants';
import { formatNumber } from '@/lib/utils/format';
import CrmMandateForm, {
  EMPTY_MANDATE,
  mandateRowToInput,
  validateMandate,
  type MandateInput,
} from './CrmMandateForm';
import {
  createMandate,
  updateMandate,
  deleteMandate,
  toggleMandateActive,
} from '@/app/[locale]/(admin)/admin/crm/actions';

type EditState = { mode: 'create' } | { mode: 'edit'; mandate: TerminalCrmMandate } | null;

export default function CrmMandatesTab({
  investorId,
  mandates,
}: {
  investorId: string;
  mandates: TerminalCrmMandate[];
}) {
  const t = useTranslations('admin.crm');
  const router = useRouter();
  const [edit, setEdit] = useState<EditState>(null);
  const [form, setForm] = useState<MandateInput>(EMPTY_MANDATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setForm(EMPTY_MANDATE);
    setError(null);
    setEdit({ mode: 'create' });
  };

  const openEdit = (mandate: TerminalCrmMandate) => {
    setForm(mandateRowToInput(mandate));
    setError(null);
    setEdit({ mode: 'edit', mandate });
  };

  const handleSave = async () => {
    const validationError = validateMandate(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    const result =
      edit?.mode === 'edit'
        ? await updateMandate(edit.mandate.id, investorId, form)
        : await createMandate(investorId, form);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEdit(null);
    router.refresh();
  };

  const handleDelete = async (m: TerminalCrmMandate) => {
    if (!confirm(`Delete mandate "${m.label || 'Untitled'}"?`)) return;
    const result = await deleteMandate(m.id, investorId);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  const handleToggle = async (m: TerminalCrmMandate) => {
    const result = await toggleMandateActive(m.id, investorId, !m.is_active);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      {edit ? (
        <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-rp-navy uppercase tracking-wider">
              {edit.mode === 'create' ? t('addMandate') : t('editMandate')}
            </h3>
          </div>
          <CrmMandateForm value={form} onChange={setForm} theme="light" />
          {error && <p className="text-sm text-rp-red">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => {
                setEdit(null);
                setError(null);
              }}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-rp-gray-200 text-sm font-medium text-rp-gray-600 hover:bg-rp-gray-100"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {saving ? t('saving') : t('saveMandate')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={openCreate}
          className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-sm font-semibold hover:opacity-90"
        >
          + {t('addMandate')}
        </button>
      )}

      {mandates.length === 0 && !edit ? (
        <div className="text-center py-12 bg-white rounded-xl border border-rp-gray-200">
          <p className="text-sm text-rp-gray-500">{t('mandatesEmpty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {mandates.map((m) => (
            <MandateCard
              key={m.id}
              mandate={m}
              onEdit={() => openEdit(m)}
              onDelete={() => handleDelete(m)}
              onToggle={() => handleToggle(m)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MandateCard({
  mandate,
  onEdit,
  onDelete,
  onToggle,
}: {
  mandate: TerminalCrmMandate;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const t = useTranslations('admin.crm');

  const priceLine = formatRange(mandate.min_price, mandate.max_price, formatPrice);
  const sqftLine = formatRange(mandate.min_sqft, mandate.max_sqft, (v) => `${formatNumber(v)} SF`);
  const occupancyLine = formatRange(mandate.min_occupancy, mandate.max_occupancy, (v) => `${v}%`);

  return (
    <div
      className={`bg-white rounded-xl border rp-card-shadow p-4 flex flex-col gap-3 ${
        mandate.is_active ? 'border-rp-gray-200' : 'border-rp-gray-200 opacity-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-rp-navy truncate">
            {mandate.label || t('untitledMandate')}
          </p>
          {!mandate.is_active && (
            <span className="text-[10px] text-rp-gray-400 uppercase tracking-wide">Inactive</span>
          )}
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <IconBtn onClick={onEdit} title={t('edit')}>✎</IconBtn>
          <IconBtn onClick={onToggle} title={mandate.is_active ? t('deactivate') : t('activate')}>
            {mandate.is_active ? '○' : '●'}
          </IconBtn>
          <IconBtn onClick={onDelete} title={t('delete')}>×</IconBtn>
        </div>
      </div>

      {/* Property types + listing types row */}
      {(mandate.property_types.length > 0 || mandate.listing_types.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {mandate.property_types.map((pt) => (
            <Tag key={`pt-${pt}`} tone="gray">
              {PROPERTY_TYPE_LABEL[pt] ?? pt}
            </Tag>
          ))}
          {mandate.listing_types.map((lt) => (
            <Tag key={`lt-${lt}`} tone="blue">
              {LISTING_TYPE_LABEL[lt] ?? lt}
            </Tag>
          ))}
        </div>
      )}

      {/* Markets */}
      {mandate.states.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mandate.states.map((s) => (
            <Tag key={s} tone="gold">{s}</Tag>
          ))}
        </div>
      )}

      {/* Primary numeric grid: Price + Cap + CoC */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <Stat label={t('prefCheckSize')} value={priceLine} prominent />
        <Stat label="Min Cap" value={mandate.min_cap ? `${mandate.min_cap}%` : '—'} />
        <Stat label="Min CoC" value={mandate.min_coc ? `${mandate.min_coc}%` : '—'} />
      </div>

      {/* Secondary numeric grid: SqFt + PSF + Lease term + Occupancy */}
      {(mandate.min_sqft || mandate.max_sqft || mandate.price_per_sf_max ||
        mandate.min_lease_term_years || mandate.min_occupancy || mandate.max_occupancy) && (
        <div className="grid grid-cols-2 gap-2">
          {(mandate.min_sqft || mandate.max_sqft) && (
            <Stat label="Square Footage" value={sqftLine} />
          )}
          {mandate.price_per_sf_max && (
            <Stat label="PSF Ceiling" value={formatPrice(mandate.price_per_sf_max)} />
          )}
          {mandate.min_lease_term_years && (
            <Stat label="Min Lease Term" value={`${mandate.min_lease_term_years} yrs`} />
          )}
          {(mandate.min_occupancy || mandate.max_occupancy) && (
            <Stat label="Occupancy" value={occupancyLine} />
          )}
        </div>
      )}

      {/* Strategy + tenant credit + property class */}
      {(mandate.strategy || mandate.tenant_credit_pref || mandate.property_class.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {mandate.strategy && (
            <Stat label="Strategy" value={STRATEGY_LABEL[mandate.strategy] ?? mandate.strategy} />
          )}
          {mandate.tenant_credit_pref && (
            <Stat
              label="Tenant Credit"
              value={TENANT_CREDIT_LABEL[mandate.tenant_credit_pref] ?? mandate.tenant_credit_pref}
            />
          )}
          {mandate.property_class.length > 0 && (
            <div className="col-span-2">
              <div className="text-[9px] uppercase tracking-wide text-rp-gray-400 mb-1">Property Class</div>
              <div className="flex flex-wrap gap-1.5">
                {mandate.property_class.map((c) => (
                  <Tag key={c} tone="gray">{PROPERTY_CLASS_LABEL[c] ?? c}</Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Structure preferences */}
      {mandate.structure_prefs.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wide text-rp-gray-400 mb-1">Structures</div>
          <div className="flex flex-wrap gap-1.5">
            {mandate.structure_prefs.map((s) => (
              <Tag key={s} tone="gray-soft">{STRUCTURE_LABEL[s] ?? s}</Tag>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {mandate.notes && (
        <div className="border-t border-rp-gray-200 pt-2 mt-1">
          <div className="text-[9px] uppercase tracking-wide text-rp-gray-400 mb-1">Ideal Deal</div>
          <p className="text-[11px] text-rp-gray-600 italic whitespace-pre-wrap">{mandate.notes}</p>
        </div>
      )}
    </div>
  );
}

function formatRange(
  min: string | null,
  max: string | null,
  fmt: (v: string) => string,
): string {
  if (!min && !max) return '—';
  return `${min ? fmt(min) : '—'} — ${max ? fmt(max) : '—'}`;
}

function Tag({ tone, children }: { tone: 'gray' | 'gray-soft' | 'gold' | 'blue'; children: React.ReactNode }) {
  const cls =
    tone === 'gold'      ? 'bg-rp-gold-bg text-rp-gold' :
    tone === 'blue'      ? 'bg-[#EAF1FB] text-[#1D5FB8]' :
    tone === 'gray-soft' ? 'bg-rp-gray-100 text-rp-gray-500' :
                           'bg-rp-gray-100 text-rp-gray-700';
  return <span className={`px-2 py-0.5 rounded-md text-[11px] ${cls}`}>{children}</span>;
}

function Stat({ label, value, prominent }: { label: string; value: string; prominent?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-rp-gray-400">{label}</div>
      <div className={`tabular-nums ${prominent ? 'text-rp-navy font-semibold text-[12px]' : 'text-rp-gray-700 text-[11px]'}`}>
        {value}
      </div>
    </div>
  );
}

function IconBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-6 h-6 flex items-center justify-center rounded text-rp-gray-400 hover:text-rp-navy hover:bg-rp-gray-100 text-sm"
    >
      {children}
    </button>
  );
}

