'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TerminalUser } from '@/lib/types/database';

export function useUser() {
  const [user, setUser] = useState<TerminalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('terminal_users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      setUser(data as TerminalUser | null);
      setLoading(false);
    }

    fetchUser();
  }, []);

  return { user, loading };
}
