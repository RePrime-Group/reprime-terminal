import * as XLSX from 'xlsx-js-style';
import { HEADER_ALIASES, TEMPLATE_HEADERS, TEMPLATE_EXAMPLE_ROW } from './importSchema';

/**
 * Decode a base64-encoded XLSX string, parse the first sheet, and return rows
 * as objects keyed by canonical column names. Skips blank rows.
 *
 * Throws if the file can't be parsed at all (corrupt / not XLSX).
 */
export function parseInvestorsXlsxBase64(b64: string): Record<string, unknown>[] {
  const binary = b64.includes(',') ? b64.split(',', 2)[1] : b64;
  const workbook = XLSX.read(binary, { type: 'base64' });
  if (!workbook.SheetNames.length) {
    throw new Error('XLSX has no sheets.');
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });

  return raw
    .map((row) => normalizeRow(row))
    .filter((row) => Object.values(row).some((v) => v != null && String(v).trim() !== ''));
}

/** Map a raw row (headers as-typed) to canonical-keyed values. */
function normalizeRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalized = HEADER_ALIASES[String(key).trim().toLowerCase()];
    if (normalized) out[normalized] = value;
  }
  return out;
}

/** Generate the downloadable XLSX template (base64). */
export function buildTemplateXlsxBase64(): string {
  const ws = XLSX.utils.aoa_to_sheet([
    [...TEMPLATE_HEADERS],
    TEMPLATE_HEADERS.map((h) => TEMPLATE_EXAMPLE_ROW[h] ?? ''),
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Investors');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
