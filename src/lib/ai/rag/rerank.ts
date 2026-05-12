// Phase 5 — Cohere Rerank for RAG.
// Reorders the RRF-fused candidates by query relevance and returns the top N.

import type { RetrievedChunk } from './hybrid-search';

const COHERE_RERANK_URL = 'https://api.cohere.com/v2/rerank';
const RERANK_MODEL = 'rerank-v3.5';

export async function rerank(
  query: string,
  candidates: RetrievedChunk[],
  topN: number,
): Promise<RetrievedChunk[]> {
  if (candidates.length === 0) return [];

  const key = process.env.COHERE_API_KEY;
  if (!key) throw new Error('COHERE_API_KEY is not set.');

  const documents = candidates.map((c) => c.content);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(COHERE_RERANK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: RERANK_MODEL,
        query,
        documents,
        top_n: Math.min(topN, documents.length),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Cohere rerank failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      results?: Array<{ index: number; relevance_score: number }>;
    };
    const results = data.results ?? [];
    return results
      .map((r) => candidates[r.index])
      .filter((c): c is RetrievedChunk => Boolean(c));
  } finally {
    clearTimeout(timeout);
  }
}
