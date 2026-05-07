*Deal AI Assistant — progress update*

*✅ Phase 1 — UI (mocked API)*
• Sidebar `DealAssistantPanel` + all sub-components built under `src/components/portal/ai/`
• Four entry points wired: `AskAiPill` (floating), `AskAiSelector` (navbar), `DealCardAiIcon` (cards), Assistant tab on deal detail
• Mock API routes live at `src/app/api/ai/*` behind `AI_USE_MOCK=1`
• Hooks (`useDealAssistant`, `useConversationHistory`), client wrappers, and shared types in place
• i18n keys added to `en.json` / `he.json` (RTL mirror)

*✅ Phase 2 — Foundation*
• Env vars added to `.env.example` (n8n base URL, webhook paths, internal token)
• Healthcheck workflow live in n8n at `/webhook/ai-healthcheck`
• Feature flag `NEXT_PUBLIC_AI_ASSISTANT_ENABLED` ready

*✅ Phase 3 — Database + RLS*
• 3 migrations applied: `terminal_ai_conversations`, `terminal_ai_messages`, `terminal_ai_feedback`, `terminal_ai_audit`
• RLS policies live (owner/employee full, investors scoped to own threads + entitled deals)
• Read-only `reprime_ai_read` Postgres role created
• 9-test RLS suite passes (cross-user isolation, anon denial, ownership)

*✅ Phase 4 — n8n workflows (built, awaiting test)*
4 workflows created and refactored:
• `deal-assistant-chat` (24 nodes) — Claude Sonnet 4.6 + Postgres memory + 4 tools (Get Deal / Get Tenants / Get Documents / Compute Scenario), entitlement check, audit logging
• `deal-assistant-history` (12 nodes) — list conversations + messages, with ownership check
• `deal-assistant-feedback` (6 nodes) — thumbs up/down insert
• `deal-assistant-custom-tools` (6 nodes) — `compute_scenario` (cap rate, NOI, cash-on-cash, DSCR, full underwrite)

*Key architecture decisions*
• JWT validation moved to Vercel layer; n8n trusts `user_id` from body (matches our healthcheck pattern)
• Native Supabase nodes everywhere (no raw HTTP) using existing “Reprime Terminal” credential
• `supabaseTool` nodes connected directly to AI Agent — cleaner than `toolHttpRequest`
• Deal context locked from workflow state — LLM cannot redirect tool calls to other deals

*Supporting artifacts*
• System prompt drafted at `n8n/deal-assistant-prompt.md` (locked context, tool routing, citation rules, format, refusal, few-shot examples)
• End-to-end test script at `scripts/test-deal-assistant.sh` — auto-discovers real user + deal, exercises chat → history → feedback

*🚧 Still TODO to close Phase 4*
• Paste system prompt into AI Agent node + activate 4 workflows
• Run test script, verify clean JSON across all 5 calls
• Swap UI mocks for real Vercel API routes (`/api/ai/{chat,conversations,conversations/[id],feedback,compute-scenario}/route.ts`)
• Export 4 workflow JSONs into `n8n/workflows/`

*Up next (not started)*
• Phase 5 — RAG over deal documents (pgvector, chunking, hybrid retrieval)
• Phase 6 — Voice, rate limits, eval suite, beta rollout
