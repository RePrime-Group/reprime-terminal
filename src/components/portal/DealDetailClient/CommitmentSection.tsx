'use client';

import { type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import type { DealWithDetails } from '@/lib/types/database';
import { CountdownRing } from './CountdownRing';
import { CommitmentCard } from './CommitmentCard';
import type { TabKey } from './types';

interface Props {
  deal: DealWithDetails;
  previewMode?: boolean;
  contactName: string;
  contactTitle: string;
  locale: string;
  setActiveTab: (k: TabKey) => void;
  tabBarRef: RefObject<HTMLDivElement | null>;
}

export function CommitmentSection({ deal, previewMode, contactName, contactTitle, locale, setActiveTab, tabBarRef }: Props) {
  const t = useTranslations('portal.dealDetail');
  return (
    <div className="px-4 md:px-8 mt-2 pb-4">
      <div className="rp-gold-line mb-10" />

      <div className="bg-white rounded-xl p-8 rp-card-shadow border border-[#EEF0F4] mb-6">
        <div className="text-[11px] font-semibold text-[#0E3470] uppercase tracking-[2px] mb-7">{t('dealTimeline')}</div>
        <div className="flex justify-around items-center">
          <CountdownRing label={t('dueDiligence')} targetDate={deal.dd_deadline} accentColor="#0E3470" />
          <CountdownRing label={t('closing')} targetDate={deal.close_deadline} accentColor="#BC9C45" />
          {deal.extension_deadline && (
            <CountdownRing label={t('extension')} targetDate={deal.extension_deadline} accentColor="#6B7280" />
          )}
        </div>
        {deal.timeline_note && (
          <div className="mt-6 px-4 py-3 bg-[#FDF8ED] border-l-[3px] border-[#BC9C45] rounded-md text-[13px] text-[#6B7280] leading-[1.6]">
            <span className="font-bold text-[#BC9C45] mr-2 tracking-[1px]">
              ℹ {t('timelineNoteLabel')}
            </span>
            {deal.timeline_note}
          </div>
        )}
      </div>

      <CommitmentCard deal={deal} previewMode={previewMode} />

      <div className="bg-white rounded-xl p-8 rp-card-shadow border border-[#EEF0F4] mb-6">
        <h3 className="font-[family-name:var(--font-playfair)] text-[20px] font-semibold text-[#0E3470] mb-5">
          {t('howWeSourceDeals')}
        </h3>
        <div className="text-[14px] text-[#4B5563] leading-[1.9] space-y-4">
          <p>{t('howWeSourceP1')}</p>
          <p>{t('howWeSourceP2')}</p>
          <p>{t('howWeSourceP3')}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 md:p-7 border border-[#EEF0F4] rp-card-shadow flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-[14px] font-medium text-[#0E3470]">{t('questionsBeforeCommitting')}</div>
          <div className="text-[11px] text-[#9CA3AF] mt-1">
            {contactName || t('reprimeTeam')}{contactTitle ? ` · ${contactTitle}` : ''}
          </div>
        </div>
        <div className="flex gap-3">
          <a
            href={`https://wa.me/19177030365?text=Hi, I'm interested in ${deal.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg bg-[#25D366] text-white text-[12px] font-semibold transition-opacity hover:opacity-90"
          >
            💬 {t('whatsApp')}
          </a>
          <button
            onClick={() => {
              setActiveTab('schedule');
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  const el = tabBarRef.current;
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    const offset = window.scrollY + rect.top - 80;
                    window.scrollTo({ top: offset, behavior: 'smooth' });
                  }
                });
              });
            }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg border border-[#EEF0F4] text-[#6B7280] text-[12px] font-medium hover:border-[#BC9C45] hover:text-[#0E3470] transition-colors"
          >
            📅 {t('scheduleACall')}
          </button>
        </div>
      </div>
    </div>
  );
}
