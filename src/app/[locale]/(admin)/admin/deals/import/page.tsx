'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import {
  previewBulkDeals,
  commitBulkDeals,
  type ImportPreviewRow,
  type CommitRowResult,
} from '../actions';
import type { RowError } from '@/lib/deals/importSchema';
import {
  DEAL_IMPORT_EXAMPLES,
  DEAL_IMPORT_TEMPLATE,
} from '@/lib/deals/importExamples';

type Phase = 'input' | 'preview' | 'done';

export default function ImportDealsPage() {
  const { locale } = useParams<{ locale: string }>();
  const fileRef = useRef<HTMLInputElement>(null);

  const [jsonText, setJsonText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('input');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [valid, setValid] = useState<ImportPreviewRow[]>([]);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<CommitRowResult[]>([]);

  const templateText = useMemo(
    () => JSON.stringify(DEAL_IMPORT_TEMPLATE, null, 2),
    []
  );

  function reset() {
    setPhase('input');
    setValid([]);
    setRowErrors([]);
    setResults([]);
    setTotal(0);
    setError(null);
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    const text = await file.text();
    setJsonText(text);
    reset();
  }

  function downloadTemplate() {
    const blob = new Blob([templateText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deal-import-template.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePreview() {
    if (!jsonText.trim()) {
      setError('Paste JSON or choose a file first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await previewBulkDeals(jsonText);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setValid(res.valid);
      setRowErrors(res.errors);
      setTotal(res.total);
      setPhase('preview');
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    setBusy(true);
    setError(null);
    try {
      const res = await commitBulkDeals(jsonText);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResults(res.results);
      setPhase('done');
    } finally {
      setBusy(false);
    }
  }

  const createdCount = results.filter((r) => r.ok).length;
  const failedCount = results.length - createdCount;

  return (
    <div className="max-w-5xl font-[family-name:var(--font-poppins)]">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/${locale}/admin/deals`}
          className="inline-flex items-center gap-1.5 text-sm text-rp-gray-500 hover:text-rp-navy transition-colors mb-3"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Deals
        </Link>
        <h1 className="text-[24px] font-bold text-rp-navy">Import Deals</h1>
        <p className="text-sm text-rp-gray-500 mt-1">
          Upload a JSON file of deals. Each deal is created as a{' '}
          <span className="font-semibold">Draft</span>. Metrics (cap rate, IRR,
          DSCR, equity, loan) are computed automatically.
        </p>
      </div>

      {phase === 'input' && (
        <>
          {/* Upload / paste */}
          <div className="bg-white rounded-2xl rp-card-shadow p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  if (fileRef.current) fileRef.current.value = '';
                }}
              />
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                Choose JSON file
              </Button>
              {fileName && (
                <span className="text-sm text-rp-gray-600">{fileName}</span>
              )}
              <button
                type="button"
                onClick={downloadTemplate}
                className="ml-auto text-sm text-rp-navy hover:text-rp-gold font-medium transition-colors"
              >
                ↓ Download template
              </button>
            </div>

            <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">
              …or paste JSON
            </label>
            <textarea
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setFileName(null);
              }}
              rows={10}
              spellCheck={false}
              placeholder='[ { "name": "1200 Market Street", "property_type": "Office", "city": "Philadelphia", "state": "PA", "purchase_price": "14200000", "noi": "1278000" } ]'
              className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-xs font-mono text-rp-gray-700 focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors"
            />

            {error && (
              <p className="mt-3 text-sm text-rp-red whitespace-pre-wrap">{error}</p>
            )}

            <div className="mt-4 flex justify-end">
              <Button onClick={handlePreview} disabled={busy}>
                {busy ? 'Validating…' : 'Validate & preview'}
              </Button>
            </div>
          </div>

          {/* Examples */}
          <ExampleSection />
        </>
      )}

      {phase === 'preview' && (
        <div className="bg-white rounded-2xl rp-card-shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-semibold text-rp-navy">
              Preview — {valid.length} valid / {rowErrors.length} invalid of {total}
            </h2>
            <button
              type="button"
              onClick={reset}
              className="text-sm text-rp-gray-500 hover:text-rp-navy transition-colors"
            >
              ← Back to edit
            </button>
          </div>

          {rowErrors.length > 0 && (
            <div className="mb-5 rounded-lg border border-rp-red/30 bg-rp-red/5 p-4">
              <p className="text-sm font-semibold text-rp-red mb-2">
                {rowErrors.length} row(s) will be skipped:
              </p>
              <ul className="space-y-1.5">
                {rowErrors.map((e) => (
                  <li key={e.index} className="text-xs text-rp-gray-700">
                    <span className="font-semibold">Row {e.index + 1}:</span>{' '}
                    {e.messages.join('; ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {valid.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-rp-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F7F8FA] text-left text-[9px] font-semibold uppercase tracking-[1.5px] text-[#9CA3AF]">
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Location</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Price</th>
                    <th className="px-3 py-2.5">Cap</th>
                    <th className="px-3 py-2.5">Portfolio</th>
                    <th className="px-3 py-2.5">Tenants</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rp-gray-200">
                  {valid.map((r) => (
                    <tr key={r.index} className="hover:bg-[#FAFBFC]">
                      <td className="px-3 py-2.5 text-rp-gray-400">{r.index + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-rp-navy">{r.name}</td>
                      <td className="px-3 py-2.5 text-rp-gray-600">{r.city}, {r.state}</td>
                      <td className="px-3 py-2.5 text-rp-gray-600">{r.property_type}</td>
                      <td className="px-3 py-2.5 text-rp-gray-700">{r.purchase_price}</td>
                      <td className="px-3 py-2.5 text-rp-gray-700">{r.cap_rate ? `${r.cap_rate}%` : '—'}</td>
                      <td className="px-3 py-2.5 text-rp-gray-600">
                        {r.is_portfolio ? `Yes (${r.address_count})` : 'No'}
                      </td>
                      <td className="px-3 py-2.5 text-rp-gray-600">{r.tenant_count || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-rp-gray-500">No valid deals to import.</p>
          )}

          {error && <p className="mt-3 text-sm text-rp-red whitespace-pre-wrap">{error}</p>}

          <div className="mt-5 flex justify-end gap-3">
            <Button variant="secondary" onClick={reset} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleCommit} disabled={busy || valid.length === 0}>
              {busy ? 'Importing…' : `Import ${valid.length} draft deal(s)`}
            </Button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="bg-white rounded-2xl rp-card-shadow p-6 mb-6">
          <h2 className="text-[18px] font-semibold text-rp-navy mb-1">
            Import complete
          </h2>
          <p className="text-sm text-rp-gray-600 mb-5">
            {createdCount} created
            {failedCount > 0 ? `, ${failedCount} failed` : ''}.
          </p>

          <div className="overflow-x-auto rounded-lg border border-rp-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F8FA] text-left text-[9px] font-semibold uppercase tracking-[1.5px] text-[#9CA3AF]">
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rp-gray-200">
                {results.map((r) => (
                  <tr key={r.index} className="hover:bg-[#FAFBFC]">
                    <td className="px-3 py-2.5 text-rp-gray-400">{r.index + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-rp-navy">
                      {r.ok && r.id ? (
                        <Link href={`/${locale}/admin/deals/${r.id}`} className="hover:text-rp-gold">
                          {r.name}
                        </Link>
                      ) : (
                        r.name
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.ok ? (
                        <span className="text-green-600 font-medium">Created</span>
                      ) : (
                        <span className="text-rp-red">{r.error ?? 'Failed'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setJsonText('');
                setFileName(null);
                reset();
              }}
            >
              Import another
            </Button>
            <Link href={`/${locale}/admin/deals`}>
              <Button>Go to deals</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ExampleSection() {
  const [openId, setOpenId] = useState<string>(DEAL_IMPORT_EXAMPLES[0].id);
  const active = DEAL_IMPORT_EXAMPLES.find((e) => e.id === openId) ?? DEAL_IMPORT_EXAMPLES[0];
  const activeText = useMemo(() => JSON.stringify(active.deal, null, 2), [active]);

  return (
    <div className="bg-white rounded-2xl rp-card-shadow p-6">
      <h2 className="text-[18px] font-semibold text-rp-navy mb-1">Expected JSON</h2>
      <p className="text-sm text-rp-gray-500 mb-4">
        The file is an array of deal objects (or{' '}
        <span className="font-mono text-xs">{'{ "deals": [ … ] }'}</span>). Only{' '}
        <span className="font-mono text-xs">name</span>,{' '}
        <span className="font-mono text-xs">city</span>,{' '}
        <span className="font-mono text-xs">state</span>,{' '}
        <span className="font-mono text-xs">property_type</span>, and{' '}
        <span className="font-mono text-xs">purchase_price</span> are required.
      </p>

      <div className="flex gap-2 mb-3">
        {DEAL_IMPORT_EXAMPLES.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setOpenId(e.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              e.id === openId
                ? 'bg-rp-navy text-white'
                : 'bg-rp-gray-100 text-rp-gray-600 hover:bg-rp-gray-200'
            }`}
          >
            {e.title}
          </button>
        ))}
      </div>

      <p className="text-xs text-rp-gray-500 mb-2">{active.description}</p>
      <div className="relative">
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(activeText)}
          className="absolute top-2 right-2 text-xs text-rp-gray-400 hover:text-rp-navy bg-white/80 rounded px-2 py-1"
        >
          Copy
        </button>
        <pre className="overflow-x-auto rounded-lg bg-[#0A1628] text-rp-gray-100 text-xs p-4 leading-relaxed">
          {activeText}
        </pre>
      </div>
    </div>
  );
}
