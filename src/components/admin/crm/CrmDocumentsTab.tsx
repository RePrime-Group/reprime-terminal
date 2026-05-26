'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { CrmDocument } from '@/lib/types/database';
import { uploadDocumentMetadata } from '@/app/[locale]/(admin)/admin/crm/actions';
import { uploadCrmFile, removeCrmFile, openCrmFile } from './uploadCrmFile';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CrmDocumentsTab({
  investorId,
  documents,
}: {
  investorId: string;
  documents: CrmDocument[];
}) {
  const t = useTranslations('admin.crm');
  const router = useRouter();

  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);

    const res = await uploadCrmFile('terminal-investor-files', `${investorId}/documents`, file);
    if (res.error || !res.data) {
      setError(t('uploadFailed'));
      setBusy(false);
      return;
    }

    const doc: CrmDocument = {
      name: name.trim() || res.data.name,
      url: res.data.url,
      size: res.data.size,
      type: res.data.type,
      uploaded_at: new Date().toISOString(),
    };

    const result = await uploadDocumentMetadata(investorId, doc);
    if (!result.ok) {
      await removeCrmFile('terminal-investor-files', res.data.path);
      setError(result.error || t('saveFailed'));
      setBusy(false);
      return;
    }

    setName('');
    setFile(null);
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Upload row */}
      <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="block text-[11px] font-semibold text-rp-gray-500 uppercase tracking-wider mb-1">
            {t('documentName')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-rp-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold outline-none"
          />
        </div>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-rp-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-rp-gray-100 file:text-rp-navy file:text-sm file:font-medium hover:file:bg-rp-gray-200"
        />
        <button
          onClick={handleUpload}
          disabled={!file || busy}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex-shrink-0"
        >
          {busy ? t('uploading') : `+ ${t('uploadDocument')}`}
        </button>
      </div>

      {error && <p className="text-sm text-rp-red">{error}</p>}

      {/* List */}
      {documents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-rp-gray-200">
          <p className="text-sm text-rp-gray-500">{t('noDocuments')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow divide-y divide-rp-gray-200">
          {documents.map((doc, idx) => (
            <div key={`${doc.url}-${idx}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span>📄</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-rp-navy truncate">{doc.name}</p>
                  {doc.uploaded_at && (
                    <p className="text-[11px] text-rp-gray-400">
                      {t('uploadedOn')} {formatDate(doc.uploaded_at)}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => void openCrmFile(doc)}
                className="text-xs font-semibold text-rp-navy hover:text-rp-gold flex-shrink-0"
              >
                {t('view')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
