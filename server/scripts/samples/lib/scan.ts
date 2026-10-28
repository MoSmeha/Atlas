import * as mupdf from 'mupdf';
import { PDFDocument } from 'pdf-lib';

export interface ScanOptions {
  dpi: number;
  /** Degrees the paper sits askew on the scanner glass. */
  skew: number;
}

export interface ImagePdfInfo {
  title: string;
  subject: string;
  issued: Date;
}

/** Renders the first page of a PDF to a greyscale PNG, slightly rotated, as a flatbed scanner would capture it. */
export function scanToPng(pdf: Uint8Array, options: ScanOptions): Uint8Array {
  const document = mupdf.Document.openDocument(pdf, 'application/pdf');
  const page = document.loadPage(0);
  try {
    const matrix = mupdf.Matrix.concat(mupdf.Matrix.rotate(options.skew), mupdf.Matrix.scale(options.dpi / 72, options.dpi / 72));
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceGray, false);
    pixmap.setResolution(options.dpi, options.dpi);
    const png = pixmap.asPNG();
    pixmap.destroy();
    return png;
  } finally {
    page.destroy();
    document.destroy();
  }
}

/** An A4 PDF whose only content is the image: no text layer, as a scanned document has. */
export async function imageOnlyPdf(png: Uint8Array, info: ImagePdfInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const image = await doc.embedPng(png);
  const page = doc.addPage([595.28, 841.89]);
  const scale = Math.min(page.getWidth() / image.width, page.getHeight() / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, { x: (page.getWidth() - width) / 2, y: (page.getHeight() - height) / 2, width, height });
  doc.setTitle(info.title);
  doc.setSubject(info.subject);
  doc.setAuthor('Atlas sample generator');
  doc.setCreator('Atlas sample generator');
  doc.setProducer('pdf-lib');
  doc.setKeywords(['fictional', 'sample', 'Atlas', 'scanned']);
  doc.setCreationDate(info.issued);
  doc.setModificationDate(info.issued);
  return doc.save();
}
