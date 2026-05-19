# Update — Deal Assistant document listing

## Before (the problem)

- When asked "what / how many documents do we have in this deal", the chat agent called the embeddings/RAG search tool instead of the document list tool.
- Result: it only saw the few documents that had finished RAG embedding — not the real dataroom.
- It also didn't account for the two separate document sources: `terminal_dd_documents` (uploaded files) AND the deal-level docs (PSA, LOI, Lease Summary, etc.) — so the answer was incomplete and not separated.

## After (what we did)

- Chat agent now routes document-listing questions to `Get_Documents` (never the search tool).
- Answer now shows BOTH document sources in two clear sections:
  - Key Deal Documents (PSA, LOI, OM, Lease Summary, etc.)
  - Due Diligence Documents (all uploaded dataroom files)
- Removed the `indexing_status=succeeded` filter — listing now shows the FULL dataroom, not just the docs that finished RAG embedding (was showing ~8, now shows all 42 on the test deal).
- Added a focused test script (`scripts/test-doc-listing.mjs`) — verified on 203 West Weber, all checks passing.
- Change is live on the n8n chat workflow.

## Known follow-ups (not done yet — needs discussion)

- DD uploads overlap with the key deal docs (same files counted twice) — needs a de-dupe decision.
- Proposed direction: consolidate all docs into `terminal_dd_documents` as single source of truth, drop the deal-row storage-path columns + `source_kind`. This is a migration, not a quick change — needs an audit + plan before touching (would break admin upload/download flows if done carelessly).
