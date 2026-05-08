// Ambient type declarations for the .jsx Seller Brief component so .tsx
// callers (the brief page, the API route's prompt builder import) get
// real types instead of an inferred `any`/`never[]`.

import type { ComponentType } from 'react';

export interface SellerBriefPromptResult {
  system: string;
  user: string;
}

export function buildSellerBriefPrompt(
  deal: Record<string, unknown>,
  tenants: Record<string, unknown>[],
  capexItems: Record<string, unknown>[],
  addresses?: Record<string, unknown>[],
): SellerBriefPromptResult;

export interface SellerBriefProps {
  deal: Record<string, unknown> | null;
  tenants?: Record<string, unknown>[];
  capexItems?: Record<string, unknown>[];
  addresses?: Record<string, unknown>[];
  aiTalkingPoints?: Record<string, unknown> | string | null;
}

declare const SellerBrief: ComponentType<SellerBriefProps>;
export default SellerBrief;
