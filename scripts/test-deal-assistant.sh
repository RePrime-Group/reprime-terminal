#!/usr/bin/env bash
# End-to-end smoke test for the Deal AI Assistant n8n workflows.
#
# Hits all three user-facing webhooks with one investor and one deal:
#   1. POST /webhook/deal-assistant                    (chat — first turn)
#   2. POST /webhook/deal-assistant                    (chat — follow-up, memory)
#   3. POST /webhook/deal-assistant/conversations      (history — list)
#   4. POST /webhook/deal-assistant/conversations      (history — messages)
#
# USER_ID / DEAL_ID auto-discover from Supabase if not provided.
# Required env (read from .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, N8N_BASE_URL.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  while IFS= read -r line; do
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*=.*$ ]] && eval "$line" 2>/dev/null || true
  done < "$ENV_FILE"
  set +a
fi

N8N_BASE="${N8N_BASE_URL:-https://primary-production-9ee0c.up.railway.app}"
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:?missing in .env.local}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?missing in .env.local}"

bold()  { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*"; }
hr()    { printf "\n\033[90m%s\033[0m\n" "════════════════════════════════════════════════════════════"; }

# Discover IDs ───────────────────────────────────────────────────────────
if [[ -z "${DEAL_ID:-}" ]]; then
  bold "→ Discovering a published deal…"
  DEAL_ID=$(curl -fsS "${SUPABASE_URL}/rest/v1/terminal_deals?select=id,name,status&status=in.(coming_soon,loi_signed,published,assigned,closed)&limit=1" \
    -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" \
    | jq -r '.[0].id // empty')
  [[ -z "$DEAL_ID" ]] && { red "No accessible deal found."; exit 1; }
fi

if [[ -z "${USER_ID:-}" ]]; then
  bold "→ Discovering an investor user…"
  USER_ID=$(curl -fsS "${SUPABASE_URL}/rest/v1/terminal_users?select=id,email,role&role=eq.investor&limit=1" \
    -H "apikey: ${SERVICE_KEY}" -H "Authorization: Bearer ${SERVICE_KEY}" \
    | jq -r '.[0].id // empty')
  [[ -z "$USER_ID" ]] && { red "No investor user found."; exit 1; }
fi

green "user_id = $USER_ID"
green "deal_id = $DEAL_ID"

post() {
  local path="$1" body="$2"
  curl -fsS -X POST "${N8N_BASE}${path}" \
    -H "Content-Type: application/json" \
    -d "$body"
}

# 1. Chat — first turn ───────────────────────────────────────────────────
hr
bold "TEST 1 — chat (new conversation)"
RESP1=$(post "/webhook/deal-assistant" "$(jq -nc \
  --arg u "$USER_ID" --arg d "$DEAL_ID" \
  '{user_id:$u, deal_id:$d, message:"Give me a 3-bullet overview of this deal: location, size, and current status."}')")
echo "$RESP1" | jq .
CONV_ID=$(echo "$RESP1" | jq -r '.conversation_id // empty')
[[ -z "$CONV_ID" ]] && { red "✗ no conversation_id returned"; exit 1; }
green "✓ conversation_id = $CONV_ID"

# 2. Chat — follow-up (memory + tool chaining) ───────────────────────────
hr
bold "TEST 2 — chat (follow-up, exercises memory + Get Tenants tool)"
RESP2=$(post "/webhook/deal-assistant" "$(jq -nc \
  --arg u "$USER_ID" --arg d "$DEAL_ID" --arg c "$CONV_ID" \
  '{user_id:$u, deal_id:$d, conversation_id:$c, message:"Who are the top 3 tenants by square footage?"}')")
echo "$RESP2" | jq .

# 3. History — list conversations ────────────────────────────────────────
hr
bold "TEST 3 — history list (mode=list)"
post "/webhook/deal-assistant/conversations" "$(jq -nc \
  --arg u "$USER_ID" --arg d "$DEAL_ID" \
  '{user_id:$u, deal_id:$d, mode:"list"}')" | jq .

# 4. History — messages in this conversation ─────────────────────────────
hr
bold "TEST 4 — history messages (mode=messages)"
MSGS=$(post "/webhook/deal-assistant/conversations" "$(jq -nc \
  --arg u "$USER_ID" --arg c "$CONV_ID" \
  '{user_id:$u, conversation_id:$c, mode:"messages"}')")
echo "$MSGS" | jq .

hr
green "ALL TESTS DISPATCHED. Verify each block above returned a JSON body without an \"error\" field."
