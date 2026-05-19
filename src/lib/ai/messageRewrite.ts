import type { SupabaseClient } from '@supabase/supabase-js';
import type { Citation } from '@/lib/ai/types';

// Matches full UUID `(uuid)` or short prefix `(abcdef12)`. Mirrors the regex
// used in src/app/api/ai/chat/route.ts — keep these in sync.
const CITE_RE = /\(([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[0-9a-f]{8,})\)/gi;

const MAX_ITER_PATTERNS: RegExp[] = [
  /agent\s+stopped\s+due\s+to\s+max[\s_-]*iterations?/i,
  /agent\s+stopped\s+due\s+to\s+iteration\s+limit/i,
  /maximum\s+iterations?\s+(reached|exceeded)/i,
];

const FRIENDLY_MAX_ITER_TEXT =
  "I couldn't put together a complete answer on this one after a few attempts. Try narrowing the question (e.g. ask about a specific tenant, document, or metric) and I'll take another pass.";

export function rewriteMaxIterations(text: string): string {
  if (!text) return text;
  return MAX_ITER_PATTERNS.some((re) => re.test(text)) ? FRIENDLY_MAX_ITER_TEXT : text;
}

export async function extractCitationsFromText(
  content: string,
  dealId: string,
  admin: SupabaseClient,
): Promise<Citation[]> {
  const refs: string[] = [];
  for (const m of content.matchAll(CITE_RE)) {
    refs.push(m[1].toLowerCase());
  }
  if (refs.length === 0) return [];

  const { data } = await admin
    .from('terminal_dd_documents')
    .select('id,name,display_name')
    .eq('deal_id', dealId);
  const docs = (data ?? []) as { id: string; name: string | null; display_name: string | null }[];

  const resolve = (ref: string): { id: string; label: string } | null => {
    const exact = docs.find((d) => d.id === ref);
    if (exact) return { id: exact.id, label: exact.display_name || exact.name || exact.id };
    const prefix = docs.find((d) => d.id.startsWith(ref));
    return prefix ? { id: prefix.id, label: prefix.display_name || prefix.name || prefix.id } : null;
  };

  const seen = new Map<string, Citation>();
  for (const ref of refs) {
    const resolved = resolve(ref);
    if (!resolved) continue;
    if (!seen.has(resolved.id)) {
      seen.set(resolved.id, { id: resolved.id, kind: 'document', label: resolved.label, document_id: resolved.id });
    }
  }
  return Array.from(seen.values());
}

export function stripCitationMarkers(content: string): string {
  return content
    .replace(CITE_RE, '')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
