import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: docs } = await supabase
    .from('terminal_dd_documents')
    .select('id, name, storage_path, file_type, is_verified')
    .eq('deal_id', id)
    .eq('is_verified', true);

  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: 'No verified documents found' }, { status: 404 });
  }

  // For a single-file download fallback, or in production use a ZIP library
  // For now, redirect to a message since ZIP creation requires additional dependencies
  return NextResponse.json({
    message: 'Package download',
    documents: docs.map((d) => ({ name: d.name, id: d.id })),
    download_individually: true,
  });
}
