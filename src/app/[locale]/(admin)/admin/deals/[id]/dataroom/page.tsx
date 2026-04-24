'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import DataRoomClient from './_components/DataRoomClient';

// Thin client shell. All data room UI lives in _components/DataRoomClient.tsx.
// We fetch only the deal name here for the breadcrumb-style subnav header; the
// hierarchical folder/document data is loaded inside the client via useDataRoom.
export default function DataRoomPage() {
  const params = useParams();
  const dealId = params.id as string;
  const locale = (params.locale as string) ?? 'en';

  const [dealName, setDealName] = useState('');

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('terminal_deals')
      .select('name')
      .eq('id', dealId)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setDealName(data.name as string);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  return <DataRoomClient dealId={dealId} dealName={dealName} locale={locale} />;
}
