import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MupdfReader } from '../../src/infrastructure/readers/MupdfReader';

/** Printed to PDF by Edge from right-to-left HTML paragraphs in Arial, plus one English paragraph. */
const FIXTURE = fileURLToPath(new URL('../fixtures/arabic-edge.pdf', import.meta.url));

describe('MupdfReader on an Arabic PDF', () => {
  it('returns every line in reading order', async () => {
    const outcome = await new MupdfReader().read(FIXTURE);
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok' || outcome.document.kind !== 'pdf') return;
    const [page] = outcome.document.pages;
    expect(page?.text.split('\n').filter(Boolean)).toEqual([
      'عقد المشروع',
      'قيمة العقد 1,250,000 ريال',
      'البند A-101 الخرسانة المسلحة',
      'علاقة الأعمال والإنشاءات',
      'السلام عليكم ورحمة الله',
      'Contract value: 1,250,000 SAR',
    ]);
  });

  it('gives Arabic words in reading order with their positions on the page', async () => {
    const outcome = await new MupdfReader().read(FIXTURE);
    if (outcome.status !== 'ok' || outcome.document.kind !== 'pdf') throw new Error(outcome.status);
    const line = outcome.document.pages[0]!.blocks.flatMap((block) => block.lines).find((l) => l.text.startsWith('البند'));
    const words = line!.words;
    expect(words.map((word) => word.text)).toEqual(['البند', 'A-101', 'الخرسانة', 'المسلحة']);
    // Right to left on the page: each word starts left of the one before it.
    for (let i = 1; i < words.length; i += 1) expect(words[i]!.x1).toBeLessThanOrEqual(words[i - 1]!.x0 + 0.5);
  });
});
