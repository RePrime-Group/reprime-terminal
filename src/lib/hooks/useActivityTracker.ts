'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ActivityAction } from '@/lib/types/database';

export function useActivityTracker() {
  const trackActivity = useCallback(
    async (
      action: ActivityAction,
      dealId?: string,
      metadata?: Record<string, unknown>
    ) => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      await supabase.from('terminal_activity_log').insert({
        user_id: user.id,
        deal_id: dealId || null,
        action,
        metadata: metadata || {},
      });
    },
    []
  );

  return { trackActivity };
}
