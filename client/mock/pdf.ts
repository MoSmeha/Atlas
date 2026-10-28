export interface PdfPage {
  heading: string;
  lines: string[];
  footer: string;
}

/**
 * Writes a small, valid A4 PDF with a real text layer, so the viewer can render and highlight it.
 * Helvetica has no Arabic glyphs, so any character outside ASCII is drawn as "?".
 */
export function buildPdf(pages: PdfPage[]): Buffer {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pages.forEach((page, i) => {
    const pageId = pageIds[i] ?? 0;
    const content = pageContent(page);
    objects[pageId] =
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefAt = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function pageContent(page: PdfPage): string {
  const body = page.lines.map((line, i) => `${i === 0 ? '' : 'T* '}(${escape(line)}) Tj`).join('\n');
  return [
    `BT /F2 14 Tf 56 786 Td (${escape(page.heading)}) Tj ET`,
    `BT /F1 10.5 Tf 15 TL 56 752 Td\n${body}\nET`,
    `BT /F1 8 Tf 56 40 Td (${escape(page.footer)}) Tj ET`,
  ].join('\n');
}

function escape(text: string): string {
  return text.replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, (char) => `\\${char}`);
}
