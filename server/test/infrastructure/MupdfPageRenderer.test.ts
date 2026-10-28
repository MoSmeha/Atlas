import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppError } from '../../src/application/errors';
import { MAX_PIXELS, MupdfPageRenderer } from '../../src/infrastructure/readers/MupdfPageRenderer';
import { encrypt, lines, textPdf, writePdf } from './pdfFixtures';

let dir: string;
let a4: string;
const renderer = new MupdfPageRenderer();

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'atlas-render-'));
  a4 = writePdf(join(dir, 'spec.pdf'), await textPdf([lines('Section 1 Scope'), lines('Section 2 Materials')]));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Width and height from a PNG's IHDR chunk. */
function pngSize(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe('MupdfPageRenderer', () => {
  it('renders a page to PNG at 144 DPI by default', async () => {
    const png = await renderer.renderPage(a4, 2);
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const { width, height } = pngSize(png);
    expect(width).toBeGreaterThanOrEqual(1190);
    expect(width).toBeLessThanOrEqual(1191);
    expect(height).toBeGreaterThanOrEqual(1684);
    expect(height).toBeLessThanOrEqual(1685);
  });

  it('follows the requested DPI', async () => {
    const { width, height } = pngSize(await renderer.renderPage(a4, 1, { dpi: 72 }));
    expect([width, height]).toEqual([595, 842]);
  });

  it('caps the longest side at 2000 pixels', async () => {
    const { width, height } = pngSize(await renderer.renderPage(a4, 1, { dpi: 600 }));
    expect(height).toBeLessThanOrEqual(MAX_PIXELS);
    expect(height).toBeGreaterThan(MAX_PIXELS - 5);
    expect(width / height).toBeCloseTo(595 / 842, 2);
  });

  it('rejects a page that does not exist', async () => {
    await expect(renderer.renderPage(a4, 3)).rejects.toThrow('spec.pdf has no page 3; it has 2 pages.');
    await expect(renderer.renderPage(a4, 0)).rejects.toBeInstanceOf(AppError);
  });

  it('rejects a resolution that is not positive', async () => {
    await expect(renderer.renderPage(a4, 1, { dpi: 0 })).rejects.toThrow('positive DPI');
  });

  it('explains why an unreadable PDF cannot be shown', async () => {
    const locked = writePdf(join(dir, 'locked.pdf'), encrypt(await textPdf([lines('Tender prices')])));
    await expect(renderer.renderPage(locked, 1)).rejects.toThrow('locked.pdf cannot be shown. The PDF is password-protected.');
    await expect(renderer.renderPage(join(dir, 'missing.pdf'), 1)).rejects.toMatchObject({ code: 'invalid_request' });
  });
});
