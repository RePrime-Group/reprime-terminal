import { type FeeDefaults } from '@/lib/utils/fee-resolver';
import type {
  DealWithDetails,
  TerminalAvailabilitySlot,
  TerminalTenantLease,
  CapExItem,
  ExitScenario,
  DealInsight,
} from '@/lib/types/database';

export interface DealDetailClientProps {
  deal: DealWithDetails;
  photoUrls: string[];
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  availabilitySlots: TerminalAvailabilitySlot[];
  bookedTimes: string[];
  locale: string;
  pipelineProgress?: number;
  stageProgress?: Record<string, { total: number; completed: number }>;
  currentStage?: string;
  hasSignedNDA?: boolean;
  investorName?: string;
  investorEmail?: string;
  addresses?: { id: string; label: string; address: string | null; city: string | null; state: string | null; square_footage: string | null; units: string | null; om_storage_path: string | null }[];
  pipelineTasks?: { id: string; name: string; status: string; stage: string }[];
  tenants?: TerminalTenantLease[];
  capexItems?: CapExItem[];
  exitScenarios?: ExitScenario[];
  insights?: DealInsight[];
  prevDeal?: { id: string; name: string } | null;
  nextDeal?: { id: string; name: string } | null;
  /** Source list (?from=…) so prev/next links stay scoped to the origin page. */
  navContext?: string | null;
  userNote?: { content: string; updated_at: string } | null;
  /**
   * When true the view renders exactly as an investor sees it, but every write
   * action is short-circuited. Used by the /admin/preview routes so admins can
   * audit the investor experience without creating rows under their own id.
   */
  previewMode?: boolean;
  globalFeeDefaults?: FeeDefaults;
  resolvedDealFees?: FeeDefaults;
  resolvedInvestorTerms?: FeeDefaults;
  /** Marketplace deals only — count of investors who have expressed interest. */
  marketplaceInterestCount?: number;
  /** Current investor's existing marketplace interest row, if any. */
  myMarketplaceInterest?: {
    interest_type: 'at_asking' | 'custom_price';
    target_price: number | null;
    notes: string | null;
  } | null;
}

export type TabKey =
  | 'overview'
  | 'due-diligence'
  | 'photos'
  | 'rent-roll'
  | 'financial-modeling'
  | 'deal-structure'
  | 'capex'
  | 'exit-strategy'
  | 'insights'
  | 'schedule'
  | 'assistant';

export type CalculatorMode = 'assignment' | 'gplp' | 'custom';
