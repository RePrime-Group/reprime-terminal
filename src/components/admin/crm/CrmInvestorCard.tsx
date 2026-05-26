'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { TerminalCrmInvestorSummary } from '@/lib/types/database';
import { formatPrice } from '@/lib/utils/format';
import { PROPERTY_TYPE_LABEL, CONTACT_METHODS } from './CrmConstants';
import CrmStatusPill from './CrmStatusPill';
import { CrmAvatar } from './CrmAvatar';

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CrmInvestorCard({
  investor,
  locale,
}: {
  investor: TerminalCrmInvestorSummary;
  locale: string;
}) {
  const t = useTranslations('admin.crm');

  const propertyTypes = investor.investment_preferences?.property_types ?? [];
  const shownTypes = propertyTypes.slice(0, 3);
  const overflow = propertyTypes.length - shownTypes.length;
  const lastContacted = formatDate(investor.last_contacted_at);
  const preferred = CONTACT_METHODS.find((c) => c.value === investor.preferred_contact_method)?.label;

  return (
    <Link
      href={`/${locale}/admin/crm/${investor.id}`}
      className="group flex flex-col bg-white rounded-xl rp-card-shadow hover:rp-card-shadow-hover border border-rp-gray-200 hover:border-rp-gold/40 transition-all overflow-hidden"
    >
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start gap-3">
          <CrmAvatar
            firstName={investor.first_name}
            lastName={investor.last_name}
            photoUrl={investor.photo_url}
            size={44}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-semibold text-rp-navy truncate">{investor.full_name}</p>
              <CrmStatusPill status={investor.status} />
            </div>
            {(investor.company_name || investor.title) && (
              <p className="text-[12px] text-rp-gray-500 truncate">
                {[investor.title, investor.company_name].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* Capital + contact */}
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <div className="text-rp-gray-400 uppercase tracking-wide text-[10px]">{t('capEquityReady')}</div>
            <div className="font-semibold text-rp-navy tabular-nums">
              {investor.equity_ready ? formatPrice(investor.equity_ready) : '—'}
            </div>
          </div>
          <div>
            <div className="text-rp-gray-400 uppercase tracking-wide text-[10px]">{t('preferredContactShort')}</div>
            <div className="font-medium text-rp-gray-700 capitalize">{preferred || '—'}</div>
          </div>
        </div>

        {/* Property type tags */}
        {shownTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {shownTypes.map((pt) => (
              <span key={pt} className="px-2 py-0.5 rounded-md bg-rp-gray-100 text-rp-gray-600 text-[11px]">
                {PROPERTY_TYPE_LABEL[pt] ?? pt}
              </span>
            ))}
            {overflow > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-rp-gray-100 text-rp-gray-400 text-[11px]">
                +{overflow}
              </span>
            )}
          </div>
        )}

        <div className="text-[11px] text-rp-gray-400 mt-auto">
          {lastContacted ? `${t('lastContacted')}: ${lastContacted}` : t('lastContactedNever')}
        </div>
      </div>

      {/* Footer counts */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-rp-gray-200 bg-rp-gray-100/40 text-[11px] text-rp-gray-500">
        <span>
          {investor.message_count} {t('messagesLabel')}
        </span>
        <span className={investor.pending_follow_up_count > 0 ? 'text-rp-red font-semibold' : ''}>
          {investor.pending_follow_up_count} {t('followUpsLabel')}
        </span>
        {investor.pinned_count > 0 && (
          <span>
            📌 {investor.pinned_count} {t('pinnedLabel')}
          </span>
        )}
      </div>
    </Link>
  );
}
