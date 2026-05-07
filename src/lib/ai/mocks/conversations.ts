import type { Conversation, Message } from '../types';

const DEAL_A = 'mock-deal-dubois';
const DEAL_B = 'mock-deal-springfield';

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'mock-conv-1',
    deal_id: DEAL_A,
    title: 'Rent roll & tenant concentration',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: 'mock-conv-2',
    deal_id: DEAL_A,
    title: 'IRR sensitivity to exit cap',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: 'mock-conv-3',
    deal_id: DEAL_B,
    title: 'Phase I ESA — contamination findings',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
  'mock-conv-1': [
    {
      id: 'm1-1',
      role: 'user',
      content: 'Summarize the rent roll and tenant concentration.',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 4 - 60000).toISOString(),
    },
    {
      id: 'm1-2',
      role: 'assistant',
      content:
        'Eight tenants generate $58,400 in monthly base rent. Anchor Co. accounts for 31% of total rent ($14,500/mo) — concentration is moderate. WALT is 4.2 years; the next major rollover is 2027.',
      citations: [
        {
          id: 'cit-1',
          kind: 'tenant',
          label: 'Anchor Co.',
          tenant_id: 'tenant-anchor',
        },
        {
          id: 'cit-2',
          kind: 'deal_field',
          label: 'Rent Roll',
          deal_field: 'rent_roll',
        },
      ],
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    },
    {
      id: 'm1-3',
      role: 'user',
      content: 'Which leases expire before year 5?',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
    {
      id: 'm1-4',
      role: 'assistant',
      content:
        'Three leases expire before May 2031: Bright Cleaners (Aug 2027, 8% of NOI), Coastal Imports (Mar 2029, 14%), and Anchor Co. (Jun 2029, 31%). Combined, they represent 53% of NOI — worth modeling renewal scenarios.',
      citations: [
        {
          id: 'cit-3',
          kind: 'tenant',
          label: 'Anchor Co.',
          tenant_id: 'tenant-anchor',
        },
      ],
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3 + 5000).toISOString(),
    },
  ],
  'mock-conv-2': [
    {
      id: 'm2-1',
      role: 'user',
      content: "What's the IRR if the exit cap rises to 9%?",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 49).toISOString(),
    },
    {
      id: 'm2-2',
      role: 'assistant',
      content:
        'At a 9.0% exit cap (vs. 7.5% base), levered IRR drops from 18.6% to 11.2% over a 5-year hold. Equity multiple compresses from 2.1× to 1.6×. The deal still clears the 10% IRR threshold but the margin is thin.',
      citations: [
        {
          id: 'cit-4',
          kind: 'computed',
          label: 'Scenario · exit_cap=9%',
          scenario_id: 'scn-exit-9',
        },
      ],
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 49 + 4000).toISOString(),
    },
  ],
  'mock-conv-3': [
    {
      id: 'm3-1',
      role: 'user',
      content: 'What does the Phase I ESA say about contamination?',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(),
    },
    {
      id: 'm3-2',
      role: 'assistant',
      content:
        'The Phase I ESA flags one Recognized Environmental Condition: a former dry-cleaning operation on the southwest parcel from 1972–1989 (page 14). Soil testing in 2018 found PCE at 0.6× the residential screening level — below action thresholds but above background. The report recommends a Phase II at the slab.',
      citations: [
        {
          id: 'cit-5',
          kind: 'document',
          label: 'Phase I ESA · p.14',
          document_id: 'mock-doc-esa',
          page: 14,
        },
      ],
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 25 + 6000).toISOString(),
    },
  ],
};

export function listForDeal(dealId: string): Conversation[] {
  return MOCK_CONVERSATIONS.filter((c) => c.deal_id === dealId).sort((a, b) =>
    a.updated_at < b.updated_at ? 1 : -1,
  );
}

export function getById(id: string): { conversation: Conversation; messages: Message[] } | null {
  const conversation = MOCK_CONVERSATIONS.find((c) => c.id === id);
  if (!conversation) return null;
  return { conversation, messages: MOCK_MESSAGES[id] ?? [] };
}
