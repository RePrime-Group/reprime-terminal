'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { friendlyFetchError, readApiError } from '@/lib/utils/friendly-error';
import PhoneConfirmModal from '@/components/portal/PhoneConfirmModal';
import type { DealWithDetails } from '@/lib/types/database';

export function CommitmentCard({ deal, previewMode = false }: { deal: DealWithDetails; previewMode?: boolean }) {
  const t = useTranslations('portal.dealDetail');
  const tcom = useTranslations('common');
  const isAssigned = deal.status === 'assigned';
  const [showWire, setShowWire] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [commitType, setCommitType] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [totalCommitments, setTotalCommitments] = useState(0);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [existingPhone, setExistingPhone] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/deals/${deal.id}/commit`)
      .then((r) => r.json())
      .then((data) => {
        if (data.commitment) {
          setCommitted(true);
          setCommitType(data.commitment.type);
        }
      })
      .catch(() => {});

    fetch('/api/user/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data?.profile?.phone) setExistingPhone(data.profile.phone as string);
      })
      .catch(() => {});

    const supabase = createClient();
    supabase
      .from('terminal_deal_commitments')
      .select('*', { count: 'exact', head: true })
      .eq('deal_id', deal.id)
      .in('status', ['pending', 'wire_sent', 'confirmed'])
      .then(({ count }) => setTotalCommitments(count ?? 0));
  }, [deal.id]);

  const handleCommit = async (type: 'primary' | 'backup', phone?: string) => {
    if (previewMode) return false;
    setCommitting(true);
    setPhoneError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...(phone ? { phone } : {}) }),
      });
      if (res.ok) {
        if (phone) setExistingPhone(phone);
        setCommitted(true);
        setCommitType(type);
        setTotalCommitments((p) => p + 1);
        setShowPhoneModal(false);
        setShowWire(false);
        return true;
      }
      setPhoneError(await readApiError(res, 'We couldn’t save your commitment. Please try again, or contact RePrime if this keeps happening.'));
      return false;
    } catch (err) {
      console.error('commit failed:', err);
      setPhoneError(friendlyFetchError(err, 'We couldn’t save your commitment. Please try again.'));
      return false;
    } finally {
      setCommitting(false);
    }
  };

  const handleWithdraw = async (phone: string) => {
    if (previewMode) return;
    setWithdrawing(true);
    setPhoneError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/commit`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        setExistingPhone(phone);
        setCommitted(false);
        setCommitType(null);
        setShowWithdrawConfirm(false);
        setTotalCommitments((p) => Math.max(0, p - 1));
        return;
      }
      setPhoneError(await readApiError(res, 'We couldn’t process the withdrawal right now. Please try again, or contact RePrime if this keeps happening.'));
    } catch (err) {
      console.error('withdraw failed:', err);
      setPhoneError(friendlyFetchError(err, 'We couldn’t process the withdrawal right now. Please try again.'));
    } finally {
      setWithdrawing(false);
    }
  };

  if (isAssigned && !committed) {
    return (
      <div className="mb-6 space-y-4">
        <div className="relative overflow-hidden rounded-xl bg-[#FDF8ED] border border-[#BC9C45]/30 rp-card-shadow">
          <div className="px-5 py-6 md:px-8 md:py-8 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-start md:items-center gap-4 md:gap-5 min-w-0">
              <div className="w-11 h-11 md:w-14 md:h-14 rounded-full bg-[#BC9C45]/15 border-2 border-[#BC9C45] flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="md:w-6 md:h-6">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-[#BC9C45] uppercase tracking-[2px] mb-1">
                  {t('dealAssignedEyebrow')}
                </div>
                <h3 className="text-[18px] md:text-[22px] font-semibold text-[#0E3470] font-[family-name:var(--font-playfair)] leading-tight">
                  {t('dealAssigned')}
                </h3>
                <p className="text-[13px] text-[#6B7280] mt-1">
                  {t('dealAssignedDesc')}
                </p>
              </div>
            </div>
          </div>
          <div className="h-[2px] bg-gradient-to-r from-transparent via-[#BC9C45]/50 to-transparent" />
        </div>

        <div className="bg-white rounded-xl p-5 md:p-6 border border-[#EEF0F4] rp-card-shadow">
          <div className="p-4 bg-[#F7F8FA] rounded-xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <div className="text-[12px] font-semibold text-[#0E3470]">{t('backupPositionAvailable')}</div>
              <div className="text-[11px] text-[#6B7280] mt-1">
                {t('backupDescription')}
              </div>
            </div>
            <button
              onClick={() => handleCommit('backup')}
              disabled={committing || previewMode}
              title={previewMode ? 'Preview mode — read-only' : undefined}
              className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-lg border border-[#EEF0F4] bg-white text-[#0E3470] text-[11px] font-semibold hover:border-[#BC9C45] transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {committing ? t('processing') : t('registerAsBackup')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (committed) {
    return (
      <div className="mb-6">
        <div className="relative overflow-hidden rounded-xl bg-white border border-[#EEF0F4] rp-card-shadow">
          <div className="px-5 py-6 md:px-8 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start md:items-center gap-4 md:gap-5 min-w-0">
              <div className="w-11 h-11 md:w-14 md:h-14 rounded-full bg-[#ECFDF5] border-2 border-[#0B8A4D] flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B8A4D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="md:w-6 md:h-6">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-[#BC9C45] uppercase tracking-[2px] mb-1">
                  {t('dealCommitted')}
                </div>
                <h3 className="text-[18px] md:text-[22px] font-semibold text-[#0E3470] font-[family-name:var(--font-playfair)] leading-tight">
                  {commitType === 'backup' ? t('backupPositionRegistered') : t('youAreCommitted')}
                </h3>
                <p className="text-[13px] text-[#6B7280] mt-1">
                  {t('contactWithin24')}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
              {totalCommitments > 1 && (
                <div className="text-left md:text-right">
                  <div className="text-[28px] font-bold text-[#BC9C45] leading-none">{totalCommitments}</div>
                  <div className="text-[10px] text-[#9CA3AF] uppercase tracking-[1.5px] mt-1">{t('groupsCommitted')}</div>
                </div>
              )}
              <button
                onClick={() => {
                  setPhoneError(null);
                  setShowWithdrawConfirm(true);
                }}
                disabled={previewMode}
                title={previewMode ? 'Preview mode — read-only' : undefined}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FCA5A5] text-[#DC2626] text-[11px] font-semibold hover:bg-[#FEF2F2] hover:border-[#DC2626] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9" />
                  <path d="M21 3v6h-6" />
                </svg>
                {t('withdraw')}
              </button>
            </div>
          </div>
          <div className="h-[2px] bg-gradient-to-r from-transparent via-[#BC9C45]/50 to-transparent" />
        </div>

        <PhoneConfirmModal
          open={showWithdrawConfirm}
          initialE164={existingPhone}
          submitting={withdrawing}
          error={phoneError}
          title={t('withdrawConfirmTitle')}
          description={t('withdrawConfirmDesc')}
          confirmLabel={t('confirmWithdrawal')}
          confirmingLabel={t('withdrawing')}
          confirmTone="danger"
          onCancel={() => {
            if (withdrawing) return;
            setShowWithdrawConfirm(false);
            setPhoneError(null);
          }}
          onConfirm={handleWithdraw}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-8 rp-card-shadow border border-[#EEF0F4] mb-6">
      {totalCommitments > 0 && (
        <div className="mb-5 p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex items-center gap-3">
          <div className="text-[20px]">🔥</div>
          <div>
            <span className="text-[13px] font-bold text-[#DC2626]">
              {t('groupsAlreadyCommitted', { count: totalCommitments })}
            </span>
            <p className="text-[11px] text-[#DC2626]/60 mt-0.5">{t('positionsLimited')}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 md:gap-0 mb-5">
        <div>
          <h3 className="font-[family-name:var(--font-playfair)] text-[22px] font-semibold text-[#0E3470]">
            {t('commitToThisDeal')}
          </h3>
          <p className="text-[13px] text-[#6B7280] mt-2">
            {deal.deposit_amount && <>{t('deposit')} {deal.deposit_amount}</>}
            {deal.deposit_amount && <> · Held by: Bruce J. Smoler, Esq., Escrow Attorney</>}
            {!deal.deposit_amount && t('contactToDiscuss')}
          </p>
        </div>
        <button
          onClick={() => setShowWire(true)}
          disabled={committing || previewMode}
          title={previewMode ? 'Preview mode — read-only' : undefined}
          className="w-full md:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] text-[15px] font-bold shadow-[0_6px_24px_rgba(188,156,69,0.3)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('lockThisDeal')}
        </button>
      </div>

      {showWire && (
        <div className="p-6 bg-[#FDF8ED] rounded-xl border border-[#ECD9A0]/30 animate-slide-down mb-5">
          <div className="text-[14px] font-semibold text-[#0E3470] mb-3">
            {t('wire', { amount: deal.deposit_amount || 'deposit' })}
          </div>
          <div className="bg-white rounded-lg p-4 text-[13px] text-[#4B5563] leading-[1.7] border border-[#EEF0F4]">
            Wire funds to the designated escrow trust account held by Bruce J. Smoler, Esq. at Smoler & Associates, P.A. — J.P. Morgan Chase Florida IOTA Trust Account
            <br />
            Acct No.: 991521071
            <br />
            ABA No.: 267084131
            <br />
            Wire deadline: 72 hours from confirmation.
            <br />
            Full wiring instructions will be delivered upon confirmation.
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                setPhoneError(null);
                setShowPhoneModal(true);
              }}
              disabled={committing || previewMode}
              title={previewMode ? 'Preview mode — read-only' : undefined}
              className="flex-1 py-3.5 rounded-xl bg-[#BC9C45] hover:bg-[#A88A3D] text-[#0E3470] text-[13px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {committing ? t('processing') : t('confirmSendWire')}
            </button>
            <button
              onClick={() => setShowWire(false)}
              className="px-6 py-3.5 rounded-xl border border-[#EEF0F4] text-[#6B7280] text-[12px] font-medium hover:bg-[#F7F8FA] transition-colors"
            >
              {tcom('cancel')}
            </button>
          </div>
        </div>
      )}

      <PhoneConfirmModal
        open={showPhoneModal}
        initialE164={existingPhone}
        submitting={committing}
        error={phoneError}
        onCancel={() => {
          if (committing) return;
          setShowPhoneModal(false);
          setPhoneError(null);
        }}
        onConfirm={(e164) => handleCommit('primary', e164)}
      />

      <div className="p-4 bg-[#F7F8FA] rounded-xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <div className="text-[12px] font-semibold text-[#0E3470]">{t('backupPositionAvailable')}</div>
          <div className="text-[11px] text-[#6B7280] mt-1">
            {t('backupDescription')}
          </div>
        </div>
        <button
          onClick={() => handleCommit('backup')}
          disabled={committing || previewMode}
          title={previewMode ? 'Preview mode — read-only' : undefined}
          className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-lg border border-[#EEF0F4] bg-white text-[#0E3470] text-[11px] font-semibold hover:border-[#BC9C45] transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('registerAsBackup')}
        </button>
      </div>
    </div>
  );
}
