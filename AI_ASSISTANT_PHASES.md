# Deal AI Assistant — Agent Execution Plan

**Companion to:** `AI_ASSISTANT_IMPLEMENTATION.md` (read it first for full context)
**Companion to:** `AI_ASSISTANT_LEARNING.md` (concepts, in learning order)
**Format:** Phase-by-phase instructions for AI coding agents.
**How to use:** Each phase is a self-contained brief. Hand one phase to one agent. Do not skip the **Pre-flight**, **Acceptance Criteria**, or **Done When** blocks — they are the agent's contract.

---

## Build order (UI first)

We deliberately build the **UI first against a mocked API**, then layer in the backend. Reasons:
- Get user-visible polish locked in early; iterate on look/feel without backend bottlenecks.
- A mocked API forces us to nail down request/response contracts before we build the real n8n workflow against them.
- The existing `Reprime Terminal - AI Assistant` n8n workflow stays untouched as a prototype reference.

```
Phase 1 — UI (mocked API)              ← user-visible work first
Phase 2 — Foundation & env prep        ← keys, flags, healthcheck
Phase 3 — Database schema & RLS        ← tables ready, no app code touches yet
Phase 4 — n8n agent loop (real chat)   ← swap mocks for real backend
Phase 5 — RAG (documents)              ← qualitative answers from PDFs
Phase 6 — Voice, hardening, rollout    ← rate limits, evals, beta → GA
Phase 7 — Post-GA enhancements         ← SSE streaming, dashboard, etc.
```

---

## How an agent should work a phase

1. Read `AI_ASSISTANT_IMPLEMENTATION.md` once for full system context.
2. Read only the phase you are assigned — do not implement future phases.
3. Follow the file-path map (§ "Repo Map" below). Create new files where listed; do not invent alternative locations.
4. Use the codebase's existing conventions (see § "Coding Standards").
5. Stop at the **Done When** checklist. If a step is blocked, write the blocker into a `BLOCKERS.md` and exit — do not improvise security or schema decisions.

---

## Repo Map (authoritative file locations)

When a phase says "create X," create it at exactly these paths.

```
src/
├── app/
│   ├── api/
│   │   └── ai/
│   │       ├── chat/route.ts                  # Phase 1: mock; Phase 4: real proxy → n8n
│   │       ├── conversations/route.ts         # Phase 1: mock; Phase 4: real history list
│   │       ├── conversations/[id]/route.ts    # Phase 1: mock; Phase 4: real messages
│   │       ├── feedback/route.ts              # Phase 1: mock; Phase 4: real proxy
│   │       └── compute-scenario/route.ts      # Phase 4 only — internal, called by n8n
│   └── [locale]/(portal)/...                  # existing portal pages
├── components/
│   └── portal/
│       └── ai/
│           ├── DealAssistantPanel.tsx         # main sidebar
│           ├── DealAssistantHeader.tsx
│           ├── MessageList.tsx
│           ├── MessageBubble.tsx
│           ├── CitationChip.tsx
│           ├── CitationDrawer.tsx             # PDF.js viewer
│           ├── Composer.tsx
│           ├── VoiceButton.tsx
│           ├── SuggestedPrompts.tsx
│           ├── ThreadSwitcher.tsx
│           ├── FeedbackButtons.tsx
│           ├── AskAiPill.tsx                  # persistent floating pill
│           ├── AskAiSelector.tsx              # top-bar deal selector
│           └── DealCardAiIcon.tsx             # spark icon on cards
├── lib/
│   └── ai/
│       ├── client.ts                          # fetch wrappers around /api/ai/*
│       ├── types.ts                           # Message, Citation, ToolCall types
│       ├── mocks/
│       │   ├── conversations.ts               # Phase 1 only — sample threads
│       │   └── responses.ts                   # Phase 1 only — canned answers + citations
│       ├── prompts/
│       │   ├── system.static.ts               # Phase 4 — cached prefix
│       │   └── system.dynamic.ts              # Phase 4 — per-deal suffix
│       ├── hooks/
│       │   ├── useDealAssistant.ts
│       │   └── useConversationHistory.ts
│       └── voice/
│           ├── useSpeechRecognition.ts        # Phase 6
│           └── useSpeechSynthesis.ts          # Phase 6
└── messages/
    ├── en.json                                # add "ai.*" keys
    └── he.json                                # add "ai.*" keys

supabase/
└── migrations/
    ├── 20260507_ai_assistant_tables.sql       # Phase 3
    ├── 20260507_ai_assistant_rls.sql          # Phase 3
    ├── 20260514_ai_doc_chunks_pgvector.sql    # Phase 5
    └── 20260514_ai_doc_chunks_indexes.sql     # Phase 5

n8n/workflows/                                 # NEW directory — exported workflow JSON
├── deal-assistant-chat.json                   # Phase 4
├── deal-assistant-history.json                # Phase 4
├── deal-assistant-custom-tools.json           # Phase 4
├── deal-document-ingestion.json               # Phase 5
└── deal-assistant-feedback.json               # Phase 4

docs/
└── ai-assistant/
    ├── runbook.md                             # ops doc: deploy, rotate keys, kill switch
    ├── api-contract.md                        # Phase 1 — request/response shapes
    └── eval-set.md                            # Phase 6 eval suite
```

---

## Coding Standards (apply to every phase)

- **TypeScript strict.** No `any` except at clearly-marked boundaries with a `// eslint-disable-next-line` and a one-line reason.
- **No comments unless the WHY is non-obvious.** Don't narrate code.
- **No new abstractions until you have 3 concrete callers.** Inline first.
- **Server-only secrets.** Anthropic / Voyage keys live only in n8n. Vercel routes never call those APIs directly.
- **Auth.** Every Vercel `/api/ai/*` route validates the Supabase session, forwards the JWT to n8n in `Authorization: Bearer <jwt>`. No service-role key on the server side.
- **Errors.** Throw at boundaries; do not swallow. Return `{ error: { code, message } }` shapes from API routes — never raw stack traces.
- **i18n.** All user-visible strings go through `next-intl`. No hard-coded English in components.
- **Naming.** Prefix all new DB tables `terminal_ai_*`. Prefix all n8n workflows `deal-assistant-*`. Prefix all env vars `AI_*` or `N8N_*`.
- **Migrations.** One concern per migration file. Name `YYYYMMDD_<topic>.sql`. Always include rollback section as a comment.

Required env vars (set during Phase 2):

```
N8N_BASE_URL=https://primary-production-9ee0c.up.railway.app
N8N_WEBHOOK_PATH_CHAT=/webhook/deal-assistant
N8N_WEBHOOK_PATH_HISTORY=/webhook/deal-assistant/conversations
N8N_WEBHOOK_PATH_FEEDBACK=/webhook/deal-assistant/feedback
N8N_INTERNAL_TOKEN=<random>           # n8n → Vercel compute-scenario callback auth
```

n8n credentials vault (NOT in `.env`):

```
ANTHROPIC_API_KEY
VOYAGE_API_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
N8N_INTERNAL_TOKEN                    # mirrored, used to call back into Vercel
```

---

# PHASE 1 — UI (Mocked API)

**Owner:** 1 frontend agent.
**Estimated effort:** 3–4 days.
**Goal:** Ship the polished sidebar UI, all four entry points, citation drawer, accessibility, and i18n — running entirely against a **mocked API**. No backend, no Anthropic, no n8n.

### Pre-flight
- Skim existing components to learn brand tokens & animation conventions:
  - `src/components/portal/DealDetailClient.tsx`
  - `src/components/portal/DealCard.tsx`
  - `src/components/portal/PortalNavbar.tsx`
- Read spec §3 (Positioning) and §7 (UI/UX).
- Confirm `next-intl` setup in `src/i18n` and existing `src/messages/{en,he}.json` shape.

### Tasks

**1. API contract doc.** Create `docs/ai-assistant/api-contract.md` defining request/response shapes for:
- `POST /api/ai/chat` → `{ deal_id, conversation_id?, message }` ⇒ `{ message: { id, role, content, citations[] }, conversation_id }`
- `GET /api/ai/conversations?deal_id=...` ⇒ `{ conversations: [{ id, title, updated_at }] }`
- `GET /api/ai/conversations/[id]` ⇒ `{ messages: [...] }`
- `POST /api/ai/feedback` → `{ message_id, rating: -1|1, reason? }` ⇒ `{ ok: true }`

This doc is the source of truth that Phase 4 must match.

**2. Mock API routes** at the paths in the Repo Map:
- Each route reads from `src/lib/ai/mocks/*` and returns canned data with realistic latency (300–1500ms).
- Mocks include: 2 sample conversations, 3 message turns each, at least 1 citation chip pointing to a known PDF in your existing dataroom.
- Add a small `if (process.env.AI_USE_MOCK === '1')` switch in each route — Phase 4 will replace the body but keep the same boundaries.
- No real auth check yet; mock routes return 200 to any caller for now.

**3. Types** at `src/lib/ai/types.ts`:
- `Message`, `Conversation`, `ToolCall`, `Citation`, `ChatRequest`, `ChatResponse`, `FeedbackRequest`. Match the API contract exactly.

**4. Client** at `src/lib/ai/client.ts`:
- `sendMessage`, `listConversations`, `getConversation`, `submitFeedback`. All thin `fetch` wrappers using AbortController, typed by the types above.

**5. Components** (create at paths in Repo Map):
- `DealAssistantPanel.tsx` — 480px right sidebar, 250ms ease-out slide. Full-screen on mobile (<768px). Expandable to ~720px. Lifts open/close state via prop or context.
- `DealAssistantHeader.tsx` — deal context chip, thread switcher, expand button, close button.
- `MessageList.tsx` — virtualized list with role-styled bubbles, scroll-to-bottom on new message.
- `MessageBubble.tsx` — handles user/assistant/tool roles. Markdown render with safe HTML (use existing markdown lib if present; otherwise `react-markdown` + `rehype-sanitize`).
- `CitationChip.tsx` — small chip; click → opens `CitationDrawer`.
- `CitationDrawer.tsx` — secondary drawer next to chat (NOT on top). Lazy-loads PDF.js. Phase 1: render placeholder PDF page if `AI_USE_MOCK=1`.
- `Composer.tsx` — textarea + send + voice button placeholder. Disabled while pending. Cmd/Ctrl+Enter submits.
- `SuggestedPrompts.tsx` — 4 hard-coded prompts for V1 (deal-aware strings, but static).
- `ThreadSwitcher.tsx` — list of prior conversations on this deal (from mock).
- `FeedbackButtons.tsx` — 👍/👎 → `submitFeedback` → toast.
- `AskAiPill.tsx` — bottom-right floating gold pill.
- `AskAiSelector.tsx` — top-bar searchable dropdown of entitled deals.
- `DealCardAiIcon.tsx` — spark icon for marketplace/portfolio cards.

**6. Hooks** at `src/lib/ai/hooks/`:
- `useDealAssistant(dealId)` — manages active conversation, sends messages via `client.sendMessage`, optimistic user-message append, status text rotation while pending (*"Thinking…" → "Looking up tenant data…" → "Computing answer…"*).
- `useConversationHistory(dealId)` — lists prior conversations.

**7. Mount entry points:**

| File | Change |
|---|---|
| `src/components/portal/PortalNavbar.tsx` | Add `<AskAiSelector />` |
| `src/components/portal/DealCard.tsx` | Add `<DealCardAiIcon dealId={...} />` top-right |
| `src/components/portal/DealDetailClient.tsx` | Add new "Assistant" tab alongside Overview / Deal Structure / Financial Modeling / Dataroom |
| Portal layout (locate in `src/app/[locale]/(portal)/layout.tsx` or nearest equivalent) | Mount `<AskAiPill />` |

All four entry points must mount the **same `<DealAssistantPanel>`** with the same `dealId` so conversation state is shared.

**8. i18n:**
- Add `ai.*` keys to `src/messages/en.json` and `src/messages/he.json`.
- RTL: panel mirrors to the left side when `locale === 'he'`.

**9. Keyboard shortcuts:**
- `Cmd/Ctrl+K` opens panel for current deal context (or selector if no deal context).
- `Esc` closes panel.
- `↑/↓` traverse messages.

**10. Accessibility:**
- ARIA labels on every interactive element.
- Live region announces "assistant is thinking" / new message arrived.
- Color contrast ≥ 4.5:1.
- Focus trap inside panel when open.

**11. Feature flag.** Use the existing flag system (search the codebase for the current flag pattern before adding one). Default `ai_assistant_enabled` = `true` in dev, `false` in prod for now — we'll flip in Phase 6.

### Acceptance Criteria
- [ ] All four entry points open the same panel with the same conversation thread.
- [ ] Lighthouse a11y ≥ 95 on portal pages with the panel mounted.
- [ ] Citation chip click opens the drawer with the placeholder PDF page.
- [ ] Hebrew layout mirrors correctly.
- [ ] No hard-coded English strings introduced (regex sweep before PR).
- [ ] Panel state persists across in-app navigation within the same deal.
- [ ] `AI_USE_MOCK=1 npm run dev` returns mocked responses end-to-end with no console errors.
- [ ] `npm run typecheck` and `npm run lint` clean.

### Done When
All criteria green. Designer sign-off on sidebar look-and-feel. PR merged behind feature flag.

### Do Not
- Do not call Anthropic, Voyage, or n8n. This phase is mock-only.
- Do not introduce a new design system. Reuse existing tokens/components.
- Do not implement SSE streaming. Use the smart-loader (Option A in spec §7.4).
- Do not couple components to mock shapes — they must consume the typed contract from `src/lib/ai/types.ts` so Phase 4's swap is invisible to them.

### Pitfalls
- **Mock leaks into production:** the `AI_USE_MOCK` switch must default to `0`. Add a CI check that fails if mock routes return data when the flag is off.
- **Hard-coded copy:** every visible string must go through i18n from day one — adding it later is more painful than doing it now.

---

# PHASE 2 — Foundation & Environment Prep

**Owner:** 1 agent.
**Estimated effort:** 0.5 day.
**Goal:** Provision keys, audit existing RLS, prove a hello-world round trip from Vercel → n8n. UI from Phase 1 stays on mocks.

### Pre-flight
- Phase 1 merged.
- Confirm Supabase project has `pgvector` available: `select * from pg_available_extensions where name='vector'`.
- Confirm n8n instance reachable (we already know it is: `https://primary-production-9ee0c.up.railway.app`).
- Read `supabase/migrations/002_terminal_rls.sql` and verify entitlement pattern used on `terminal_deals`.

### Tasks
1. Add the env vars listed in "Coding Standards" to `.env.local.example` with placeholder values.
2. Create `docs/ai-assistant/runbook.md` with: deploy steps, kill-switch procedure (toggle `ai_assistant_enabled`), key rotation steps. Stub OK; flesh out as later phases land.
3. **RLS audit.** Read every existing policy on `terminal_deals`, `terminal_tenant_rent_roll`, `terminal_deal_documents`. Confirm: (a) no `using (true)`, (b) entitlement checks join the right tables, (c) anon role denied. If any finding, write to `BLOCKERS.md` and stop.
4. **Healthcheck workflow** in n8n (`n8n/workflows/_healthcheck.json`):
   - Webhook `POST /webhook/ai-healthcheck`
   - Validates JWT against Supabase
   - Returns `{ user_id, ok: true }`
5. **Healthcheck route** at `src/app/api/ai/healthcheck/route.ts` — POST proxy that forwards JWT and returns the n8n response.

### Acceptance Criteria
- [ ] `curl -X POST` to `/api/ai/healthcheck` with a valid Supabase JWT returns `{ user_id, ok: true }`.
- [ ] Same call with no/invalid JWT returns 401.
- [ ] `ai_assistant_enabled` feature flag toggles in dashboard; route 503s when disabled.
- [ ] RLS audit findings recorded (clean or with blockers documented).

### Done When
All criteria green. `runbook.md` committed.

### Risks
- RLS audit reveals `using (true)` policies → stop and write findings to `BLOCKERS.md`. Do not proceed.

---

# PHASE 3 — Database Schema, RLS, Tests

**Owner:** 1 agent.
**Estimated effort:** 1 day.
**Goal:** All AI-side tables exist with airtight RLS. No app code touches them yet. UI still on mocks.

### Pre-flight
- Phase 2 complete.
- Read spec §5 (Data Architecture) end to end.

### Tasks

**1. Migration `20260507_ai_assistant_tables.sql`** — create:
- `terminal_ai_conversations` (id, user_id, deal_id, title, status, created_at, updated_at)
- `terminal_ai_messages` (id, conversation_id, role, content jsonb, tool_calls jsonb, citations jsonb, model, input_tokens, output_tokens, latency_ms, created_at)
- `terminal_ai_feedback` (id, message_id, user_id, rating, reason, created_at)
- `terminal_ai_audit` (id, user_id, deal_id, conversation_id, event_type, payload jsonb, created_at) — admin-only read.

Match column types in spec §5.1 exactly. Add the indexes listed there.

**2. Migration `20260507_ai_assistant_rls.sql`** — policies from spec §5.2:
- Conversations: user sees own + entitled to deal.
- Messages: inherit access from conversation.
- Feedback: user can insert for their own messages.
- Audit: admin role only.

**3. Read-only Postgres role** for the future Supabase MCP tier (used in Phase 4):
```sql
create role reprime_ai_read nologin;
grant select on terminal_deals, terminal_tenant_rent_roll, terminal_deal_documents to reprime_ai_read;
-- terminal_doc_chunks GRANT added in Phase 5
alter default privileges in schema public revoke all on tables from reprime_ai_read;
```

**4. RLS test suite** at `supabase/tests/ai_rls.test.sql` (pgTAP or plain SQL):
- User A inserts conversation; user B SELECT returns 0 rows.
- Anon role SELECT on every `terminal_ai_*` table returns 0 rows.
- Entitled user can insert message into own conversation; unentitled user cannot.

**5. Regenerate Supabase types** (check `package.json` scripts; document in `runbook.md` if manual). Commit the regenerated type file.

### Acceptance Criteria
- [ ] All migrations apply cleanly to a fresh Supabase project.
- [ ] All RLS tests pass.
- [ ] `anon` SELECT on any AI table returns 0 rows even if data exists.

### Done When
Migrations committed, types regenerated, tests green.

### Do Not
- Do not enable pgvector or create `terminal_doc_chunks` here. That is Phase 5.
- Do not write app code touching these tables yet.

---

# PHASE 4 — Real Backend (Swap UI Mocks for n8n + Claude)

**Owner:** 1 backend agent.
**Estimated effort:** 2–3 days.
**Goal:** Replace the Phase-1 mocks with the real n8n agent loop using the Supabase MCP for reads + `compute_scenario`. **No RAG yet.** UI from Phase 1 should require zero changes — only the API route bodies change.

### Pre-flight
- Phases 1, 2, 3 complete.
- Read spec §4 (AI Logic), §6.1 (Workflow A), §9 (Security) end to end.
- Confirm Supabase MCP supports per-request JWT auth. If not, plan the JWT-scoped Postgres-role proxy node (spec §9.1) before starting.
- The existing `Reprime Terminal - AI Assistant` workflow stays untouched as a reference. Build the new one alongside.

### Tasks

**1. Real Vercel route `src/app/api/ai/chat/route.ts`:**
- Replace mock body with: validate Supabase session, forward `{ deal_id, conversation_id, message }` + JWT to `${N8N_BASE_URL}${N8N_WEBHOOK_PATH_CHAT}`.
- Returns the JSON response. 60s timeout, graceful error JSON on timeout.
- 503 if `ai_assistant_enabled` is off.
- **Response shape must match the API contract from Phase 1.**

**2. Real `src/app/api/ai/conversations/route.ts`, `/[id]/route.ts`, `/feedback/route.ts`:**
- Same swap pattern: same input/output shapes, real proxy bodies.

**3. Vercel route `src/app/api/ai/compute-scenario/route.ts`** — internal POST handler called by n8n:
- Auth via `N8N_INTERNAL_TOKEN` header (not Supabase JWT).
- Body: `{ deal_id, overrides? }`.
- Locate the existing deal calculator (search `src/lib` for `deal-calculator`). Do not duplicate.
- Returns numeric outputs.

**4. n8n workflow `deal-assistant-chat`** (new — do not edit the existing prototype):

Build per spec §6.1. Node-by-node skeleton:

| # | Node | Purpose |
|---|---|---|
| 1 | Webhook `POST /webhook/deal-assistant` | entry |
| 2 | Function: extract JWT + body | parse |
| 3 | HTTP Request: `GET ${SUPABASE_URL}/auth/v1/user` with JWT | validate user |
| 4 | IF: user_id present | else 401 |
| 5 | Postgres (JWT-scoped): `select id from terminal_deals where id = $1` | RLS authorization |
| 6 | IF: row returned | else 403 |
| 7 | Postgres: load or insert `terminal_ai_conversations` | thread |
| 8 | Postgres: last 10 `terminal_ai_messages` ordered by created_at | history |
| 9 | Function: assemble Claude request (cached static system prompt + dynamic suffix + history + new user message) | prompt |
| 10 | Anthropic Agent (Sonnet 4.6) with: Supabase MCP client (per-request JWT, table whitelist) + custom tool defs (`compute_scenario`, `submit_feedback`) | reasoning |
| 11 | Loop guard: max 5 tool iterations, 60s wall clock | bound |
| 12 | Postgres: insert user message | persist |
| 13 | Postgres: insert assistant message with tokens, latency, tool_calls | persist |
| 14 | IF first turn → Anthropic Haiku → update `terminal_ai_conversations.title` | title |
| 15 | Postgres: insert into `terminal_ai_audit` | log |
| 16 | Respond to Webhook: `{ message, conversation_id, citations }` | return |

Export to `n8n/workflows/deal-assistant-chat.json`.

**5. n8n workflow `deal-assistant-custom-tools`:**

Switch on `tool_name`. Phase-4 branches only:
- `compute_scenario` → HTTP Request to Vercel `/api/ai/compute-scenario` with `N8N_INTERNAL_TOKEN`.
- `submit_feedback` → Postgres INSERT into `terminal_ai_feedback`.
- Stubs for `search_deal_documents` / `get_document_excerpt` returning "not yet enabled" — enabled in Phase 5.

Export to `n8n/workflows/deal-assistant-custom-tools.json`.

**6. n8n workflow `deal-assistant-history`** per spec §6.2.
**7. n8n workflow `deal-assistant-feedback`** per spec §6.6.

**8. Static system prompt** at `src/lib/ai/prompts/system.static.ts` — identity, hard rules, tool descriptions, citation format. Single template string. Load into n8n via Set node containing the byte-identical text.

**9. Dynamic suffix** at `src/lib/ai/prompts/system.dynamic.ts` — `buildDealSuffix({ deal_id, deal_name, asset_class, role, locale })`.

**10. Delete mock routes / move behind `AI_USE_MOCK=1`.** Mocks should still work for local UI work but production must hit the real backend.

### Acceptance Criteria
- [ ] POST to `/api/ai/chat` with `"What is the cap rate on this deal?"` returns a correct numeric answer in < 5s p50.
- [ ] *"Which leases expire before year 5?"* triggers an MCP SQL query with `lease_end < now() + interval '5 years'` and returns named tenants.
- [ ] Cross-deal isolation test: pass another `deal_id` in the message body — answer remains scoped to the URL-bound `deal_id` (RLS confirms).
- [ ] Every assistant turn persisted with `input_tokens`, `output_tokens`, `latency_ms`, `tool_calls`.
- [ ] Anthropic console shows `cache_read_input_tokens` ≥ 50% of `input_tokens` after second request.
- [ ] Tool loop hard-stops at 5 iterations or 60s.
- [ ] Phase-1 UI works against the real backend with **zero component changes** — proves the contract held.

### Done When
All criteria green. Workflow JSON exported and committed.

### Do Not
- Do not edit the existing `Reprime Terminal - AI Assistant` workflow (id `52uI7cIIIIpOGS0U`). It stays as a prototype reference. Build new ones alongside.
- Do not implement RAG.
- Do not store the Supabase service-role key in n8n.

### Pitfalls
- **Prompt cache miss:** any byte-difference in the static prefix invalidates cache. No timestamps/random IDs.
- **Service-role leak:** if you find a service-role-key credential anywhere in n8n, delete it before continuing.
- **Tool result shape:** every custom tool sub-workflow output must be `{ tool_use_id, content: string | blocks[] }`.
- **Contract drift:** if you must change a request/response shape, update `docs/ai-assistant/api-contract.md` AND the UI types in the same PR.

---

# PHASE 5 — RAG (Documents)

**Owner:** 1 agent.
**Estimated effort:** 3–4 days.
**Goal:** Documents chunked, embedded, indexed. Assistant answers qualitative questions with PDF citations. Citation drawer (already built in Phase 1) now opens real PDFs at the cited page.

### Pre-flight
- Phase 4 stable.
- Voyage API key in n8n vault.
- Read spec §4.4, §5.1, §6.5.

### Tasks

**1. Migration `20260514_ai_doc_chunks_pgvector.sql`:**
- `create extension if not exists vector;`
- Create `terminal_doc_chunks` per spec §5.1 (with `embedding vector(1024)` and `content_tsv` generated column).

**2. Migration `20260514_ai_doc_chunks_indexes.sql`:**
- ivfflat on embedding (`with (lists = 100)`).
- GIN on `content_tsv`.
- btree on `deal_id`.
- RLS policy from spec §5.2.
- `grant select on terminal_doc_chunks to reprime_ai_read;`

**3. n8n workflow `deal-document-ingestion`** per spec §6.5. Trigger options in priority order:
- Supabase Database webhook on `terminal_deal_documents` insert.
- Polling fallback every 5 minutes for `indexed_at IS NULL`.
- Manual trigger for backfill.

Pipeline: skip `do_not_index` → download from Storage → extract (Unstructured.io for PDFs/DOCX, pdf-parse fallback) → chunk ~800 tokens / 100 overlap, page-aware → batch embed via Voyage-3-large (batch ≤ 64) → upsert by `(document_id, chunk_index)` → set `indexed_at` → audit log.

Export to `n8n/workflows/deal-document-ingestion.json`.

**4. RAG branches in `deal-assistant-custom-tools`:**

`search_deal_documents`:
- HTTP: Voyage embed query.
- Postgres hybrid SQL (semantic + lexical → RRF):

```sql
with semantic as (
  select id, 1 - (embedding <=> $1::vector) as score
  from terminal_doc_chunks
  where deal_id = $2
  order by embedding <=> $1::vector
  limit 12
),
lexical as (
  select id, ts_rank(content_tsv, plainto_tsquery($3)) as score
  from terminal_doc_chunks
  where deal_id = $2 and content_tsv @@ plainto_tsquery($3)
  order by score desc
  limit 12
),
fused as (
  select id, sum(1.0 / (60 + rn)) as rrf
  from (
    select id, row_number() over () as rn from semantic
    union all
    select id, row_number() over () as rn from lexical
  ) r
  group by id
)
select c.id, c.document_id, c.page_start, c.page_end, c.content
from terminal_doc_chunks c join fused f on c.id = f.id
order by f.rrf desc
limit 12;
```

- HTTP: Voyage rerank-2 → return top 5.
- Output: `{ chunks: [{ document_id, page, title, content }] }`.

`get_document_excerpt`:
- Postgres SELECT chunk text by `(document_id, page)` with highlight context.

**5. Update `deal-assistant-chat` to register the two new tools on the Anthropic Agent node.** Re-export.

**6. Backfill workflow** `n8n/workflows/deal-document-ingestion-backfill.json` — manual trigger that fans out unindexed docs to the ingestion workflow. Document in `runbook.md`.

**7. Update `CitationDrawer.tsx`** to render the real PDF (drop the Phase-1 placeholder). Lazy-load PDF.js, jump to `page`, scroll the cited passage into view if highlight metadata is present.

### Acceptance Criteria
- [ ] Backfill on a known deal indexes every supported document; `indexed_at` set on each.
- [ ] *"What does the Phase I ESA say about contamination?"* returns an answer with at least one citation chip pointing to the correct PDF + page.
- [ ] Lexical-only query (a literal dollar amount or section number) recalls the right chunk.
- [ ] Retrieval (embed + search + rerank) p95 ≤ 1.2s.
- [ ] Re-uploading a document replaces (not duplicates) chunks.

### Done When
All criteria green. Backfill ran successfully on staging.

### Pitfalls
- **Scanned PDFs:** detect via low text/page ratio; queue for OCR.
- **Voyage rate limits:** batch ≤ 64; exponential backoff.
- **Stale chunks:** always upsert by `(document_id, chunk_index)` or DELETE+INSERT in a transaction.

---

# PHASE 6 — Voice, Hardening, Rollout

**Owner:** 1 agent + reviewer for evals.
**Estimated effort:** 3–4 days.
**Goal:** Voice in/out via browser APIs, rate limits, eval suite, prompt-injection red-team, beta → GA.

### Pre-flight
- Phases 1–5 complete and stable.
- Read spec §8 (Voice), §9 (Security), §10 (Enhancements).

### Tasks

**1. Voice hooks at `src/lib/ai/voice/`:**
- `useSpeechRecognition.ts` — Web Speech API. Feature-detect; hide button if unsupported.
- `useSpeechSynthesis.ts` — SpeechSynthesis. Per-message speaker button.
- Wire into `Composer.tsx` (`VoiceButton.tsx`) and `MessageBubble.tsx`.
- Locale-aware (`lang = he-IL` for Hebrew).

**2. Rate limits in `deal-assistant-chat`:**
- Per-user: 30 messages/hour (Postgres counter or n8n static-data store).
- Per-conversation token cap: 200k cumulative input tokens.
- Daily spend log + alarm.

**3. Eval suite at `docs/ai-assistant/eval-set.md` + `n8n/workflows/deal-assistant-eval.json`:**
- ~100 questions × 3 deal archetypes (multi-tenant industrial, single-tenant retail, mixed-use).
- Expected facts (substring matches, not exact strings).
- Eval workflow runs against staging; measures pass rate, citation precision, hallucination sample, refusal correctness.
- CI hook: `npm run eval:ai` triggers the workflow; fails build < 95% pass rate.

**4. Prompt-injection red-team:**
- 50 adversarial chunk fixtures at `docs/ai-assistant/redteam-fixtures.md`.
- Run through `search_deal_documents`; verify no instruction-following.

**5. Admin permission:**
- Extend `TeamPermissions` with `view_investor_conversations`.
- Admin UI in existing team settings.
- Audit log every admin read of another user's conversation into `terminal_ai_audit`.

**6. Privacy disclosure:**
- One-line copy on first assistant open per user. Persist dismissal.
- Link to existing privacy policy.

**7. Kill switch:** document procedure in `runbook.md` (global flag flip + per-user override).

**8. Beta:** enable for 3–5 friendly investors via per-user flag. 1 week. GA gate: zero P0 bugs in last 7 days, eval pass rate ≥ 95%.

### Acceptance Criteria
- [ ] Voice input transcribes English and Hebrew correctly in Chrome.
- [ ] Rate limit returns a graceful UI message at the 31st request in an hour.
- [ ] Eval suite passes ≥ 95% in CI.
- [ ] Red-team set: zero injection successes.
- [ ] Admin reading another user's conversation produces an audit row.
- [ ] Kill switch verified end-to-end.

### Done When
GA gate met; flag flipped for full investor base.

---

# PHASE 7 — Post-GA Enhancements

Each is independently shippable. Pick by user-feedback signal.

| Enhancement | Tasks | File targets |
|---|---|---|
| **SSE streaming** | New route `src/app/api/ai/stream/route.ts` proxying n8n with SSE; update `useDealAssistant`. | route + hook |
| **Personalized suggested prompts** | n8n cron → Haiku → cache table `terminal_ai_suggested_prompts`; UI reads cache. | migration + workflow + `SuggestedPrompts.tsx` |
| **Multi-modal RAG** | Vision pass on images/diagrams, table-row chunks. | `deal-document-ingestion` + chunk schema additions |
| **Admin insights dashboard** | New page `src/app/[locale]/(admin)/ai-insights/page.tsx`; aggregate queries. | new page + components |
| **Premium voice** | Whisper input via n8n; ElevenLabs output via signed URL; user setting toggle. | `useSpeechRecognition` swap + new n8n branch |

Each Phase 7 ticket gets its own brief in the same pattern: Pre-flight, Tasks, Acceptance, Done When.

---

# Cross-Phase Operational Notes

### Definition of "Done" for any phase
1. All tasks implemented at the file paths in the Repo Map.
2. All acceptance criteria verified manually + by automated tests where applicable.
3. Migrations applied to staging.
4. Workflow JSON exported under `n8n/workflows/` and committed.
5. Updates to `runbook.md` for any new ops procedure.
6. PR description references this file by phase number.

### What an agent must NEVER do
- Store the Supabase service-role key in n8n.
- Write SQL inside Vercel API routes that bypasses RLS.
- Skip the prompt-cache static/dynamic split.
- Invent new file paths that contradict the Repo Map.
- Implement a future phase's work to "save time."
- Disable an RLS policy without documenting why in `BLOCKERS.md` and getting human review.
- Edit the existing `Reprime Terminal - AI Assistant` n8n workflow (id `52uI7cIIIIpOGS0U`). It is a prototype reference only.

### When blocked
Write to `BLOCKERS.md` with: phase number, task, exact obstacle, what you tried, what decision is needed. Stop. Do not improvise security or schema.

### Verification checklist before opening a PR
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] Migrations apply on a fresh DB without errors.
- [ ] All new env vars added to `.env.local.example`.
- [ ] No secrets in committed files (`git diff` review).
- [ ] Workflow JSON committed.
- [ ] `runbook.md` updated if ops surface changed.
