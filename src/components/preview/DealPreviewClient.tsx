'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatPrice, formatPercent, formatDSCR, formatSqFt } from '@/lib/utils/format';
import RePrimeLogo from '@/components/RePrimeLogo';

interface PreviewDeal {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  property_type: string | null;
  class_type: string | null;
  square_footage: string | number | null;
  units: string | number | null;
  purchase_price: string | number | null;
  equity_required: string | number | null;
  cap_rate: string | number | null;
  noi: string | number | null;
  dscr: string | number | null;
  occupancy: string | number | null;
  seller_financing: boolean | null;
  note_sale: boolean | null;
  status: string;
}

interface SuggestedDeal {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  property_type: string | null;
  purchase_price: string | number | null;
  cap_rate: string | number | null;
  photo_url: string | null;
}

interface DealPreviewClientProps {
  locale: string;
  deal: PreviewDeal;
  photoUrls: string[];
  tenantCount: number;
  suggestedDeals: SuggestedDeal[];
}

function isZeroish(value: string | number | null | undefined): boolean {
  if (value == null || value === '') return true;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[$,\s]/g, ''));
  return !isNaN(n) && n === 0;
}

export default function DealPreviewClient({
  locale,
  deal,
  photoUrls,
  tenantCount,
  suggestedDeals,
}: DealPreviewClientProps) {
  const t = useTranslations('preview');
  const tPt = useTranslations('portal.propertyTypes');
  const [activePhoto, setActivePhoto] = useState(0);

  const address = [deal.address, deal.city, deal.state].filter(Boolean).join(', ');
  const cityState = [deal.city, deal.state].filter(Boolean).join(', ');
  const propertyTypeLabel = deal.property_type
    ? (tPt.has(deal.property_type) ? tPt(deal.property_type) : deal.property_type)
    : '';
  const sqftLabel = deal.square_footage ? formatSqFt(deal.square_footage) : null;
  const subline = [cityState, propertyTypeLabel, sqftLabel].filter(Boolean).join(' · ');
  const equityDisplay = isZeroish(deal.equity_required) ? '$0' : formatPrice(deal.equity_required);

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* ─── Header ─── */}
      <header className="bg-white border-b border-[#EEF0F4]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <Link href="/" locale={locale} className="flex items-center min-w-0">
            <RePrimeLogo width={140} variant="navy" />
            <span className="px-1.5 py-[2px] rounded bg-[#0E3470] text-[#FFFFFF] text-[8px] font-bold uppercase tracking-[1.5px] leading-none self-center">
              Beta
            </span>
          </Link>
          
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              locale={locale}
              className="hidden sm:inline-block px-4 py-2 text-[12px] font-semibold text-[#0E3470] hover:text-[#BC9C45] transition-colors"
            >
              {t('signIn')}
            </Link>
            <Link
              href="/join"
              locale={locale}
              className="px-4 py-2 rounded-lg bg-[#0E3470] text-white text-[12px] font-semibold hover:bg-[#0C2C5E] transition-colors"
            >
              {t('joinNow')}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-5 md:px-8 py-8 md:py-10">
        {/* ─── Property Header ─── */}
        <div className="mb-6">
          <h1 className="text-[28px] md:text-[36px] font-semibold text-[#0E3470] font-[family-name:var(--font-playfair)] leading-tight tracking-[-0.01em]">
            {deal.name}
          </h1>
          {subline && (
            <p className="text-[13px] md:text-[14px] text-[#6B7280] mt-2">{subline}</p>
          )}
          {address && address !== cityState && (
            <p className="text-[12px] text-[#9CA3AF] mt-1">{address}</p>
          )}
        </div>

        {/* ─── Photo ─── */}
        <div className="rounded-2xl overflow-hidden bg-white border border-[#EEF0F4] mb-6 rp-card-shadow">
          <div className="relative w-full aspect-[16/9] bg-[#0A1628]">
            {photoUrls.length > 0 ? (
              <img
                src={photoUrls[activePhoto] ?? photoUrls[0]}
                alt={deal.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0E3470 40%, #1D5FB8 100%)' }}>
                <svg className="w-20 h-20" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'rgba(255,255,255,0.20)' }}>
                  <path d="M3 21V7l9-4 9 4v14H3zm2-2h5v-4h4v4h5V8.3l-7-3.1L5 8.3V19zm2-6h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-8-4h2v2H7V9zm4 0h2v2h-2V9zm4 0h2v2h-2V9z" />
                </svg>
              </div>
            )}
          </div>
          {photoUrls.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto bg-white">
              {photoUrls.map((url, idx) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActivePhoto(idx)}
                  className={`relative w-20 h-14 rounded-md overflow-hidden border-2 shrink-0 transition-colors ${
                    idx === activePhoto ? 'border-[#BC9C45]' : 'border-transparent hover:border-[#EEF0F4]'
                  }`}
                >
                  <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── Headline metrics: Purchase Price + Equity Required ─── */}
        <div className="bg-white rounded-2xl border border-[#EEF0F4] rp-card-shadow p-5 md:p-7 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[1.8px]">
                {t('purchasePrice')}
              </div>
              <div className="text-[28px] md:text-[34px] font-bold text-[#0E3470] tabular-nums leading-tight tracking-[-0.03em] mt-2">
                {formatPrice(deal.purchase_price)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[1.8px]">
                {t('equityRequired')}
              </div>
              <div className="text-[28px] md:text-[34px] font-bold text-[#0B8A4D] tabular-nums leading-tight tracking-[-0.03em] mt-2">
                {equityDisplay}
              </div>
            </div>
          </div>

          {/* ─── Visible secondary metrics ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#EEF0F4]">
            <Metric label={t('capRate')} value={formatPercent(deal.cap_rate)} />
            <Metric label={t('noi')} value={formatPrice(deal.noi)} />
            <Metric label={t('dscr')} value={formatDSCR(deal.dscr)} />
            <Metric label={t('occupancy')} value={deal.occupancy ? `${deal.occupancy}%` : '—'} />
          </div>

          {/* ─── Property type / financing badges ─── */}
          <div className="flex flex-wrap items-center gap-1.5 mt-5">
            {propertyTypeLabel && (
              <span className="bg-[#0E3470] text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full">
                {propertyTypeLabel}
              </span>
            )}
            {deal.class_type && (
              <span className="bg-[#EFF4FA] text-[#0E3470] text-[10px] font-semibold px-2.5 py-[5px] rounded-full">
                {t('classBadge', { class: deal.class_type })}
              </span>
            )}
            {tenantCount > 0 && (
              <span className="bg-[#EFF4FA] text-[#0E3470] text-[10px] font-semibold px-2.5 py-[5px] rounded-full">
                {t('tenants', { count: tenantCount })}
              </span>
            )}
            {deal.seller_financing && (
              <span
                className="text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full"
                style={{ background: 'linear-gradient(135deg, #BC9C45 0%, #D4B85A 50%, #BC9C45 100%)' }}
              >
                {t('sellerFinancing')}
              </span>
            )}
            {deal.note_sale && (
              <span
                className="text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full"
                style={{ background: 'linear-gradient(135deg, #7C1D3F 0%, #A33B5C 50%, #7C1D3F 100%)' }}
              >
                {t('noteSale')}
              </span>
            )}
          </div>
        </div>

        {/* ─── Gated panel ─── */}
        <div className="relative bg-white rounded-2xl border border-[#EEF0F4] rp-card-shadow p-6 md:p-8 mb-5 overflow-hidden">
          {/* Blurred placeholder content */}
          <div className="select-none pointer-events-none blur-[6px] opacity-60">
            <div className="grid grid-cols-3 gap-6">
              <PlaceholderMetric label="IRR" value="00.00%" />
              <PlaceholderMetric label="CoC" value="00.00%" />
              <PlaceholderMetric label="Equity Multiple" value="0.00x" />
            </div>
            <div className="mt-6 space-y-2">
              <div className="h-3 bg-[#EEF0F4] rounded-full w-full" />
              <div className="h-3 bg-[#EEF0F4] rounded-full w-11/12" />
              <div className="h-3 bg-[#EEF0F4] rounded-full w-3/4" />
              <div className="h-3 bg-[#EEF0F4] rounded-full w-5/6" />
              <div className="h-3 bg-[#EEF0F4] rounded-full w-2/3" />
            </div>
          </div>
          {/* Gated overlay copy */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-white/40 backdrop-blur-[2px]">
            <div className="w-12 h-12 rounded-full bg-[#0E3470]/10 flex items-center justify-center mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E3470" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <p className="text-[14px] md:text-[15px] font-semibold text-[#0E3470] max-w-[480px]">
              {t('gatedHeadline')}
            </p>
            <p className="text-[12px] md:text-[13px] text-[#6B7280] max-w-[480px] mt-1.5">
              {t('gatedSubline')}
            </p>
          </div>
        </div>

        {/* ─── CTA ─── */}
        <div className="bg-gradient-to-br from-[#0E3470] to-[#0C2C5E] rounded-2xl p-6 md:p-8 mb-10 text-center">
          <h2 className="text-[20px] md:text-[24px] font-semibold text-white font-[family-name:var(--font-playfair)] mb-2">
            {t('ctaTitle')}
          </h2>
          <p className="text-[13px] md:text-[14px] text-white/70 max-w-[520px] mx-auto mb-5">
            {t('ctaBody')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/join"
              locale={locale}
              className="px-6 py-3 rounded-lg bg-[#BC9C45] text-white text-[13px] font-bold hover:bg-[#A88A3D] transition-colors shadow-[0_4px_14px_rgba(188,156,69,0.35)]"
            >
              {t('joinNow')}
            </Link>
            <Link
              href="/login"
              locale={locale}
              className="px-6 py-3 rounded-lg border border-white/30 text-white text-[13px] font-semibold hover:bg-white/10 transition-colors"
            >
              {t('loginNow')}
            </Link>
          </div>
          <p className="text-[12px] text-white/50 mt-4">
            {t('joinOrLoginExplore')}
          </p>
        </div>

        {/* ─── More opportunities ─── */}
        {suggestedDeals.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[18px] md:text-[20px] font-semibold text-[#0E3470] font-[family-name:var(--font-playfair)]">
                {t('moreOpportunities')}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestedDeals.map((s) => (
                <SuggestedCard key={s.id} deal={s} locale={locale} />
              ))}
            </div>
            <p className="text-[12px] text-[#6B7280] text-center mt-5">
              {t('joinOrLoginExplore')}
            </p>
          </section>
        )}
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[#EEF0F4] bg-white">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 py-6 flex flex-col sm:flex-row items-center sm:justify-between gap-2">
          <div className="flex items-center">
            <RePrimeLogo width={150} variant="navy" />
            <span className="px-1.5 py-[2px] rounded bg-[#0E3470] text-[#FFFFFF] text-[8px] font-bold uppercase tracking-[1.5px] leading-none self-center">
              Beta
            </span>
          </div>
          <p className="text-[10px] text-[#9CA3AF] text-center">
            {t('copyright', { year: new Date().getFullYear().toString() })}
          </p>
        </div>
      </footer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[1.8px]">
        {label}
      </div>
      <div className="text-[18px] font-semibold text-[#0E3470] tabular-nums leading-none mt-1.5">
        {value ?? '—'}
      </div>
    </div>
  );
}

function PlaceholderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[1.8px]">{label}</div>
      <div className="text-[20px] font-semibold text-[#0E3470] tabular-nums leading-none mt-1.5">
        {value}
      </div>
    </div>
  );
}

function SuggestedCard({ deal, locale }: { deal: SuggestedDeal; locale: string }) {
  const t = useTranslations('preview');
  const tPt = useTranslations('portal.propertyTypes');
  const cityState = [deal.city, deal.state].filter(Boolean).join(', ');
  const propertyTypeLabel = deal.property_type
    ? (tPt.has(deal.property_type) ? tPt(deal.property_type) : deal.property_type)
    : '';
  return (
    <Link
      href={`/deal/${deal.id}`}
      locale={locale}
      className="group relative block bg-white rounded-[14px] overflow-hidden border border-transparent rp-card-shadow hover:rp-card-shadow-hover transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative h-[140px] bg-[#0A1628] overflow-hidden">
        {deal.photo_url ? (
          <img src={deal.photo_url} alt={deal.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0E3470 40%, #1D5FB8 100%)' }} />
        )}
        {propertyTypeLabel && (
          <div className="absolute top-2 left-2">
            <span className="bg-[#0E3470]/85 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full">
              {propertyTypeLabel}
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-[15px] font-semibold text-[#0E3470] truncate">{deal.name}</h3>
        {cityState && <p className="text-[11px] text-[#6B7280] truncate mt-0.5">{cityState}</p>}
        <div className="flex items-baseline justify-between mt-3">
          <span className="text-[14px] font-bold text-[#0E3470] tabular-nums">
            {formatPrice(deal.purchase_price)}
          </span>
          {deal.cap_rate != null && (
            <span className="text-[12px] font-semibold text-[#0B8A4D] tabular-nums">
              {formatPercent(deal.cap_rate)} {t('capRateShort')}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
