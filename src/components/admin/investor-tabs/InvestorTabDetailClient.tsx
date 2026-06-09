'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import TabMembersPanel from './TabMembersPanel';
import TabDealsPanel from './TabDealsPanel';
import type {
  AssignedDealRow,
  GroupDetail,
  MemberRow,
  PickableDeal,
  PickableInvestor,
} from './types';
import {
  deleteInvestorTab,
  updateInvestorTab,
} from '@/app/[locale]/(admin)/admin/investor-tabs/actions';

export default function InvestorTabDetailClient({
  group,
  members,
  assignedDeals,
  allInvestors,
  allDeals,
  locale,
}: {
  group: GroupDetail;
  members: MemberRow[];
  assignedDeals: AssignedDealRow[];
  allInvestors: PickableInvestor[];
  allDeals: PickableDeal[];
  locale: string;
}) {
  const t = useTranslations('admin.investorTabs');
  const router = useRouter();

  const [name, setName] = useState(group.name);
  const [isEnabled, setIsEnabled] = useState(group.is_enabled);
  const [heroNote, setHeroNote] = useState(group.hero_note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty =
    name !== group.name ||
    isEnabled !== group.is_enabled ||
    heroNote !== (group.hero_note ?? '');

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    const res = await updateInvestorTab(group.id, {
      name: name.trim(),
      isEnabled,
      heroNote: heroNote.trim() === '' ? null : heroNote.trim(),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSavedAt(Date.now());
    router.refresh();
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    const res = await deleteInvestorTab(group.id);
    if (!res.ok) {
      setDeleting(false);
      setError(res.error);
      setDeleteOpen(false);
      return;
    }
    router.push(`/${locale}/admin/investor-tabs`);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb + preview */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/admin/investor-tabs"
          locale={locale}
          className="text-[13px] text-rp-gray-500 hover:text-rp-navy w-fit"
        >
          ← {t('backToGroups')}
        </Link>
        <a
          href={`/${locale}/admin/preview/curated/${group.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-rp-gold hover:text-[#A88A3D] transition-colors"
        >
          {t('previewTab')}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>

      {/* Group settings */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-4">{t('settingsTitle')}</h2>
        <div className="flex flex-col gap-4 max-w-xl">
          <Input
            label={t('groupNameLabel')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div>
            <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">
              {t('heroNoteLabel')}
            </label>
            <textarea
              value={heroNote}
              onChange={(e) => setHeroNote(e.target.value)}
              rows={3}
              placeholder={t('heroNotePlaceholder')}
              className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold placeholder:text-rp-gray-400"
            />
            <p className="mt-1 text-[11px] text-rp-gray-400">{t('heroNoteHelp')}</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-rp-gray-300 text-rp-gold focus:ring-rp-gold"
            />
            <span className="text-[13px] font-medium text-rp-gray-700">{t('enabledLabel')}</span>
          </label>
          <p className="-mt-2 text-[11px] text-rp-gray-400">{t('enabledHelp')}</p>

          {error && <p className="text-xs text-rp-red">{error}</p>}

          <div className="flex items-center gap-3">
            <Button variant="gold" size="sm" onClick={handleSave} loading={saving} disabled={!dirty || !name.trim()}>
              {t('saveChanges')}
            </Button>
            {savedAt && !dirty && (
              <span className="text-[12px] text-rp-green">{t('saved')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Members + Deals */}
      <TabMembersPanel tabId={group.id} members={members} allInvestors={allInvestors} />
      <TabDealsPanel tabId={group.id} assignedDeals={assignedDeals} allDeals={allDeals} />

      {/* Danger zone */}
      <div className="bg-white rounded-2xl border border-rp-red/20 p-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-1">{t('deleteTitle')}</h2>
        <p className="text-[12px] text-rp-gray-500 mb-4">{t('deleteHelp')}</p>
        <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
          {t('deleteGroup')}
        </Button>
      </div>

      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title={t('deleteGroup')}>
        <p className="text-sm text-rp-gray-600 mb-6">{t('deleteConfirm', { name: group.name })}</p>
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(false)}>
            {t('cancel')}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
            {t('deleteGroup')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
