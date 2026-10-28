import { chromium } from 'playwright-core';

export interface HtmlPdfOptions {
  /** Chromium footer template; it may use the pageNumber and totalPages classes. */
  footerTemplate: string;
  /** Written into the PDF dates instead of the time of rendering, so regenerating gives the same bytes. */
  issued: Date;
}

/** Renders an HTML page to an A4 PDF with the installed Microsoft Edge. Page size and margins come from the CSS @page rule. */
export async function htmlToPdf(html: string, options: HtmlPdfOptions): Promise<Uint8Array> {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: options.footerTemplate,
    });
    return setPdfDates(new Uint8Array(pdf), options.issued);
  } finally {
    await browser.close();
  }
}

const DATE_ENTRY = /\/(CreationDate|ModDate) \(D:[^)]*\)/g;

/** Rewrites the creation and modification dates in place. Each entry keeps its length, so the cross-reference offsets stay valid. */
export function setPdfDates(bytes: Uint8Array, date: Date): Uint8Array {
  const stamp = `D:${date.toISOString().slice(0, 19).replace(/[-T:]/g, '')}+00'00'`;
  const text = Buffer.from(bytes).toString('latin1');
  const fixed = text.replace(DATE_ENTRY, (entry, key: string) => {
    const replacement = `/${key} (${stamp})`;
    if (replacement.length !== entry.length) throw new Error(`Cannot rewrite ${entry} in place`);
    return replacement;
  });
  return new Uint8Array(Buffer.from(fixed, 'latin1'));
}
