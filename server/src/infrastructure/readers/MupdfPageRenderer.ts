import { basename } from 'node:path';
import * as mupdf from 'mupdf';
import { AppError, errors } from '../../application/errors';
import type { PageRenderer } from '../../application/ports/PageRenderer';
import { openPdf } from './openPdf';

const DEFAULT_DPI = 144;
/** Longest side of a rendered page in pixels; larger images cost vision tokens without reading better. */
export const MAX_PIXELS = 2000;

/** Renders PDF pages to PNG with mupdf, for look_at_page and the page viewer. */
export class MupdfPageRenderer implements PageRenderer {
  async renderPage(filePath: string, page: number, options: { dpi?: number } = {}): Promise<Uint8Array> {
    const dpi = options.dpi ?? DEFAULT_DPI;
    if (!Number.isFinite(dpi) || dpi <= 0) throw errors.invalidRequest(`The resolution must be a positive DPI, not ${dpi}.`);
    const name = basename(filePath);
    const opened = await openPdf(filePath);
    if (!opened.ok) throw errors.invalidRequest(`${name} cannot be shown. ${opened.detail}`);
    const { document, pageCount } = opened;
    try {
      if (!Number.isInteger(page) || page < 1 || page > pageCount) {
        throw errors.invalidRequest(`${name} has no page ${page}; it has ${pageCount} page${pageCount === 1 ? '' : 's'}.`);
      }
      return renderPng(document, page - 1, dpi);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw errors.invalidRequest(`Page ${page} of ${name} could not be drawn; the PDF may be damaged.`);
    } finally {
      document.destroy();
    }
  }
}

function renderPng(document: mupdf.Document, index: number, dpi: number): Uint8Array {
  const page = document.loadPage(index);
  try {
    const [x0, y0, x1, y1] = page.getBounds();
    const longest = Math.max(x1 - x0, y1 - y0);
    // Half a pixel of headroom: mupdf rounds the image size up.
    const scale = longest > 0 ? Math.min(dpi / 72, (MAX_PIXELS - 0.5) / longest) : dpi / 72;
    const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
    try {
      return pixmap.asPNG();
    } finally {
      pixmap.destroy();
    }
  } finally {
    page.destroy();
  }
}
