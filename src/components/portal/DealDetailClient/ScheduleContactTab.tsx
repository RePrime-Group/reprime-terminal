'use client';

import { useTranslations } from 'next-intl';
import type { DealWithDetails, TerminalAvailabilitySlot } from '@/lib/types/database';
import { MeetingScheduler } from './MeetingScheduler';

interface Props {
  deal: DealWithDetails;
  locale: string;
  lazyContact: { name: string; title: string; email: string } | null;
  lazySlots: TerminalAvailabilitySlot[] | null;
  lazyBookedTimes: string[] | null;
  availabilitySlots: TerminalAvailabilitySlot[];
  bookedTimes: string[];
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  scheduleLoading: boolean;
  previewMode?: boolean;
  handleMeetingRequested: () => void;
}

export function ScheduleContactTab({
  deal,
  locale,
  lazyContact,
  lazySlots,
  lazyBookedTimes,
  availabilitySlots,
  bookedTimes,
  contactName,
  contactTitle,
  contactEmail,
  scheduleLoading,
  previewMode,
  handleMeetingRequested,
}: Props) {
  const t = useTranslations('portal.dealDetail');

  if (scheduleLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#BC9C45] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const displayName = lazyContact?.name || contactName;
  const displayTitle = lazyContact?.title || contactTitle;
  const displayEmail = lazyContact?.email || contactEmail;

  return (
    <div className="mt-6 md:mt-8 px-4 md:px-8 pb-8 md:pb-10 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
        <h3 className="text-sm font-semibold text-[#0E3470] mb-4">
          {t('scheduleMeeting')}
        </h3>
        <MeetingScheduler
          dealId={deal.id}
          slots={lazySlots ?? availabilitySlots}
          bookedTimes={lazyBookedTimes ?? bookedTimes}
          onMeetingRequested={handleMeetingRequested}
          previewMode={previewMode}
        />
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0E3470] to-[#1D5FB8] flex items-center justify-center shrink-0 shadow-lg">
              <span className="text-white font-bold text-lg">
                {displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'RP'}
              </span>
            </div>
            <div>
              <div className="font-semibold text-[#0E3470]">
                {displayName || t('reprimeTeam')}
              </div>
              <div className="text-xs text-[#9CA3AF]">
                {displayTitle || t('investmentAdvisor')}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <a
              href={`mailto:${displayEmail}?subject=${encodeURIComponent(`RE: ${deal.name}`)}`}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#BC9C45] hover:bg-[#A88A3D] text-white font-semibold text-sm rounded-xl transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              {t('emailAboutDeal', { name: displayName?.split(' ')[0] || 'Shirel' })}
            </a>
            <a
              href={`mailto:${displayEmail}?subject=${encodeURIComponent(`Callback Request: ${deal.name}`)}`}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0E3470] hover:bg-[#0E3470]/90 text-white font-semibold text-sm rounded-xl transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
              </svg>
              {t('requestACallBack')}
            </a>
          </div>
        </div>

        <div className="bg-[#FDF8ED] border border-[#BC9C45]/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#0B8A4D] live-dot" />
            <span className="text-sm font-semibold text-[#0E3470]">{t('availableViaEmail')}</span>
          </div>
          <p className="text-xs text-[#6B7280]">
            {t('typicalResponseTime')}
          </p>
        </div>

        <a
          href={`/${locale}/portal/settings`}
          className="block bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow hover:border-[#BC9C45] transition-colors group"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="data-label mb-1">{t('notificationPreferences')}</div>
              <div className="text-[12px] text-[#6B7280]">{t('manageInSettings')}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#9CA3AF] group-hover:text-[#BC9C45] transition-colors">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </a>

        <div className="bg-[#0E3470]/[0.04] border border-[#0E3470]/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0E3470" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span className="text-sm font-semibold text-[#0E3470]">
              {t('confidential')}
            </span>
          </div>
          <p className="text-xs text-[#6B7280]">
            {t('confidentialAccess')}
          </p>
        </div>
      </div>
    </div>
  );
}
