'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  previewBulkInvestors,
  commitBulkInvestors,
  sendCriteriaFormBulk,
  type BulkPreviewResult,
  type BulkCommitResult,
  type ConflictAction,
} from '@/app/[locale]/(admin)/admin/crm/actions';
import { buildTemplateXlsxBase64 } from '@/lib/crm/parseInvestorsXlsx';

type Phase = 'input' | 'preview' | 'committed' | 'sent';

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default function CrmImportClient({ locale }: { locale: string }) {
  const t = useTranslations('admin.crm');
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [xlsxB64, setXlsxB64] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('input');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<BulkPreviewResult | null>(null);
  const [resolutions, setResolutions] = useState<Record<number, ConflictAction>>({});
  const [commit, setCommit] = useState<Extract<BulkCommitResult, { ok: true }> | null>(null);

  const [sendTargets, setSendTargets] = useState<string[]>([]);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);

  const downloadTemplate = () => {
    const b64 = buildTemplateXlsxBase64();
    const a = document.createElement('a');
    a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${b64}`;
    a.download = 'investor-import-template.xlsx';
    a.click();
  };

  const reset = () => {
    setPhase('input');
    setPreview(null);
    setResolutions({});
    setCommit(null);
    setSendTargets([]);
    setSendResult(null);
    setError(null);
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setError(null);
    setBusy(true);
    try {
      const b64 = await fileToBase64(f);
      setXlsxB64(b64);
      const res = await previewBulkInvestors(b64);
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      // Default conflict resolution: skip every conflict.
      const initial: Record<number, ConflictAction> = {};
      for (const c of res.conflicts) initial[c.index] = 'skip';
      setResolutions(initial);
      setPreview(res);
      setPhase('preview');
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!xlsxB64) return;
    setBusy(true);
    setError(null);
    const res = await commitBulkInvestors(xlsxB64, resolutions);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCommit(res);
    // Default: send invites to every freshly-inserted row.
    setSendTargets(res.results.filter((r) => r.action === 'inserted' && r.id).map((r) => r.id!));
    setPhase('committed');
  };

  const handleSend = async () => {
    setBusy(true);
    setError(null);
    const res = await sendCriteriaFormBulk(sendTargets);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSendResult({ sent: res.result.sent.length, failed: res.result.failed.length });
    setPhase('sent');
    router.refresh();
  };

  const conflictRowsByIndex = useMemo(() => {
    const m = new Map<number, true>();
    for (const c of preview?.conflicts ?? []) m.set(c.index, true);
    return m;
  }, [preview]);

  return (
    <div className="max-w-5xl flex flex-col gap-5">
      <div>
        <Link
          href={`/${locale}/admin/crm`}
          className="inline-flex items-center gap-1.5 text-sm text-rp-gray-500 hover:text-rp-navy mb-2"
        >
          ← {t('backToList')}
        </Link>
        <h1 className="text-2xl font-bold text-rp-navy">{t('importTitle')}</h1>
        <p className="text-sm text-rp-gray-500 mt-1">{t('importSubtitle')}</p>
      </div>

      {phase === 'input' && (
        <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                if (fileRef.current) fileRef.current.value = '';
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {busy ? t('parsing') : t('chooseXlsx')}
            </button>
            <button
              onClick={downloadTemplate}
              className="text-sm text-rp-navy hover:text-rp-gold font-medium"
            >
              ↓ {t('downloadTemplate')}
            </button>
            {file && <span className="text-sm text-rp-gray-600">{file.name}</span>}
          </div>
          <p className="text-xs text-rp-gray-500">
            {t('importColumns')}
          </p>
          {error && <p className="text-sm text-rp-red">{error}</p>}
        </div>
      )}

      {phase === 'preview' && preview && (
        <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-rp-navy">
              {t('previewHeader', {
                valid: preview.valid.length,
                conflicts: preview.conflicts.length,
                invalid: preview.errors.length,
                total: preview.total,
              })}
            </h2>
            <button onClick={reset} className="text-sm text-rp-gray-500 hover:text-rp-navy">
              ← {t('chooseAnotherFile')}
            </button>
          </div>

          {preview.errors.length > 0 && (
            <div className="rounded-lg border border-rp-red/30 bg-rp-red/5 p-4">
              <p className="text-sm font-semibold text-rp-red mb-2">
                {preview.errors.length} {t('rowsSkipped')}
              </p>
              <ul className="space-y-1.5">
                {preview.errors.map((e) => (
                  <li key={e.index} className="text-xs text-rp-gray-700">
                    <span className="font-semibold">{t('row')} {e.index + 1}:</span> {e.messages.join('; ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.valid.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-rp-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-rp-gray-100 text-left text-[9px] font-semibold uppercase tracking-[1.5px] text-rp-gray-400">
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">{t('th_name')}</th>
                    <th className="px-3 py-2.5">{t('th_email')}</th>
                    <th className="px-3 py-2.5">{t('th_company')}</th>
                    <th className="px-3 py-2.5">{t('th_phone')}</th>
                    <th className="px-3 py-2.5">{t('th_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rp-gray-200">
                  {preview.valid.map((r) => {
                    const isConflict = conflictRowsByIndex.has(r.index);
                    const conflict = preview.conflicts.find((c) => c.index === r.index);
                    return (
                      <tr key={r.index}>
                        <td className="px-3 py-2.5 text-rp-gray-400">{r.index + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-rp-navy">
                          {r.first_name} {r.last_name}
                        </td>
                        <td className="px-3 py-2.5 text-rp-gray-700">{r.email}</td>
                        <td className="px-3 py-2.5 text-rp-gray-600">{r.company_name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-rp-gray-600">{r.phone ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          {isConflict ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-rp-amber-light text-rp-amber text-[10px] font-semibold">
                                {t('conflictExisting')}
                              </span>
                              <select
                                value={resolutions[r.index] ?? 'skip'}
                                onChange={(e) =>
                                  setResolutions((p) => ({ ...p, [r.index]: e.target.value as ConflictAction }))
                                }
                                className="text-xs border border-rp-gray-300 rounded px-1.5 py-0.5"
                              >
                                <option value="skip">{t('actionSkip')}</option>
                                <option value="update">{t('actionUpdate')}</option>
                              </select>
                              {conflict && (
                                <span className="text-[10px] text-rp-gray-400">→ {conflict.existingName}</span>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rp-green-light text-rp-green text-[10px] font-semibold">
                              {t('willInsert')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {error && <p className="text-sm text-rp-red">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              onClick={reset}
              disabled={busy}
              className="px-4 py-2 rounded-lg border border-rp-gray-200 text-sm font-medium text-rp-gray-600 hover:bg-rp-gray-100"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleCommit}
              disabled={busy || preview.valid.length === 0}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {busy ? t('importing') : t('importInvestors')}
            </button>
          </div>
        </div>
      )}

      {phase === 'committed' && commit && (
        <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-rp-navy">{t('importComplete')}</h2>
            <p className="text-sm text-rp-gray-500 mt-1">
              {t('importStats', {
                created: commit.created,
                updated: commit.updated,
                skipped: commit.skipped,
                failed: commit.failed,
              })}
            </p>
          </div>

          {sendTargets.length > 0 ? (
            <div className="bg-rp-gold-bg/30 border border-rp-gold/20 rounded-lg p-4 flex flex-col gap-3">
              <p className="text-sm text-rp-navy font-medium">
                {t('readyToSend', { count: sendTargets.length })}
              </p>
              <p className="text-xs text-rp-gray-600">{t('sendHelper')}</p>
              {error && <p className="text-sm text-rp-red">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => router.push(`/${locale}/admin/crm`)}
                  className="px-4 py-2 rounded-lg border border-rp-gray-200 text-sm font-medium text-rp-gray-600 hover:bg-rp-gray-100"
                >
                  {t('skipSend')}
                </button>
                <button
                  onClick={handleSend}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? t('sending') : t('sendBulkCount', { count: sendTargets.length })}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={() => router.push(`/${locale}/admin/crm`)}
                className="px-4 py-2 rounded-lg bg-rp-navy text-white text-sm font-semibold hover:bg-rp-navy/90"
              >
                {t('goToCrm')}
              </button>
            </div>
          )}

          {commit.failed > 0 && (
            <div className="rounded-lg border border-rp-red/30 bg-rp-red/5 p-3">
              <p className="text-xs font-semibold text-rp-red mb-1">{t('importFailedRows')}</p>
              <ul className="space-y-0.5">
                {commit.results.filter((r) => !r.ok).map((r) => (
                  <li key={r.index} className="text-[11px] text-rp-gray-700">
                    {r.email}: {r.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {phase === 'sent' && sendResult && (
        <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-6 flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-rp-navy">{t('sendComplete')}</h2>
          <p className="text-sm text-rp-gray-600">
            {t('sendResultStats', { sent: sendResult.sent, failed: sendResult.failed })}
          </p>
          <div className="flex justify-end">
            <button
              onClick={() => router.push(`/${locale}/admin/crm`)}
              className="px-4 py-2 rounded-lg bg-rp-navy text-white text-sm font-semibold hover:bg-rp-navy/90"
            >
              {t('goToCrm')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
