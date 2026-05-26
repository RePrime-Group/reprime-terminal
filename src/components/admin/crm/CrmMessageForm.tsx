'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CrmAttachment, CrmMessageType, CrmMessageDirection } from '@/lib/types/database';
import { addMessage } from '@/app/[locale]/(admin)/admin/crm/actions';
import { MESSAGE_TYPES, DIRECTIONS, TEAM_MEMBERS } from './CrmConstants';
import { uploadCrmFile, removeCrmFile } from './uploadCrmFile';

const inputCls =
  'w-full px-3 py-2 border border-rp-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold outline-none';
const labelCls = 'block text-[11px] font-semibold text-rp-gray-500 uppercase tracking-wider mb-1';

export default function CrmMessageForm({
  investorId,
  onSaved,
  onCancel,
}: {
  investorId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('admin.crm');

  const [type, setType] = useState<CrmMessageType>('note');
  const [direction, setDirection] = useState<CrmMessageDirection>('outbound');
  const [postedBy, setPostedBy] = useState<string>(TEAM_MEMBERS[0]);
  const [dealReference, setDealReference] = useState('');
  const [body, setBody] = useState('');
  const [amountDiscussed, setAmountDiscussed] = useState('');
  const [commitmentAmount, setCommitmentAmount] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpAssignedTo, setFollowUpAssignedTo] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // Upload attachments first; keep paths so we can roll back on failure.
    const uploaded: (CrmAttachment & { path: string })[] = [];
    try {
      for (const f of files) {
        const res = await uploadCrmFile('terminal-investor-files', investorId, f);
        if (res.error || !res.data) {
          setError(t('uploadFailed'));
          setSaving(false);
          return;
        }
        uploaded.push(res.data);
      }

      const result = await addMessage({
        investor_id: investorId,
        type,
        direction,
        posted_by: postedBy,
        deal_reference: dealReference.trim() || null,
        body: body.trim() || null,
        amount_discussed: amountDiscussed ? Number(amountDiscussed) : null,
        commitment_amount: commitmentAmount ? Number(commitmentAmount) : null,
        attachments: uploaded.map(({ name, url, size, type: ft }) => ({ name, url, size, type: ft })),
        follow_up_date: followUpDate || null,
        follow_up_assigned_to: followUpAssignedTo || null,
      });

      if (!result.ok) {
        // Roll back uploaded objects so we don't leak orphans.
        await Promise.all(uploaded.map((u) => removeCrmFile('terminal-investor-files', u.path)));
        setError(result.error || t('saveFailed'));
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      await Promise.all(uploaded.map((u) => removeCrmFile('terminal-investor-files', u.path)));
      setError(t('saveFailed'));
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-4 flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>{t('mfType')}</label>
          <select value={type} onChange={(e) => setType(e.target.value as CrmMessageType)} className={inputCls}>
            {MESSAGE_TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.icon} {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('mfDirection')}</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as CrmMessageDirection)}
            className={inputCls}
          >
            {DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('mfPostedBy')}</label>
          <select value={postedBy} onChange={(e) => setPostedBy(e.target.value)} className={inputCls}>
            {TEAM_MEMBERS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>{t('mfDealReference')}</label>
        <input
          type="text"
          value={dealReference}
          onChange={(e) => setDealReference(e.target.value)}
          placeholder={t('mfDealReferencePlaceholder')}
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>{t('mfMessage')}</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder={t('mfMessagePlaceholder')}
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t('amountDiscussed')} ($)</label>
          <input
            type="number"
            value={amountDiscussed}
            onChange={(e) => setAmountDiscussed(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t('commitmentAmount')} ($)</label>
          <input
            type="number"
            value={commitmentAmount}
            onChange={(e) => setCommitmentAmount(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t('mfFollowUpDate')}</label>
          <input
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t('mfFollowUpAssignedTo')}</label>
          <select
            value={followUpAssignedTo}
            onChange={(e) => setFollowUpAssignedTo(e.target.value)}
            className={inputCls}
          >
            <option value="">{t('mfNone')}</option>
            {TEAM_MEMBERS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>{t('mfAttachment')}</label>
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="text-sm text-rp-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-rp-gray-100 file:text-rp-navy file:text-sm file:font-medium hover:file:bg-rp-gray-200"
        />
        {files.length > 0 && (
          <p className="text-[11px] text-rp-gray-500 mt-1">{files.map((f) => f.name).join(', ')}</p>
        )}
      </div>

      {error && <p className="text-sm text-rp-red">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-lg border border-rp-gray-200 text-sm font-medium text-rp-gray-600 hover:bg-rp-gray-100"
        >
          {t('mfCancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
        >
          {saving ? t('mfSaving') : t('mfSave')}
        </button>
      </div>
    </div>
  );
}
