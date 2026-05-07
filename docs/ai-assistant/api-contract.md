# Deal AI Assistant — API Contract

**Status:** Source of truth. Phase 1 mocks and Phase 4 real backend MUST conform.
**Owner:** Phase 1 frontend agent (initial); Phase 4 backend agent maintains parity.

All routes are mounted under `/api/ai/*`. Every request is authenticated via the
caller's Supabase session cookies (mocks accept any caller; Phase 4 enforces).

Errors are returned with the shape:

```ts
{ error: { code: string; message: string } }
```

Common codes:

| Code | HTTP | Meaning |
|---|---|---|
| `unauthorized` | 401 | No / invalid Supabase session |
| `forbidden` | 403 | User not entitled to deal |
| `not_found` | 404 | Conversation / deal id unknown |
| `rate_limited` | 429 | Phase 6 only |
| `service_disabled` | 503 | `ai_assistant_enabled` flag is off |
| `internal` | 500 | Unhandled |

---

## Shared types

```ts
type Role = 'user' | 'assistant' | 'tool' | 'system';

type CitationKind = 'document' | 'tenant' | 'deal_field' | 'computed';

type Citation = {
  id: string;
  kind: CitationKind;
  label: string;                 // human-readable chip text
  document_id?: string;          // when kind === 'document'
  page?: number;                 // when kind === 'document'
  deal_field?: string;           // when kind === 'deal_field'
  tenant_id?: string;            // when kind === 'tenant'
  scenario_id?: string;          // when kind === 'computed'
};

type ToolCall = {
  id: string;
  name: string;                  // e.g. 'compute_scenario', 'search_deal_documents'
  input: Record<string, unknown>;
  status: 'pending' | 'success' | 'error';
};

type Message = {
  id: string;
  role: Role;
  content: string;               // markdown-safe plain text for V1
  citations?: Citation[];
  tool_calls?: ToolCall[];
  created_at: string;            // ISO 8601
};

type Conversation = {
  id: string;
  deal_id: string;
  title: string;
  updated_at: string;            // ISO 8601
};
```

---

## `POST /api/ai/chat`

Send a user message; receive the assistant's reply.

**Request:**

```ts
{
  deal_id: string;
  conversation_id?: string;      // omit for first turn → server creates
  message: string;
}
```

**Response 200:**

```ts
{
  conversation_id: string;
  message: Message;              // role === 'assistant'
}
```

Mock behaviour: 600–1500 ms artificial latency. The mock returns canned
answers keyed off keywords in the user message (e.g. `cap rate`, `tenant`,
`esa`). At least one canned answer attaches a `document` citation so the
drawer can be exercised end-to-end.

---

## `GET /api/ai/conversations?deal_id=<uuid>`

List prior conversations on a deal for the current user, newest first.

**Response 200:**

```ts
{
  conversations: Conversation[];
}
```

Mock: returns 2 sample conversations per known mock deal id; empty array
otherwise.

---

## `GET /api/ai/conversations/[id]`

Fetch the message history for a single conversation.

**Response 200:**

```ts
{
  conversation: Conversation;
  messages: Message[];           // ordered by created_at asc
}
```

---

## `POST /api/ai/feedback`

User rates an assistant message.

**Request:**

```ts
{
  message_id: string;
  rating: -1 | 1;
  reason?: string;
}
```

**Response 200:**

```ts
{ ok: true }
```

---

## Mock toggle

Routes branch on `process.env.AI_USE_MOCK`. When `'1'` they read from
`src/lib/ai/mocks/*` and return canned data. When unset the routes return
`503 service_disabled` for now (Phase 4 swaps the body to proxy n8n).

The mock branch is also active during `next dev` regardless of the flag if
no real backend env is configured — see `src/app/api/ai/_runtime.ts`.

---

## Compatibility rule

If a request or response shape needs to change in any phase, update **this
document and** `src/lib/ai/types.ts` in the **same PR** as the API change.
The UI consumes the typed contract, never the mock module directly.
