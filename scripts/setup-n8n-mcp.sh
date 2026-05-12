#!/usr/bin/env bash
# Connect the n8n MCP server to Claude Code.
# Reads N8N_BASE_URL and N8N_API_KEY from .env.local, writes .mcp.json.
# After running this, exit and reopen Claude Code so the new MCP is picked up.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f .env.local ]]; then
  echo "✗ .env.local not found at $REPO_ROOT" >&2
  exit 1
fi

# Pull only the two vars we need (set -a + source would expose everything).
N8N_BASE_URL="$(grep -E '^N8N_BASE_URL=' .env.local | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')"
N8N_API_KEY="$(grep -E '^N8N_API_KEY=' .env.local | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')"

if [[ -z "$N8N_BASE_URL" ]]; then
  echo "✗ N8N_BASE_URL is empty in .env.local" >&2
  exit 1
fi
if [[ -z "$N8N_API_KEY" ]]; then
  echo "✗ N8N_API_KEY is empty in .env.local" >&2
  exit 1
fi

N8N_BASE_URL="${N8N_BASE_URL%/}"
N8N_API_URL="${N8N_BASE_URL}/api/v1"

# Smoke-test before writing config.
echo "→ Testing n8n API at $N8N_API_URL ..."
if ! curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_API_URL/workflows?limit=1" >/dev/null; then
  echo "✗ n8n API did not respond. Check N8N_BASE_URL and N8N_API_KEY in .env.local." >&2
  exit 1
fi
echo "✓ n8n API responded."

# Write .mcp.json (project-scoped MCP config).
cat > .mcp.json <<EOF
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": ["-y", "n8n-mcp"],
      "env": {
        "N8N_API_URL": "$N8N_API_URL",
        "N8N_API_KEY": "$N8N_API_KEY",
        "MCP_MODE": "stdio",
        "LOG_LEVEL": "info"
      }
    }
  }
}
EOF
echo "✓ Wrote .mcp.json"

# Keep secrets out of git.
touch .gitignore
if ! grep -qxF ".mcp.json" .gitignore; then
  echo ".mcp.json" >> .gitignore
  echo "✓ Added .mcp.json to .gitignore"
fi

cat <<'EOF'

Done. Next:
  1. Exit this Claude Code session.
  2. Reopen Claude Code in this repo (`claude`).
  3. The n8n MCP will start automatically. First run downloads the package
     via npx (~30s). Then ask me to list n8n workflows.
EOF
