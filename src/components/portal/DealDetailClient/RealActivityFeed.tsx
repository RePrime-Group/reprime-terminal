'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

export function RealActivityFeed({ dealId }: { dealId: string }) {
  const t = useTranslations('portal.dealDetail');
  const tcom = useTranslations('common');
  const [activities, setActivities] = useState<{ action: string; created_at: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('terminal_activity_log')
      .select('action, created_at')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        setActivities(data ?? []);
        setLoaded(true);
      });
  }, [dealId]);

  const actionLabels: Record<string, { text: string; dot: string }> = {
    deal_viewed: { text: t('dealViewedByMember'), dot: 'bg-[#6B7280]' },
    document_downloaded: { text: t('documentDownloaded'), dot: 'bg-[#1D5FB8]' },
    om_downloaded: { text: t('omDownloaded'), dot: 'bg-[#BC9C45]' },
    dataroom_viewed: { text: t('dataRoomAccessed'), dot: 'bg-[#0E3470]' },
    meeting_requested: { text: t('meetingRequested'), dot: 'bg-[#BC9C45]' },
    expressed_interest: { text: t('interestExpressedActivity'), dot: 'bg-[#0B8A4D]' },
    irr_calculator_used: { text: t('irrCalculatorUsed'), dot: 'bg-[#1D5FB8]' },
    structure_viewed: { text: t('dealStructureViewed'), dot: 'bg-[#6B7280]' },
    portal_viewed: { text: t('portalAccessed'), dot: 'bg-[#9CA3AF]' },
  };

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('justNow');
    if (mins < 60) return t('minAgo', { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs > 1 ? t('hrsAgo', { count: hrs }) : t('hrAgo', { count: hrs });
    const days = Math.floor(hrs / 24);
    return days > 1 ? t('daysAgo', { count: days }) : t('dayAgo', { count: days });
  }

  return (
    <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow">
      <h4 className="text-sm font-semibold text-[#0E3470] mb-3">
        {t('recentActivity')}
      </h4>
      <div className="space-y-3">
        {!loaded ? (
          <div className="text-xs text-[#9CA3AF]">{tcom('loading')}</div>
        ) : activities.length === 0 ? (
          <div className="text-xs text-[#9CA3AF]">{t('noActivityYet')}</div>
        ) : (
          activities.map((item, idx) => {
            const info = actionLabels[item.action] ?? { text: item.action, dot: 'bg-[#9CA3AF]' };
            return (
              <div
                key={idx}
                className="flex items-start gap-2 animate-slide-in"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className={`w-2 h-2 rounded-full ${info.dot} mt-1.5 shrink-0`} />
                <div>
                  <div className="text-xs text-[#374151]">{info.text}</div>
                  <div className="text-xs text-[#6B7280]">{timeAgo(item.created_at)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
