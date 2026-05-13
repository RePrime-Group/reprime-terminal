# Reprime AI Assistant — today

- Phase 6 RAG hardening: shipped Steps 1–7 (10 migrations, 2 Server Actions, 8 n8n workflow edits).
- New `indexing_status` state machine on `terminal_dd_documents` (pending → processing → succeeded / failed) with `attempts` + `last_error` columns; `do_not_index` dropped.
- Dropped dead chunk columns (`page_start`, `page_end`, `token_count`) and simplified the citation marker from `(uuid, page)` → `(uuid)` across schema, RPCs, n8n, agent prompt, chat route, drawer, types, mocks.
- Rebuilt n8n ingestion workflow `Po35WsflKy9wGR4g`: added `Mark Processing` + `Mark Failed` + `Respond Failed` nodes, wired per-node `onError: continueErrorOutput` on all 11 fallible nodes into one centralized failure path; re-laid-out the diagram into 3 clean rows.
- Updated chat workflow `6hz22YdBC500tHxg`: `Get Documents` filters `indexing_status='succeeded'`, `Search_Deal_Documents` now accepts an optional `document_id` so the agent can scope retrieval to one doc (fixes short-doc drown-out).
- Auto-ingest plumbing: `enqueueIngest` helper (3-in-flight semaphore, 5s timeout, never throws) + `enqueueIngestAction` Server Action wired into 3 dataroom upload sites.
- Step 7 deal-level slot mirroring: 9-value `doc_source_kind` enum + `promoteDealDocAction` / `removeDealDocAction`; OM, LOI, PSA, Full Report, CoStar, Tenants, Lease Summary, and per-address OM uploads now auto-ingest into RAG.
- Fixed Gemini model identifier (`gemini-embedding-002` → `gemini-embedding-2`) after a 404 — Google's identifier has no leading zeros.
- Killed the fake `useStreamReveal` setInterval-based "typewriter" (was re-parsing Markdown on every 18ms tick) and replaced it with a pure-CSS mask reveal — smooth, GPU-only, zero re-renders.
- Smoke-tested end-to-end on "203 West Weber" via `scripts/smoke-test-deal-docs.mjs`: 5/6 deal-level docs ingested cleanly with real citations rendering in the chat; PSA failed on a corrupted merged PDF (skipped per senior call).
- Tomorrow: Step 8 mass backfill of 2,384 existing docs, OCR strategy, and failure-triage policy.
