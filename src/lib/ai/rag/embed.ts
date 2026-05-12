// Phase 5 — Gemini embeddings for RAG.
//
// One provider, two task types:
//   - RETRIEVAL_DOCUMENT at ingest (handled in the n8n ingestion workflow)
//   - RETRIEVAL_QUERY at search (this file, called from /api/ai/search-documents)
//
// Output dimensionality is locked to 1536 to match terminal_doc_chunks.embedding.
// Changing this requires a migration AND a re-embed of every chunk — do not do
// it casually.

const GEMINI_EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

export const EMBEDDING_MODEL = 'gemini-embedding-001@1536';
export const EMBEDDING_DIM = 1536;

export type EmbeddingTaskType = 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT';

export async function embedQuery(query: string): Promise<number[]> {
  return embed(query, 'RETRIEVAL_QUERY');
}

async function embed(text: string, taskType: EmbeddingTaskType): Promise<number[]> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GOOGLE_API_KEY is not set.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${GEMINI_EMBED_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIM,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Gemini embed failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const data = (await res.json()) as { embedding?: { values?: number[] } };
    const values = data.embedding?.values;
    if (!values || values.length !== EMBEDDING_DIM) {
      throw new Error(
        `Gemini embed returned ${values?.length ?? 0} dims, expected ${EMBEDDING_DIM}.`,
      );
    }
    return values;
  } finally {
    clearTimeout(timeout);
  }
}
