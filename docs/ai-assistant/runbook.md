# AI Assistant — Operations Runbook

## Deploy steps

### Phase 2 (healthcheck)

1. Set env vars in Vercel dashboard (all values from `.env.example`):
   - `N8N_BASE_URL`
   - `N8N_WEBHOOK_PATH_HEALTHCHECK`
   - `NEXT_PUBLIC_AI_ASSISTANT_ENABLED=0` (keep off until Phase 6 GA flip)

2. Import `n8n/workflows/_healthcheck.json` into n8n:
   - n8n UI → Workflows → Import from file → select `_healthcheck.json`
   - Activate the workflow.
   - Set n8n credentials: `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the n8n credential vault.

3. Smoke-test the healthcheck end-to-end:

   The route reads the Supabase cookie session server-side — test it from a logged-in browser session, not curl.

   **Browser test (easiest):**
   - Open the portal, log in, then open DevTools → Console and run:
   ```js
   fetch('/api/ai/healthcheck', { method: 'POST' }).then(r => r.json()).then(console.log)
   // Expected: { user_id: "<uuid>", ok: true }
   ```

   **Logged-out test:**
   - Open an incognito window (not logged in) and run the same fetch.
   - Expected: `{ error: { code: "unauthorized", ... } }` with status 401.

### Phase 4+ (chat)

After Phase 4 n8n workflows are deployed:

1. Add remaining env vars to Vercel:
   - `N8N_WEBHOOK_PATH_CHAT` (`/webhook/deal-assistant`)
   - `N8N_WEBHOOK_PATH_HISTORY` (`/webhook/deal-assistant/conversations` — currently unused; history is served from Supabase directly)
   - `N8N_WEBHOOK_PATH_FEEDBACK` (`/webhook/deal-assistant/feedback`)
   - `N8N_INTERNAL_TOKEN` (generate with `openssl rand -hex 32`)
   - `ANTHROPIC_API_KEY` (server-side; used by `/api/ai/chat` for the Haiku title-generation hop on first turns)

2. Import workflow JSONs from `n8n/workflows/` into n8n and activate each:
   - `deal-assistant-chat.json` — main chat agent (active)
   - `deal-assistant-feedback.json` — thumbs up/down insert (active)
   - `deal-assistant-custom-tools.json` — `compute_scenario` tool dispatcher (active)
   - `deal-assistant-history.json` — **kept as reference, do not activate**. Conversation/message reads now go directly from `/api/ai/conversations*` to Supabase.

3. Add to n8n credential vault (never in `.env`):
   - `ANTHROPIC_API_KEY` (used by the Claude Sonnet 4.6 model node in `deal-assistant-chat`)
   - `Reprime Terminal` Supabase credential (used by every `supabase` node)

4. Add to n8n **environment variables** (Railway container env, not the credential vault):
   - `N8N_INTERNAL_TOKEN` — must equal the same value as the Vercel env var. Used by the `Call Compute API` HTTP node in `deal-assistant-custom-tools` to authenticate to `/api/ai/compute-scenario`.

### Workflow IDs (production n8n)

| Workflow | ID | State |
|---|---|---|
| deal-assistant-chat | `6hz22YdBC500tHxg` | active |
| deal-assistant-custom-tools | `1ybPNg49pk19oXJp` | active |
| deal-assistant-feedback | `UoHyEwhIXK8qKpUJ` | active |
| deal-assistant-history | `AJf9c3Lz53zHVMon` | **inactive — superseded** |
| Reprime Terminal - AI Assistant | `52uI7cIIIIpOGS0U` | inactive — **prototype reference, do not modify** |

### Settings to verify on `deal-assistant-chat`

- AI Agent node: `maxIterations: 5`, `returnIntermediateSteps: true`
- Workflow `executionTimeout: 60` (seconds)
- AI Agent `systemMessage` is byte-identical to `src/lib/ai/prompts/system.static.ts` + `system.dynamic.ts` template — see "Prompt caching" below.

### Prompt caching

The system prompt is split into a static prefix (`src/lib/ai/prompts/system.static.ts`) and a dynamic suffix (`src/lib/ai/prompts/system.dynamic.ts`) that contains only deal-scoped values. The n8n AI Agent node concatenates them in that order so Anthropic's prompt cache hits on the unchanging prefix.

**Caveat — caching is not yet active in production.** The prompt structure is verified cache-ready at the API layer (~1,200 token static block, full hit on second call), but the n8n `lmChatAnthropic` node does not currently set `cache_control` on the system message. To capture the savings:

1. Either upgrade to a langchain-Anthropic version that exposes `cache_control` on the system block, or
2. Replace the langchain agent with a direct HTTP call to `/v1/messages` that explicitly sets `cache_control: { type: "ephemeral" }` on the static prefix.

When updating the prompt, update **all three** in lockstep: `system.static.ts`, `n8n/deal-assistant-prompt.md`, and the AI Agent node's `systemMessage` field.

### compute-scenario internal route

`/api/ai/compute-scenario` is an **internal** route called only by n8n's `Call Compute API` HTTP node. It is gated by `x-internal-token: $N8N_INTERNAL_TOKEN` and runs the canonical `calculateDeal()` engine from `src/lib/utils/deal-calculator.ts` (no duplicated math). Body: `{ deal_id, scenario_type?, assumptions? }`. Auth flow: investor → Vercel `/api/ai/chat` → n8n agent → tool dispatcher → Vercel `/api/ai/compute-scenario` → engine → back up the chain.

---

## Kill switch

Disable the entire AI assistant immediately without a deploy:

1. Set `NEXT_PUBLIC_AI_ASSISTANT_ENABLED=0` in the Vercel environment variables.
2. Trigger a Vercel redeploy (or use the instant env-var override if on Vercel's edge config).

All `/api/ai/*` routes return `503 service_disabled` while the flag is off. The n8n workflows continue running but Vercel refuses to forward requests.

Per-user override (future): set a `ai_disabled` flag on `terminal_users.metadata` for a specific user; check in `_runtime.ts` before forwarding.

---

## Key rotation

### Anthropic API key

1. Generate a new key in the Anthropic console.
2. Update the credential in n8n vault (Credentials → `ANTHROPIC_API_KEY` → Edit).
3. Activate. The old key can be revoked immediately after a successful test call.
4. No Vercel redeploy needed (key lives only in n8n).

### Voyage API key

Same procedure as Anthropic — vault only, no Vercel touch.

### N8N_INTERNAL_TOKEN

1. Generate: `openssl rand -hex 32`
2. Update in both Vercel env vars and n8n vault simultaneously (n8n calls Vercel with this token).
3. Redeploy Vercel to pick up the new value.

### Supabase anon key

1. Rotate in Supabase dashboard (Project Settings → API).
2. Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel and `SUPABASE_ANON_KEY` in n8n vault.
3. Redeploy Vercel.

---

## RLS audit findings (Phase 2)

Audited: `terminal_deals`, `tenant_leases` (rent roll), `terminal_dd_documents` (deal documents).

**Result: CLEAN.**

- All three tables have RLS enabled.
- Every policy uses the `terminal_user_role()` SECURITY DEFINER helper — no direct `terminal_users` joins that could be bypassed.
- No `USING (true)` on any AI-relevant table.
- Investor access to deals is gated on `status IN ('published', 'assigned', 'closed')` on `terminal_deals`, and the same subquery pattern propagates to related tables.
- `USING (true)` policies exist only on `terminal_invite_tokens` (public token validation) and `terminal_settings` (non-sensitive config) — both intentional and unrelated to AI data paths.

Note: The spec references `terminal_tenant_rent_roll` and `terminal_deal_documents` by name, but the actual tables are `tenant_leases` and `terminal_dd_documents`. The Phase 4 MCP whitelist must use the real table names.

---

## Supabase type regeneration

Run after any schema migration:

```bash
npx supabase gen types typescript --project-id <project-id> --schema public > src/types/supabase.ts
```

Check `package.json` for a `db:types` script; if absent, add it.
