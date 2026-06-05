'use server';

import { generateNdaPdf, type NdaPdfInput } from './nda-pdf';

/**
 * Generates the NDA PDF and returns it base64-encoded so the client can
 * download it. Used by the "Download a copy" button on the NDA flows.
 */
export async function generateNdaPdfAction(input: NdaPdfInput): Promise<string> {
  const bytes = await generateNdaPdf(input);
  return Buffer.from(bytes).toString('base64');
}
