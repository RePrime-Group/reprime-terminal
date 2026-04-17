import { PDFDocument, rgb, degrees } from 'pdf-lib';

export async function watermarkPDF(
  pdfBytes: Uint8Array,
  investorName: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
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
