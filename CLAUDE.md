# Reprime Terminal — Agent Instructions

This file is the operating contract for any AI agent working in this repo. Read it before doing anything; it overrides general defaults.

---

## 1. Project, in one paragraph

Reprime Terminal is a Next.js 16 (App Router, React 19) real-estate deal-room SaaS. Backend is Supabase (Postgres + Storage + RLS). Background work and the AI assistant pipeline live in **n8n on Railway** (`https://primary-production-9ee0c.up.railway.app`). The deal assistant is a Claude Sonnet 4.6 agent inside n8n that calls Vercel API routes as tools; document RAG uses Gemini embeddings (1536d), Cohere rerank, and a Supabase pgvector + tsvector hybrid index. UI is Tailwind v4. We do NOT use a separate test framework yet — verification is typecheck + manual + Playwright when needed.

---

## 2. Git Identity & Commits — non-negotiable

- Commit identity is already set on this machine: `mumar-code <umar@impleko.ai>`. **Do not change it.** Before committing, verify with `git config user.name` and `git config user.email`. If either is wrong, stop and ask — never run `git config` to "fix" it yourself.
- **Never add a `Co-Authored-By: Claude …` trailer.** Past sessions have repeatedly required amend/force-push to remove these. Plain commit messages only.
- Commit-message style matches what's already in `git log`: short prefix (`feat:`, `fix:`, `chore:`) + lowercase summary. Match the existing voice; do not switch to Conventional-Commits formality unless asked.
- **Never** use `--no-verify`, `--no-gpg-sign`, `git push --force` (without explicit ask), `git reset --hard`, or `git rebase -i`. If a hook fails, fix the underlying issue.
- Only commit when the user asks. Do not commit proactively after edits.

---

## 3. Scope Discipline — read this twice

The single biggest source of friction in this repo has been agents doing more than asked. Rules:

- **Do only what was asked.** No adjacent refactors, no "while I'm here" cleanups, no renaming, no reorganizing types, no introducing abstractions, no adding error-handling for cases that can't happen.
- If you think a broader change is warranted, **stop and propose it in one sentence** before touching anything.
- Bug fix ≠ rewrite. Merge-conflict resolution ≠ rewriting the file — fix only the conflict markers.
- **Prefer Next.js Server Actions over new API routes.** Do not add a route under `src/app/api/...` unless (a) the user asked for one, or (b) an external system (n8n, webhook) needs to call it. Internal client → server calls go through server actions.
- Do not move interfaces/types into shared files unless explicitly asked. Moving schemas ≠ moving the surrounding interfaces.
- Do not delete code as part of a feature change. If something looks dead, list it and ask.

---

## 4. Architecture map (so you don't have to grep blindly)

```
src/
  app/
    [locale]/          # localized pages (next-intl)
    api/
      ai/
        chat/                # POST: parses agent output, structures citations
        compute-scenario/    # internal tool route — token-auth via x-internal-token
        search-documents/    # internal RAG tool route — token-auth
        conversations/       # chat history CRUD
        healthcheck/
        _n8n.ts              # shared n8n client helpers
        _runtime.ts          # shared route runtime config
  components/
    portal/ai/         # all chat UI — Composer, MessageList, CitationDrawer, etc.
    admin/             # admin dashboards
    ui/                # design-system primitives
  lib/
    ai/
      rag/             # embed.ts, rerank.ts, hybrid-search.ts (provider-isolated)
      prompts/         # system prompts for the assistant
      types.ts         # Citation, Message, Conversation shapes
    supabase/          # server + browser client factories
    auth/              # auth helpers, RLS-aware
supabase/migrations/   # all schema lives here — see Section 6
n8n/                   # exported workflow JSONs (when present)
scripts/               # one-off verification + audit scripts (verify-phase-5.mjs etc.)
docs/ai-assistant/     # phase docs, workflow walkthrough, runbook
```

**Source of truth for the assistant workflow logic is n8n itself**, not the repo. Three workflows on Railway:
- Ingestion (RAG): `Po35WsflKy9wGR4g`
- Retrieval (RAG): `TnCTguqlGPIDVNbj`
- Deal Assistant (Chat): `6hz22YdBC500tHxg`

See `docs/ai-assistant/workflow-walkthrough.md` and `docs/ai-assistant/phase-5-implementation.md` before touching any workflow.

---

## 5. Available MCPs — check before declining

- **n8n MCP** (`mcp__n8n__*`) is installed and configured against the Railway instance. Use it to read/update/validate workflows directly. Do not edit workflow JSON by hand and ask the user to import.
- **Supabase MCP** may have permission limits; if a call is blocked, fall back to writing a migration SQL file under `supabase/migrations/` for the user to apply.
- If the user mentions Playwright for UI verification, assume Playwright MCP can be wired up — ask before claiming you can't drive a browser.

Before saying "I can't do X," check the MCP list in the current tools.

---

## 6. Supabase rules

- **All schema changes go into `supabase/migrations/`** with the existing date-prefixed naming (`YYYYMMDD_short_name.sql`). Never tell the user to "just run this in the dashboard" — that has bitten us; schema-of-record lives in this folder.
- After a migration that changes table shape, regenerate types: `npx supabase gen types typescript --project-id <id> --schema public > src/types/supabase.ts` (only if the user asks; otherwise note it as a follow-up).
- RLS is on for every user-facing table. Any new table needs explicit RLS policies in the same migration — never leave a table with RLS disabled.
- Internal API routes (the ones called by n8n) use the **service-role client** and pass token auth via `x-internal-token`. The `deal_id` in the body is the scope authority — don't trust anything the LLM put in the request. Triple-check `WHERE deal_id = $1` in any SQL these routes run.
- Atomic writes: use RPCs that do DELETE + INSERT in one statement (see `replace_doc_chunks`). Don't `ON CONFLICT DO NOTHING` for chunk-style upserts.

---

## 7. AI assistant — load-bearing invariants

If you're editing anything under `src/lib/ai/`, `src/app/api/ai/`, `src/components/portal/ai/`, or any of the three n8n workflows, these are non-negotiable:

- **Embedding contract:** Gemini `gemini-embedding-001`, `output_dimensionality: 1536`. `task_type: RETRIEVAL_DOCUMENT` at ingest, `RETRIEVAL_QUERY` at search. Mixing task_types silently poisons recall — no error, just bad results.
- **Contextualization caching:** the Haiku call in ingestion uses `cache_control: ephemeral` on the `<document>` block. That block must be **byte-identical** across all chunks of one doc — never inject chunk index or timestamps into it.
- **Deal-scope authority:** in the chat workflow, `deal_id` is read from `Carry Context`, never from `$fromAI`. Same rule in every API tool route — the model must not be able to redirect retrieval to another deal.
- **Citations:** the chat agent emits `(uuid, page)` markers; `src/app/api/ai/chat/route.ts` parses them into structured `Citation[]` and strips them from displayed text. If you change the marker format on one side, change both.
- **One retrieval tool only.** Do not add `get_document_excerpt`, `summarize_document`, or a second RAG tool. The drawer handles re-fetch.

---

## 8. UI conventions

- Tailwind v4 + design-system primitives under `src/components/ui/`. Reuse, don't reinvent.
- This product has an established visual language (dark theme, dense data tables, deal cards). When adding UI, look at neighbors in `src/components/portal/` and match — don't introduce a new aesthetic mid-feature.
- For any visible change, the user wants to see it working in the browser before "done" — don't claim a UI task is complete based on typecheck alone. If you can't verify, say so explicitly.
- Localization: user-facing strings go through `next-intl` (`src/messages/`). Don't hardcode English in new pages.

---

## 9. Working agreements

- **Communication style:** brief, direct, no preamble. When asked for a recommendation, give one answer first, then alternatives if relevant — don't lay out every option and let the user pick.
- **Plan before non-trivial edits.** For anything touching more than ~3 files or any migration, output: (1) files you'll touch, (2) one-sentence rationale per file, (3) what you will explicitly NOT touch. Wait for "go."
- **Audit-before-delete.** For removal/cleanup work, first produce a markdown table classifying each reference as `keep / safe-to-remove / needs-discussion`. Don't delete until the user approves the list.
- **Verification before "done":** run `npm run lint` and (for type-affecting changes) `npx tsc --noEmit`. UI changes need browser verification. RAG/workflow changes need an end-to-end run.
- **Secrets:** never commit `.env`, `.env.local`, or anything matching `*key*`/`*secret*`. `.mcp.json` contains an API key — it's gitignored; keep it that way.

---

## 10. Commands worth knowing

```bash
npm run dev          # Next dev server
npm run build        # production build
npm run lint         # eslint
npx tsc --noEmit     # typecheck (no script wrapper exists)

# RAG verification harness
node scripts/verify-phase-5.mjs

# Cost audit
node scripts/audit-ai-costs.mjs
```

---

## 11. Reference docs in this repo

- `docs/ai-assistant/phase-5-implementation.md` — current phase, status table, do-not-do list
- `docs/ai-assistant/workflow-walkthrough.md` — node-by-node of the three n8n workflows
- `docs/ai-assistant/runbook.md` — deploy / backfill / key-rotation
- `docs/ai-assistant/api-contract.md` — chat + search-documents request/response shapes
- `Report.MD` — repo-level status report

When the user references "the phase doc" or "the runbook," they mean these. Read them before answering questions about the assistant.
