import { generateNdaPdfAction } from './actions';
import type { NdaPdfInput } from './nda-pdf';

/**
 * Requests the NDA PDF from the server action and triggers a browser download.
 * Client-only (uses Blob/URL APIs). `NdaPdfInput` is imported as a type so the
 * server-only pdf-lib generator is never bundled into the client.
 */
export async function downloadNdaCopy(input: NdaPdfInput, filename = 'RePrime-NDA.pdf'): Promise<void> {
  const base64 = await generateNdaPdfAction(input);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
