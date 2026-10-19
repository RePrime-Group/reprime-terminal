'use client';

import { Fragment, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  sortTenantsForDisplay,
  computeWALT,
  computeOccupancy,
  computeTotalRent,
  computeAvgRentPerSf,
  computeTopTenant,
  computeNearTermRollover,
  computeExpirationSchedule,
  formatMoney,
  formatRentPerSf,
  parseLooseDate,
  creditRatingColor,
} from '@/lib/utils/rent-roll';
import type { TerminalTenantLease } from '@/lib/types/database';

interface BuildingOption {
  id: string;
  label: string;
  squareFootage?: number | null;
}

interface RentRollTabProps {
  tenants: TerminalTenantLease[];
  dealTotalSf?: number | null;
  isPortfolio?: boolean;
  buildings?: BuildingOption[];
}

const ALL_BUILDINGS = '__all__';

function formatLeaseDateLocalized(value: string | null | undefined, intlLocale: string): string {
  if (!value) return '—';
  const d = parseLooseDate(value);
  if (!d) return value;
  return d.toLocaleDateString(intlLocale, { month: 'short', year: 'numeric' });
}

export default function RentRollTab({
  tenants,
  dealTotalSf,
  isPortfolio = false,
  buildings = [],
}: RentRollTabProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(ALL_BUILDINGS);
  const t = useTranslations('portal.rentRoll');
  const tDd = useTranslations('portal.dealDetail');
  const intlLocale = useLocale() === 'he' ? 'he-IL' : 'en-US';

  // Filter tenants by the selected building for portfolios. Single-property
  // deals skip the dropdown and always use the full set.
  const filtered = isPortfolio && selectedBuildingId !== ALL_BUILDINGS
    ? tenants.filter((t) => t.address_id === selectedBuildingId)
    : tenants;

  // The SF denominator follows the filter: per-building when a building is
  // picked, otherwise the deal-level SF.
  const denominatorSf = (() => {
    if (!isPortfolio || selectedBuildingId === ALL_BUILDINGS) return dealTotalSf ?? null;
    const b = buildings.find((x) => x.id === selectedBuildingId);
    return b?.squareFootage ?? null;
  })();

  const sorted = sortTenantsForDisplay(filtered);
  const walt = computeWALT(filtered);
  const { occupancyPct } = computeOccupancy(filtered, denominatorSf);
  const totalRent = computeTotalRent(filtered);
  const avgRentPerSf = computeAvgRentPerSf(filtered);
  const topTenant = computeTopTenant(filtered);
  const rollover = computeNearTermRollover(filtered);
  const schedule = computeExpirationSchedule(filtered);
  const totalLeasedSf = filtered.reduce(
    (s, l) => (l.is_vacant ? s : s + (l.leased_sf ?? 0)),
    0,
  );
  const totalAllSf = filtered.reduce((s, l) => s + (l.leased_sf ?? 0), 0);

  const maxBarPct = Math.max(
    1,
    ...schedule.map((b) => b.pctOfRent),
  );

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (tenants.length === 0) {
    return (
      <div className="rounded-xl border border-[#EEF0F4] bg-white p-10 text-center">
        <p className="text-sm text-[#6B7280]">{t('comingSoon')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Building selector (portfolio only) */}
      {isPortfolio && buildings.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-[11px] font-semibold tracking-[1.5px] uppercase text-[#9CA3AF]">
            {t('building')}
          </label>
          <select
            value={selectedBuildingId}
            onChange={(e) => setSelectedBuildingId(e.target.value)}
            className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] text-[#0E3470] bg-white focus:outline-none focus:ring-2 focus:ring-[#BC9C45]/20 focus:border-[#BC9C45]"
          >
            <option value={ALL_BUILDINGS}>{t('allBuildings')}</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-[#9CA3AF]">
            {t('tenantCount', { count: filtered.length })}
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#EEF0F4] bg-white p-10 text-center">
          <p className="text-sm text-[#6B7280]">
            {t('noTenantsForBuilding')}
          </p>
        </div>
      ) : (
      <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="WALT"
          value={walt === null || !Number.isFinite(walt) ? '—' : t('years', { value: walt.toFixed(1) })}
          sublabel={t('waltSublabel')}
        />
        <MetricCard
          label={tDd('occupancy')}
          value={occupancyPct !== null ? `${occupancyPct.toFixed(1)}%` : '—'}
          sublabel={
            totalAllSf > 0
              ? t('occupancySf', {
                  leased: totalLeasedSf.toLocaleString(),
                  total: (dealTotalSf && dealTotalSf > 0 ? dealTotalSf : totalAllSf).toLocaleString(),
                })
              : undefined
          }
        />
        <MetricCard
          label={t('topTenant')}
          value={topTenant ? `${topTenant.tenant.tenant_name}` : '—'}
          sublabel={topTenant ? t('pctOfRent', { pct: topTenant.pctOfRent.toFixed(0) }) : undefined}
        />
        <MetricCard
          label={t('nearTermRollover')}
          value={
            rollover.length === 0
              ? t('noneUnder3Yrs')
              : `${rollover[0].tenant.tenant_name}`
          }
          sublabel={
            rollover.length === 0
              ? t('allLeasesSecure')
              : t('rolloverExpires', {
                  pct: rollover[0].pctOfRent.toFixed(0),
                  date: formatLeaseDateLocalized(rollover[0].tenant.lease_end_date, intlLocale),
                })
          }
          accent={rollover.length === 0 ? 'green' : 'amber'}
        />
      </div>

      {/* Tenant table */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EEF0F4] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#0E3470]">{t('tenantRoster')}</h3>
          <span className="text-[11px] text-[#6B7280]">{t('clickToExpand')}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[#6B7280] bg-[#F7F8FA]">
                <th className="px-4 py-2.5 font-semibold">{t('colTenant')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('colSuite')}</th>
                <th className="px-3 py-2.5 font-semibold text-right">{t('colSf')}</th>
                <th className="px-3 py-2.5 font-semibold text-right">{t('colRentPerSf')}</th>
                <th className="px-3 py-2.5 font-semibold text-right">{t('colAnnualRent')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('colType')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('colLeaseEnd')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('escalations')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((lease) => {
                const expanded = expandedIds.has(lease.id);
                const rowClass = lease.is_vacant
                  ? 'bg-[#F7F8FA] text-[#9CA3AF] italic'
                  : 'hover:bg-[#FAFBFC]';
                return (
                  <Fragment key={lease.id}>
                    <tr
                      onClick={() => toggle(lease.id)}
                      className={`border-t border-[#EEF0F4] cursor-pointer transition ${rowClass}`}
                    >
                      <td className="px-4 py-3 font-medium text-[#0E3470]">
                        <div className="flex items-center gap-2">
                          <span className="text-[#6B7280] text-xs">
                            {expanded ? '▼' : '▶'}
                          </span>
                          {lease.is_anchor && (
                            <span className="text-[#BC9C45]" title={t('anchorTenant')}>★</span>
                          )}
                          <span className={lease.is_vacant ? 'italic' : ''} dir="auto">
                            {lease.is_vacant ? t('vacant') : lease.tenant_name}
                          </span>
                          {lease.tenant_credit_rating && !lease.is_vacant && (
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{
                                color: creditRatingColor(lease.tenant_credit_rating),
                                backgroundColor: `${creditRatingColor(lease.tenant_credit_rating)}14`,
                              }}
                            >
                              {t.has(`creditRatings.${lease.tenant_credit_rating}`)
                                ? t(`creditRatings.${lease.tenant_credit_rating}`)
                                : lease.tenant_credit_rating}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3"><bdi>{lease.suite_unit ?? '—'}</bdi></td>
                      <td className="px-3 py-3 text-right">
                        {lease.leased_sf ? lease.leased_sf.toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {lease.is_vacant ? '—' : formatRentPerSf(lease.rent_per_sf)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {lease.is_vacant ? '—' : formatMoney(lease.annual_base_rent)}
                      </td>
                      <td className="px-3 py-3">
                        {lease.is_vacant
                          ? '—'
                          : t.has(`leaseTypes.${lease.lease_type}`)
                            ? t(`leaseTypes.${lease.lease_type}`)
                            : lease.lease_type}
                      </td>
                      <td className="px-3 py-3">
                        {lease.is_vacant ? '—' : formatLeaseDateLocalized(lease.lease_end_date, intlLocale)}
                      </td>
                      <td className="px-3 py-3">
                        <bdi>{lease.is_vacant ? '—' : (lease.escalation_structure ?? '—')}</bdi>
                      </td>
                    </tr>
                    {expanded && !lease.is_vacant && (
                      <tr className="bg-[#F7F8FA]">
                        <td colSpan={8} className="px-4 py-4">
                          <TenantDetails lease={lease} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr className="border-t-2 border-[#0E3470] bg-[#F7F8FA] font-semibold text-[#0E3470]">
                <td className="px-4 py-3">{t('total')}</td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3 text-right">{totalAllSf.toLocaleString()}</td>
                <td className="px-3 py-3 text-right">
                  {avgRentPerSf !== null ? t('avgRentPerSf', { value: `$${avgRentPerSf.toFixed(2)}` }) : '—'}
                </td>
                <td className="px-3 py-3 text-right">{formatMoney(totalRent)}</td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Lease Expiration Schedule */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-5">
        <h3 className="text-sm font-semibold text-[#0E3470] mb-4">{t('expirationSchedule')}</h3>
        <div className="space-y-1.5">
          {schedule.map((bucket) => {
            const pct = maxBarPct > 0 ? (bucket.pctOfRent / maxBarPct) * 100 : 0;
            return (
              <div key={bucket.year} className="flex items-center gap-3">
                <div className="w-14 shrink-0 text-xs font-medium text-[#6B7280] tabular-nums">
                  {bucket.year}
                </div>
                <div className="flex-1 h-6 rounded bg-[#F7F8FA] relative overflow-hidden">
                  {bucket.leases.length > 0 && (
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: creditRatingColor(
                          bucket.leases[0].tenant.tenant_credit_rating,
                        ),
                        opacity: 0.85,
                      }}
                    />
                  )}
                  <div className="absolute inset-0 flex items-center px-3 text-[11px] font-medium text-[#0E3470]">
                    {bucket.leases.length === 0
                      ? ''
                      : <span>{t.rich('bucketLabel', {
                          tenants: bucket.leases.map((l) => l.tenant.tenant_name).join(', '),
                          pct: bucket.pctOfRent.toFixed(0),
                          bdi: (chunks) => <bdi>{chunks}</bdi>,
                        })}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-[#6B7280] mt-3">
          {t('creditLegend')}
        </p>
      </div>

      <p className="text-[11px] text-[#9CA3AF] text-center">
        {t('disclaimer')}
      </p>
      </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: 'green' | 'amber';
}) {
  const accentColor =
    accent === 'green' ? '#0B8A4D' : accent === 'amber' ? '#BC9C45' : '#0E3470';
  return (
    <div className="bg-white rounded-xl border border-[#EEF0F4] p-4">
      <div className="text-[10px] font-semibold tracking-[1.5px] uppercase text-[#9CA3AF]">
        {label}
      </div>
      <div
        className="mt-1 text-[16px] font-semibold truncate"
        style={{ color: accentColor }}
        title={value}
      >
        <bdi>{value}</bdi>
      </div>
      {sublabel && <div className="text-[11px] text-[#6B7280] mt-0.5">{sublabel}</div>}
    </div>
  );
}

function TenantDetails({ lease }: { lease: TerminalTenantLease }) {
  const t = useTranslations('portal.rentRoll');
  const intlLocale = useLocale() === 'he' ? 'he-IL' : 'en-US';
  const row: { label: string; value: string | null }[] = [];

  if (lease.lease_start_date || lease.lease_end_date) {
    const parts: string[] = [];
    if (lease.lease_start_date) parts.push(t('leaseStarted', { date: formatLeaseDateLocalized(lease.lease_start_date, intlLocale) }));
    if (lease.lease_end_date) parts.push(t('leaseExpires', { date: formatLeaseDateLocalized(lease.lease_end_date, intlLocale) }));
    row.push({ label: t('lease'), value: parts.join(' · ') });
  }
  if (lease.rent_commencement_date) {
    row.push({ label: t('rentCommencement'), value: formatLeaseDateLocalized(lease.rent_commencement_date, intlLocale) });
  }
  if (lease.option_renewals) {
    row.push({ label: t('options'), value: lease.option_renewals });
  }
  if (lease.escalation_structure) {
    row.push({ label: t('escalations'), value: lease.escalation_structure });
  }

  const reimbursements: string[] = [];
  if (lease.lease_type === 'NNN') reimbursements.push(t('nnnReimbursement'));
  if (lease.cam_reimbursement) reimbursements.push(t('reimbCam', { amount: formatMoney(lease.cam_reimbursement) }));
  if (lease.tax_reimbursement) reimbursements.push(t('reimbTax', { amount: formatMoney(lease.tax_reimbursement) }));
  if (lease.insurance_reimbursement) reimbursements.push(t('reimbInsurance', { amount: formatMoney(lease.insurance_reimbursement) }));
  if (reimbursements.length > 0) {
    row.push({ label: t('reimbursements'), value: reimbursements.join(' · ') });
  }

  if (lease.percentage_rent) {
    row.push({ label: t('percentageRent'), value: lease.percentage_rent });
  }
  if (lease.security_deposit) {
    row.push({ label: t('securityDeposit'), value: formatMoney(lease.security_deposit) });
  }
  if (lease.guarantor) {
    row.push({
      label: t('guarantor'),
      value: t.has(`guarantorTypes.${lease.guarantor}`) ? t(`guarantorTypes.${lease.guarantor}`) : lease.guarantor,
    });
  }
  if (lease.tenant_industry) {
    row.push({ label: t('industry'), value: lease.tenant_industry });
  }
  if (lease.tenant_credit_rating) {
    row.push({
      label: t('credit'),
      value: t.has(`creditRatings.${lease.tenant_credit_rating}`)
        ? t(`creditRatings.${lease.tenant_credit_rating}`)
        : lease.tenant_credit_rating,
    });
  }
  if (lease.status && lease.status !== 'Active') {
    row.push({
      label: t('status'),
      value: t.has(`leaseStatuses.${lease.status}`) ? t(`leaseStatuses.${lease.status}`) : lease.status,
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#0E3470]">
        {lease.is_anchor && <span className="text-[#BC9C45]">★</span>}
        <bdi>{lease.tenant_name}</bdi>
        {lease.is_anchor && <span className="text-[11px] font-medium text-[#BC9C45]">{t('anchorTenant')}</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-[13px]">
        {row.map((r) => (
          <div key={r.label} className="flex gap-2">
            <span className="text-[#6B7280] w-36 shrink-0">{r.label}</span>
            <span className="text-[#0E3470] font-medium" dir="auto">{r.value}</span>
          </div>
        ))}
      </div>
      {lease.notes && (
        <div className="pt-2 mt-2 border-t border-[#EEF0F4] text-[13px] text-[#4B5563]">
          <span className="font-medium text-[#6B7280]">{t('notes')} </span>
          <bdi>{lease.notes}</bdi>
        </div>
      )}
    </div>
  );
}
