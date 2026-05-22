'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CrmAttachment, TerminalCrmMessage } from '@/lib/types/database';
import { formatPrice } from '@/lib/utils/format';
import { MESSAGE_TYPE_MAP, DIRECTION_MAP } from './CrmConstants';
import { togglePin, markFollowUpComplete } from '@/app/[locale]/(admin)/admin/crm/actions';
import { openCrmFile } from './uploadCrmFile';

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(value: string): string {
  // follow_up_date is a DATE (no time) — avoid TZ shifting by parsing parts.
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentIcon(type: string | null): string {
  if (!type) return '📎';
  if (type.startsWith('video/')) return '🎥';
  if (type.startsWith('image/')) return '🖼';
  return '📎';
}

export default function CrmTimelineEntry({
  message,
  onChanged,
}: {
  message: TerminalCrmMessage;
  onChanged: () => void;
}) {
  const t = useTranslations('admin.crm');
  const [busy, setBusy] = useState(false);

  const typeOpt = MESSAGE_TYPE_MAP[message.type];
  const dirOpt = message.direction ? DIRECTION_MAP[message.direction] : null;
  const hasFollowUp = !!message.follow_up_date && !message.follow_up_completed;

  const handlePin = async () => {
    setBusy(true);
    await togglePin(message.id, message.investor_id, !message.is_pinned);
    onChanged();
    setBusy(false);
  };

  const handleComplete = async () => {
    setBusy(true);
    await markFollowUpComplete(message.id, message.investor_id);
    onChanged();
    setBusy(false);
  };

  const handleOpen = (att: CrmAttachment) => {
    void openCrmFile(att);
  };

  return (
    <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-4 flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="font-semibold text-rp-navy">
            {typeOpt?.icon} {typeOpt?.label ?? message.type}
          </span>
          {dirOpt && (
            <span className={`text-xs font-medium ${dirOpt.className}`}>
              {dirOpt.indicator} {dirOpt.label}
            </span>
          )}
          {message.deal_reference && (
            <span className="px-2 py-0.5 rounded-md bg-rp-gold-bg text-rp-gold text-[11px] font-medium">
              🏢 {message.deal_reference}
            </span>
          )}
        </div>
        <button
          onClick={handlePin}
          disabled={busy}
          title={message.is_pinned ? t('unpin') : t('pin')}
          className={`text-sm flex-shrink-0 ${message.is_pinned ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}
        >
          📌
        </button>
      </div>

      {/* Body */}
      {message.body && (
        <p className="text-sm text-rp-gray-700 whitespace-pre-wrap leading-relaxed">{message.body}</p>
      )}

      {/* Financial context */}
      {(message.amount_discussed || message.commitment_amount) && (
        <div className="flex flex-wrap gap-2">
          {message.amount_discussed && (
            <span className="px-2.5 py-1 rounded-lg bg-rp-gray-100 text-rp-gray-700 text-xs font-medium tabular-nums">
              {t('amountDiscussed')}: {formatPrice(message.amount_discussed)}
            </span>
          )}
          {message.commitment_amount && (
            <span className="px-2.5 py-1 rounded-lg bg-rp-green-light text-rp-green text-xs font-semibold tabular-nums">
              ✅ {t('commitmentAmount')}: {formatPrice(message.commitment_amount)}
            </span>
          )}
        </div>
      )}

      {/* Attachments */}
      {message.attachments?.length > 0 && (
        <div className="flex flex-col gap-1">
          {message.attachments.map((att, idx) => (
            <button
              key={`${att.url}-${idx}`}
              onClick={() => handleOpen(att)}
              className="flex items-center gap-2 text-left text-sm text-rp-navy hover:text-rp-gold transition-colors"
            >
              <span>{attachmentIcon(att.type)}</span>
              <span className="truncate">{att.name}</span>
              {att.size != null && <span className="text-[11px] text-rp-gray-400">{fileSize(att.size)}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Follow-up banner */}
      {hasFollowUp && message.follow_up_date && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-rp-amber-light border border-rp-amber/20">
          <span className="text-xs text-rp-amber font-medium">
            🔔 {t('followUpDue')} {formatDate(message.follow_up_date)}
            {message.follow_up_assigned_to ? ` · ${t('assignedTo')} ${message.follow_up_assigned_to}` : ''}
          </span>
          <button
            onClick={handleComplete}
            disabled={busy}
            className="text-xs font-semibold text-rp-green hover:underline flex-shrink-0"
          >
            {t('markComplete')}
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 text-[11px] text-rp-gray-400 pt-1">
        <span>{message.posted_by}</span>
        <span>·</span>
        <span>{formatTimestamp(message.created_at)}</span>
      </div>
    </div>
  );
}
