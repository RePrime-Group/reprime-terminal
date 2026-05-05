import { PDFDocument, rgb, degrees } from 'pdf-lib';

export async function watermarkPDF(
  pdfBytes: Uint8Array,
  investorName: string
): Promise<Uint8Array> {
  // ignoreEncryption: true handles the common "owner-password but no actual
  // restrictions" case — title-company exports, bank statements, DocuSign
  // PDFs all ship with the encryption flag set even though the user can open
  // them freely. Without this, pdf-lib refuses to load them at all. PDFs with
  // genuine user-password protection still throw and are caught upstream by
  // the download route, which falls back to serving the original bytes.
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const timestamp = new Date().toISOString();
  const watermarkText = `${investorName} · ${timestamp} · RePrime Terminal Beta — Confidential`;

  for (const page of pages) {
    const { width, height } = page.getSize();
    page.drawText(watermarkText, {
      x: width / 2 - 200,
      y: height / 2,
      size: 8,
      color: rgb(0.85, 0.85, 0.85),
      rotate: degrees(45),
      opacity: 0.3,
    });
  }

  return pdfDoc.save();
}
