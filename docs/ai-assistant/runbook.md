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
   - `N8N_WEBHOOK_PATH_CHAT`
   - `N8N_WEBHOOK_PATH_HISTORY`
   - `N8N_WEBHOOK_PATH_FEEDBACK`
   - `N8N_INTERNAL_TOKEN` (generate with `openssl rand -hex 32`)

2. Import workflow JSONs from `n8n/workflows/` into n8n and activate each.

3. Add to n8n credential vault (never in `.env`):
   - `ANTHROPIC_API_KEY`
   - `VOYAGE_API_KEY`
   - `N8N_INTERNAL_TOKEN` (mirrors the Vercel env var for the compute-scenario callback)

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
