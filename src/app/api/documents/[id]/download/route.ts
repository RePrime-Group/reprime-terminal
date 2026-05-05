import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { watermarkPDF } from '@/lib/utils/watermark';
import { getInvestorAuth, permissionDenied } from '@/lib/auth/requireInvestor';

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

  const authResult = await getInvestorAuth();
  if (!authResult.ok) return authResult.response;
  const denied = permissionDenied(authResult.user, 'download_documents');
  if (denied) return denied;
  const user = { id: authResult.user.userId };
  const terminalUser = { full_name: authResult.user.fullName ?? '' };

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

  // display_name is what admins see after rename; falls back to storage name
  // for legacy rows backfilled pre-rename feature.
  const downloadName: string = doc.display_name ?? doc.name;

  // bulk=1 is set by the client-side ZIP packager so the bundle gets a single
  // summary activity row instead of N per-file rows.
  const isBulk = request.nextUrl.searchParams.get('bulk') === '1';
  if (!isBulk) {
    await supabase.from('terminal_activity_log').insert({
      user_id: user.id,
      deal_id: doc.deal_id,
      action: 'document_downloaded',
      metadata: { document_name: downloadName, document_id: id },
    });
  }

  let responseBytes: ArrayBuffer;
  const isPDF = doc.file_type === 'application/pdf' || doc.name?.endsWith('.pdf');

  if (isPDF) {
    const pdfBytes = new Uint8Array(await fileData.arrayBuffer());
    try {
      const watermarked = await watermarkPDF(pdfBytes, terminalUser.full_name);
      responseBytes = watermarked.buffer as ArrayBuffer;
    } catch (err) {
      // Fall back to the un-watermarked original instead of failing the
      // download. Most failures here are user-password-protected PDFs that
      // pdf-lib genuinely can't open — serving the file beats serving an
      // error and breaking the bulk-download retry pass. Activity log still
      // captures that this user pulled this document.
      console.warn(
        `[download] watermark failed for doc ${id}, serving original:`,
        err instanceof Error ? err.message : err,
      );
      responseBytes = pdfBytes.buffer as ArrayBuffer;
    }
  } else {
    responseBytes = await fileData.arrayBuffer();
  }

  // Content-Disposition needs two filename forms to work across browsers:
  //   1. filename="..."     — ASCII-only fallback for old clients
  //   2. filename*=UTF-8''… — RFC 5987, used by modern browsers for non-ASCII
  // Without both, names with accents / ampersands / spaces sometimes downgrade
  // to "download" (Chrome + Safari). We also always attach a filename — even
  // for inline/view-mode — so that the browser's built-in PDF viewer has a
  // name to use if the user then clicks "download" from it.
  const asciiSafe = downloadName
    .replace(/[\r\n"\\]/g, '_')          // header-breaking chars
    .replace(/[^\x20-\x7E]/g, '_');       // fall back to "_" for non-ASCII
  const rfc5987 = encodeURIComponent(downloadName)
    .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, '%2A');

  const viewMode = request.nextUrl.searchParams.get('view') === 'true';
  const dispositionType = viewMode ? 'inline' : 'attachment';
  const disposition = `${dispositionType}; filename="${asciiSafe}"; filename*=UTF-8''${rfc5987}`;

  return new NextResponse(responseBytes, {
    headers: {
      'Content-Type': doc.file_type || 'application/octet-stream',
      'Content-Disposition': disposition,
    },
  });
}
