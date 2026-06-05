import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib';
import { NDA_TITLE, NDA_DISCLOSING_PARTY, getNDABody } from './nda-text';

export interface NdaPdfInput {
  date: string;
  receivingPartyName: string;
  receivingPartyCompany?: string;
  receivingPartyTitle?: string;
  /** Optional drawn signature as a PNG data URL; embedded in the signature block. */
  signatureDataUrl?: string;
  /** When true, adds the executed-copy electronic-signature notice. */
  signed?: boolean;
}

// StandardFonts only encode WinAnsi — map the few non-ASCII chars our text may
// contain down to safe equivalents so drawText never throws.
function clean(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ');
}

/**
 * Renders the RePrime NDA (body from getNDABody + signature block) to a PDF.
 * Used for the "Download a copy" button and the signed-copy email attachment.
 */
export async function generateNdaPdf(input: NdaPdfInput): Promise<Uint8Array> {
  const { date, receivingPartyName, receivingPartyCompany, receivingPartyTitle, signatureDataUrl, signed } = input;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  let sigImage: PDFImage | null = null;
  if (signatureDataUrl && signatureDataUrl.startsWith('data:image/png')) {
    try {
      sigImage = await pdf.embedPng(Buffer.from(signatureDataUrl.split(',')[1] ?? '', 'base64'));
    } catch {
      sigImage = null;
    }
  }

  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 64;
  const MAX_W = PAGE_W - MARGIN * 2;
  const navy = rgb(0.055, 0.205, 0.439);
  const gray = rgb(0.29, 0.33, 0.39);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const wrap = (text: string, f: PDFFont, size: number): string[] => {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (line && f.widthOfTextAtSize(test, size) > MAX_W) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const drawParagraph = (
    text: string,
    opts: { f?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gapAfter?: number; align?: 'left' | 'center' } = {},
  ) => {
    const { f = font, size = 10.5, color = gray, gapAfter = 9, align = 'left' } = opts;
    const lineHeight = size + 3;
    for (const ln of wrap(clean(text), f, size)) {
      ensure(lineHeight);
      const x = align === 'center' ? (PAGE_W - f.widthOfTextAtSize(ln, size)) / 2 : MARGIN;
      page.drawText(ln, { x, y: y - size, size, font: f, color });
      y -= lineHeight;
    }
    y -= gapAfter;
  };

  // Title
  drawParagraph(NDA_TITLE, { f: bold, size: 14, color: navy, gapAfter: 16, align: 'center' });

  // Body — collapse single newlines inside a paragraph to spaces
  const body = getNDABody({ date, receivingPartyName: receivingPartyName || undefined });
  for (const para of body.split(/\n\n+/)) {
    drawParagraph(para.replace(/\n/g, ' '), { size: 10.5, gapAfter: 9 });
  }

  // Signature block (two columns)
  ensure(130);
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.75, color: rgb(0.9, 0.9, 0.92) });
  y -= 22;
  const topY = y;
  const colW = MAX_W / 2;

  const drawSigColumn = (
    x: number,
    heading: string,
    rows: Array<{ t: string; f?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number }>,
  ) => {
    let cy = topY;
    page.drawText(heading.toUpperCase(), { x, y: cy, size: 8, font: bold, color: rgb(0.61, 0.64, 0.69) });
    cy -= 18;
    for (const r of rows) {
      page.drawText(clean(r.t), { x, y: cy, size: r.size ?? 11, font: r.f ?? font, color: r.color ?? gray });
      cy -= r.gap ?? 16;
    }
  };

  drawSigColumn(MARGIN, 'Disclosing Party', [
    { t: NDA_DISCLOSING_PARTY.entity, f: bold, size: 11, color: navy },
    { t: NDA_DISCLOSING_PARTY.signerName, f: italic, size: 15, color: navy, gap: 22 },
    { t: NDA_DISCLOSING_PARTY.signerTitle, size: 10 },
    { t: date, size: 10, gap: 14 },
    { t: 'Pre-executed by an authorized officer.', f: italic, size: 8, color: rgb(0.61, 0.64, 0.69) },
  ]);

  // Receiving Party — drawn signature image if provided, else the typed name.
  const rpX = MARGIN + colW + 12;
  let rcy = topY;
  page.drawText('RECEIVING PARTY', { x: rpX, y: rcy, size: 8, font: bold, color: rgb(0.61, 0.64, 0.69) });
  rcy -= 18;
  if (sigImage) {
    const scale = Math.min((colW - 6) / sigImage.width, 34 / sigImage.height);
    const w = sigImage.width * scale;
    const h = sigImage.height * scale;
    page.drawImage(sigImage, { x: rpX, y: rcy - h, width: w, height: h });
    rcy -= h + 6;
    if (receivingPartyName) {
      page.drawText(clean(receivingPartyName), { x: rpX, y: rcy, size: 9, font, color: gray });
      rcy -= 16;
    }
  } else {
    page.drawText(clean(receivingPartyName || '________________'), { x: rpX, y: rcy, size: 15, font: italic, color: navy });
    rcy -= 22;
  }
  page.drawText(clean(receivingPartyCompany?.trim() || '-'), { x: rpX, y: rcy, size: 10, font, color: gray });
  rcy -= 16;
  if (receivingPartyTitle?.trim()) {
    page.drawText(clean(receivingPartyTitle.trim()), { x: rpX, y: rcy, size: 10, font, color: gray });
    rcy -= 16;
  }
  page.drawText(clean(date), { x: rpX, y: rcy, size: 10, font, color: gray });

  y = topY - 96;

  if (signed) {
    drawParagraph(
      `Signed electronically by ${receivingPartyName} on ${date} in accordance with the U.S. E-Sign Act (15 U.S.C. Section 7001).`,
      { f: italic, size: 9, color: gray, gapAfter: 0 },
    );
  }

  return pdf.save();
}
