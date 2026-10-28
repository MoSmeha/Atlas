import { writeFileSync } from 'node:fs';
import * as mupdf from 'mupdf';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/** Text drawn at x points from the left, with its baseline y points from the top. */
export interface TextItem {
  text: string;
  x: number;
  y: number;
  size?: number;
}

export interface FixturePage {
  items: TextItem[];
  /** Width and height in points; A4 portrait when left out. */
  size?: [number, number];
}

const A4: [number, number] = [595, 842];

/** A PDF made with pdf-lib in Helvetica, one entry per page; a page with no items is blank. */
export async function textPdf(pages: FixturePage[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const { items, size = A4 } of pages) {
    const page = pdf.addPage(size);
    for (const { text, x, y, size: fontSize = 11 } of items) page.drawText(text, { x, y: size[1] - y, size: fontSize, font });
  }
  return pdf.save({ addDefaultPage: false });
}

/** Lines of text 16 points apart, starting near the top of the page. */
export function lines(...texts: string[]): FixturePage {
  return { items: texts.map((text, index) => ({ text, x: 72, y: 90 + index * 16 })) };
}

/** Pages that hold only a full-page grey image, like a scan without OCR. */
export async function imagePdf(pageCount: number): Promise<Uint8Array> {
  const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 120, 170], false);
  pixmap.clear(200);
  const png = pixmap.asPNG();
  pixmap.destroy();
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(png);
  for (let index = 0; index < pageCount; index += 1) {
    pdf.addPage(A4).drawImage(image, { x: 0, y: 0, width: A4[0], height: A4[1] });
  }
  return pdf.save();
}

/** The same PDF encrypted with mupdf (AES-256, user password "secret"). */
export function encrypt(bytes: Uint8Array): Uint8Array {
  const document = new mupdf.PDFDocument(bytes);
  const buffer = document.saveToBuffer('encrypt=aes-256,user-password=secret,owner-password=owner');
  // The buffer's bytes live in mupdf's memory; copy them out before freeing it.
  const copy = buffer.asUint8Array().slice();
  buffer.destroy();
  document.destroy();
  return copy;
}

export function writePdf(path: string, bytes: Uint8Array | string): string {
  writeFileSync(path, bytes);
  return path;
}
