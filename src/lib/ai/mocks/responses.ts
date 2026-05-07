import type { Citation, Message } from '../types';

interface CannedAnswer {
  match: RegExp;
  content: string;
  citations?: Citation[];
}

const CANNED: CannedAnswer[] = [
  {
    match: /cap rate|caprate/i,
    content:
      "The going-in cap rate is 9.66% based on the in-place NOI of $580,000 against a $6.0M purchase price. That's roughly 90 bps above comparable industrial trades in the submarket.",
    citations: [
      { id: 'c-cap', kind: 'deal_field', label: 'Cap Rate', deal_field: 'cap_rate' },
    ],
  },
  {
    match: /tenant|rent roll|walt/i,
    content:
      'Eight tenants, $58,400 monthly base rent, WALT 4.2 years. Anchor Co. is 31% of rent — concentration is moderate. Next major rollover lands in 2027.',
    citations: [
      { id: 'c-tenant', kind: 'tenant', label: 'Anchor Co.', tenant_id: 'tenant-anchor' },
    ],
  },
  {
    match: /esa|environmental|contamination/i,
    content:
      'Phase I ESA notes one Recognized Environmental Condition: a 1972–1989 dry-cleaning operation on the southwest parcel (page 14). Soil testing in 2018 found PCE at 0.6× the residential screening level. Recommends a Phase II at the slab.',
    citations: [
      {
        id: 'c-esa',
        kind: 'document',
        label: 'Phase I ESA · p.14',
        document_id: 'mock-doc-esa',
        page: 14,
      },
    ],
  },
  {
    match: /irr|return|exit cap/i,
    content:
      'Base case levered IRR is 18.6% over a 5-year hold. At a 9% exit cap the IRR drops to 11.2% with equity multiple of 1.6×. Sensitivity is meaningful — the deal clears 10% but margin is thin.',
    citations: [
      {
        id: 'c-irr',
        kind: 'computed',
        label: 'Scenario · exit_cap=9%',
        scenario_id: 'scn-exit-9',
      },
    ],
  },
  {
    match: /finance|debt|loan|leverage/i,
    content:
      'The deal carries 65% LTV senior debt at 6.85% on a 10-year term, 30-year amortization. DSCR pencils to 1.42× on year-one NOI.',
    citations: [
      { id: 'c-fin', kind: 'deal_field', label: 'Financing', deal_field: 'financing' },
    ],
  },
];

const FALLBACK: CannedAnswer = {
  match: /.*/,
  content:
    'Once the live backend is connected I can answer questions about this deal — its tenants, financials, and dataroom documents. For now this is a mocked response so the UI can be exercised end-to-end.',
  citations: [
    {
      id: 'c-fallback',
      kind: 'document',
      label: 'Sample Document · p.1',
      document_id: 'mock-doc-esa',
      page: 1,
    },
  ],
};

export function answerFor(message: string): { content: string; citations: Citation[] } {
  const hit = CANNED.find((c) => c.match.test(message));
  const chosen = hit ?? FALLBACK;
  return { content: chosen.content, citations: chosen.citations ?? [] };
}

export function buildAssistantMessage(userMessage: string): Message {
  const { content, citations } = answerFor(userMessage);
  return {
    id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    content,
    citations,
    created_at: new Date().toISOString(),
  };
}

export function buildUserMessage(userMessage: string): Message {
  return {
    id: `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'user',
    content: userMessage,
    created_at: new Date().toISOString(),
  };
}

export function delay(min = 600, max = 1500): Promise<void> {
  const ms = min + Math.floor(Math.random() * (max - min));
  return new Promise((resolve) => setTimeout(resolve, ms));
}
