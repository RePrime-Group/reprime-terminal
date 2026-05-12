import { NextRequest, NextResponse } from 'next/server';
import { embedQuery } from '@/lib/ai/rag/embed';
import { hybridSearch } from '@/lib/ai/rag/hybrid-search';
import { rerank } from '@/lib/ai/rag/rerank';

export const maxDuration = 60;

interface SearchRequest {
  deal_id: string;
  query: string;
  top_k?: number;
}

interface ResponseChunk {
  document_id: string;
  title: string;
  page_start: number | null;
  page_end: number | null;
  content: string;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  // TODO: secure this endpoint once N8N_INTERNAL_TOKEN is provisioned on both
  // Vercel (this app) and Railway (n8n). When set, gate by header or ?token=.
  const expected = process.env.N8N_INTERNAL_TOKEN;
  if (expected) {
    const provided =
      request.headers.get('x-internal-token') ??
      new URL(request.url).searchParams.get('token');
    if (provided !== expected) return jsonError('Unauthorized.', 401);
  }

  let body: SearchRequest;
  try {
    body = (await request.json()) as SearchRequest;
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const dealId = body.deal_id?.trim();
  const query = body.query?.trim();
  if (!dealId) return jsonError('deal_id is required.', 400);
  if (!query) return jsonError('query is required.', 400);

  const topK = clamp(body.top_k ?? 20, 1, 40);

  let embedding: number[];
  try {
    embedding = await embedQuery(query);
  } catch (e) {
    return jsonError(toMessage(e, 'Embedding failed'), 502);
  }

  let candidates;
  try {
    candidates = await hybridSearch(embedding, dealId, query, 40);
  } catch (e) {
    return jsonError(toMessage(e, 'Hybrid search failed'), 500);
  }

  if (candidates.length === 0) {
    return NextResponse.json({ chunks: [] });
  }

  let top;
  try {
    top = await rerank(query, candidates, topK);
  } catch (e) {
    return jsonError(toMessage(e, 'Rerank failed'), 502);
  }

  const chunks: ResponseChunk[] = top.map((c) => ({
    document_id: c.document_id,
    title: c.title,
    page_start: c.page_start,
    page_end: c.page_end,
    content: c.content,
  }));

  return NextResponse.json({ chunks });
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}

function toMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? `${fallback}: ${e.message}` : fallback;
}
