import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { watermarkPDF } from '@/lib/utils/watermark';

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

  const { data: terminalUser } = await supabase
    .from('terminal_users')
    .select('full_name')
    .eq('id', user.id)
    .single();

  if (!terminalUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: doc } = await supabase
    .from('terminal_dd_documents')
    .select('*, deal_id')
    .eq('id', id)
    .single();

  if (!doc || !doc.storage_path) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('terminal-dd-documents')
    .download(doc.storage_path);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }

  await supabase.from('terminal_activity_log').insert({
    user_id: user.id,
    deal_id: doc.deal_id,
    action: 'document_downloaded',
    metadata: { document_name: doc.name, document_id: id },
  });

  let responseBytes: ArrayBuffer;
  const isPDF = doc.file_type === 'application/pdf' || doc.name?.endsWith('.pdf');

  if (isPDF) {
    const pdfBytes = new Uint8Array(await fileData.arrayBuffer());
    const watermarked = await watermarkPDF(pdfBytes, terminalUser.full_name);
    responseBytes = watermarked.buffer as ArrayBuffer;
  } else {
    responseBytes = await fileData.arrayBuffer();
  }

  const viewMode = request.nextUrl.searchParams.get('view') === 'true';
  const disposition = viewMode ? 'inline' : `attachment; filename="${doc.name}"`;

  return new NextResponse(responseBytes, {
    headers: {
      'Content-Type': doc.file_type || 'application/octet-stream',
      'Content-Disposition': disposition,
    },
  });
}
