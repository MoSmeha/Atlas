import * as mupdf from 'mupdf';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildSiteSurveyScanned, drawSurveyNote, siteSurvey } from '../../scripts/samples/siteSurveyScanned';

interface StextBlock {
  type: string;
  bbox: { x: number; y: number; w: number; h: number };
}

let bytes: Uint8Array;

beforeAll(async () => {
  bytes = await buildSiteSurveyScanned();
});

describe('Site_Survey_Scanned.pdf', () => {
  it('is one page with no text at all, only an image that fills it', () => {
    const doc = mupdf.Document.openDocument(bytes, 'application/pdf');
    expect(doc.countPages()).toBe(1);
    const page = doc.loadPage(0);
    expect(page.toStructuredText('preserve-whitespace').asText().trim()).toBe('');
    const blocks = (JSON.parse(page.toStructuredText('preserve-images').asJSON()) as { blocks: StextBlock[] }).blocks;
    expect(blocks.map((block) => block.type)).toEqual(['image']);
    const [, , width, height] = page.getBounds();
    expect(blocks[0]!.bbox.w * blocks[0]!.bbox.h).toBeGreaterThan(0.95 * width * height);
  });

  it('draws the vision-only fact on the page before it is scanned', async () => {
    const note = mupdf.Document.openDocument(await drawSurveyNote(), 'application/pdf');
    const text = note.loadPage(0).toStructuredText('preserve-whitespace').asText().replace(/\s+/g, ' ');
    expect(text).toContain(siteSurvey.visionFact);
    for (const observation of siteSurvey.observations) expect(text).toContain(observation.text);
  });

  it('repeats byte for byte, so regenerating leaves the file unchanged', async () => {
    expect(await buildSiteSurveyScanned()).toEqual(bytes);
  });
});
