'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

const maturityData = [
  { year: '2026', amount: '$520B', width: '75%' },
  { year: '2027', amount: '$480B', width: '68%' },
  { year: '2028', amount: '$390B', width: '55%' },
  { year: '2029', amount: '$310B', width: '44%' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface ActivityRow {
  action: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const ADMIN_ACTIONS = [
  'deal_created',
  'deal_published',
  'deal_updated',
  'deal_document_uploaded',
] as const;

const ACTION_COLOR: Record<string, string> = {
  deal_created: 'bg-[#0B8A4D]',
  deal_published: 'bg-[#BC9C45]',
  deal_updated: 'bg-[#1D5FB8]',
  deal_document_uploaded: 'bg-[#0E3470]',
};

export default function MarketIntelSidebar() {
  const t = useTranslations('portal.marketIntel');
  const ta = useTranslations('admin.activity');

  const actionTitles: Record<string, string> = {
    deal_created: ta('dealCreated'),
    deal_published: ta('dealPublished'),
    deal_updated: ta('dealUpdated'),
    deal_document_uploaded: ta('dealDocumentUploaded'),
  };

  const docCategoryLabel = (cat: unknown): string | null => {
    switch (cat) {
      case 'om': return ta('docCategoryOm');
      case 'loi': return ta('docCategoryLoi');
      case 'psa': return ta('docCategoryPsa');
      case 'full_report': return ta('docCategoryFullReport');
      case 'costar_report': return ta('docCategoryCostarReport');
      case 'tenants_report': return ta('docCategoryTenantsReport');
      case 'lease_summary': return ta('docCategoryLeaseSummary');
      case 'dataroom': return ta('docCategoryDataroom');
      default: return null;
    }
  };

  const getDetail = (item: ActivityRow): string | null => {
    const meta = item.metadata ?? {};
    if (item.action === 'deal_document_uploaded') {
      return docCategoryLabel((meta as { document_category?: unknown }).document_category);
    }
    if (item.action === 'deal_updated' || item.action === 'deal_published') {
      const fields = (meta as { changed_fields?: unknown }).changed_fields;
      if (Array.isArray(fields) && fields.length > 0) {
        return ta('fieldsUpdated', { count: fields.length });
      }
    }
    return null;
  };

  const [activities, setActivities] = useState<ActivityRow[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('terminal_activity_log')
      .select('action, created_at, metadata')
      .in('action', ADMIN_ACTIONS as unknown as string[])
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setActivities((data as ActivityRow[] | null) ?? []);
      });
  }, []);

  return (
    <aside className="w-full lg:w-[320px] flex flex-col gap-4">
      {/* Card 1: Market Cycle */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow" data-tour="market-sidebar">
        <h3
          className="uppercase font-[700] tracking-[1px] mb-4"
          style={{ fontSize: '11px', color: '#0E3470', letterSpacing: '1px' }}
        >
          {t('marketCycle')}
        </h3>

        <div className="relative mt-2 mb-3">
          <div
            className="h-2 rounded-full w-full"
            style={{
              background:
                'linear-gradient(90deg, #0B8A4D 0%, #BC9C45 40%, #D97706 60%, #DC2626 100%)',
              opacity: 0.6,
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: '32%' }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-white"
              style={{
                backgroundColor: '#BC9C45',
                boxShadow: '0 0 8px rgba(188,156,69,0.4)',
              }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center mt-1">
          <span
            className="uppercase font-[600]"
            style={{ fontSize: '9px', color: '#0B8A4D', letterSpacing: '1px' }}
          >
            {t('recovery')}
          </span>
          <span
            className="uppercase font-[600]"
            style={{ fontSize: '9px', color: '#BC9C45', letterSpacing: '1px' }}
          >
            &larr; {t('here')}
          </span>
          <span
            className="uppercase font-[600]"
            style={{ fontSize: '9px', color: '#DC2626', letterSpacing: '1px' }}
          >
            {t('peak')}
          </span>
        </div>
      </div>

      {/* Card 2: CRE Maturity Wall */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
        <h3
          className="uppercase font-[700] tracking-[1px] mb-4"
          style={{ fontSize: '11px', color: '#0E3470', letterSpacing: '1px' }}
        >
          {t('creMaturityWall')}
        </h3>

        <div className="flex flex-col gap-3">
          {maturityData.map((row) => (
            <div key={row.year}>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="font-[600]"
                  style={{ fontSize: '11px', color: '#0E3470' }}
                >
                  {row.year}
                </span>
                <span
                  className="font-[700]"
                  style={{ fontSize: '11px', color: '#BC9C45' }}
                >
                  {row.amount}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-[6px]">
                <div
                  className="h-[6px] rounded-full"
                  style={{
                    width: row.width,
                    background: 'linear-gradient(90deg, #0E3470, #BC9C45)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card 3: Terminal Activity Feed — real data */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="live-dot animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0B8A4D] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0B8A4D]" />
          </span>
          <h3
            className="uppercase font-[700] tracking-[1px]"
            style={{ fontSize: '11px', color: '#0E3470', letterSpacing: '1px' }}
          >
            {t('terminalActivity')}
          </h3>
        </div>

        <div className="flex flex-col gap-3">
          {activities.length === 0 ? (
            <p style={{ fontSize: '11px', color: '#94A3B8' }}>{t('noRecentActivity')}</p>
          ) : (
            activities.map((item, idx) => {
              const title = actionTitles[item.action] ?? item.action;
              const color = ACTION_COLOR[item.action] ?? 'bg-[#9CA3AF]';
              const dealName = (item.metadata as { deal_name?: unknown } | null)?.deal_name;
              const detail = getDetail(item);
              return (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 animate-slide-in"
                  style={{ animationDelay: `${idx * 0.06}s` }}
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${color}`}
                  />
                  <div className="min-w-0">
                    <p
                      className="font-[500] leading-tight truncate"
                      style={{ fontSize: '11px', color: '#0E3470' }}
                    >
                      {typeof dealName === 'string' && dealName
                        ? `${title}: ${dealName}`
                        : title}
                    </p>
                    {detail && (
                      <p
                        className="mt-0.5 truncate"
                        style={{ fontSize: '10px', color: '#0E3470', opacity: 0.65 }}
                      >
                        {detail}
                      </p>
                    )}
                    <p
                      className="mt-0.5"
                      style={{ fontSize: '10px', color: '#94A3B8' }}
                    >
                      {timeAgo(item.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
