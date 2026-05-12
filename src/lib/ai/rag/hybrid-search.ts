// Phase 5 — Hybrid (semantic + lexical) search via Postgres RPC.
//
// Calls the search_doc_chunks SECURITY DEFINER function (see migration
// 20260514_search_doc_chunks_rpc.sql). The function returns up to k chunks
// fused via Reciprocal Rank Fusion; the route reranks the result down to the
// user-requested top_k.

import { createAdminClient } from '@/lib/supabase/admin';

export interface RetrievedChunk {
  id: string;
  document_id: string;
  page_start: number | null;
  page_end: number | null;
  content: string;
  title: string;
}

export async function hybridSearch(
  embedding: number[],
  dealId: string,
  query: string,
  k = 40,
): Promise<RetrievedChunk[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('search_doc_chunks', {
    query_embedding: embedding as unknown as string, // pgvector RPCs accept number[]; supabase-js types are loose
    p_deal_id: dealId,
    query_text: query,
    k,
  });

  if (error) throw new Error(`search_doc_chunks RPC failed: ${error.message}`);

  type Row = {
    id: string;
    document_id: string;
    page_start: number | null;
    page_end: number | null;
    content: string;
    title: string;
  };
  const rows = (data as Row[] | null) ?? [];
  return rows.map((r) => ({
    id: r.id,
    document_id: r.document_id,
    page_start: r.page_start,
    page_end: r.page_end,
    content: r.content,
    title: r.title,
  }));
}
