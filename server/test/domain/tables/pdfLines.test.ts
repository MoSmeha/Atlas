import { describe, expect, it } from 'vitest';
import type { TextLine } from '../../../src/domain/document';
import { lineText, pageLines, wordRuns, wordText } from '../../../src/domain/tables/pdfLines';
import { line, pdfPage } from '../pdfPage';

describe('pageLines', () => {
  it('merges lines of different blocks at one height and orders rows top to bottom', () => {
    const numbers = line(118.5, [
      { text: 'm3', x: 330 },
      { text: '1,200', x: 400, right: true },
    ]);
    const description: TextLine[] = [
      line(118, [{ text: '2.01 Excavation in rock', x: 40 }]),
      line(129, [{ text: 'including disposal', x: 90 }]),
    ];
    const page = pdfPage(1, [line(100, [{ text: 'Item Description', x: 40 }])]);
    page.blocks.unshift({ box: numbers.box, lines: [numbers] }, { box: description[0]!.box, lines: description });

    const lines = pageLines(page);
    expect(lines.map(lineText)).toEqual(['Item Description', '2.01 Excavation in rock m3 1,200', 'including disposal']);
    expect(lines[1]).toMatchObject({ page: 1, top: 118 });
    expect(lines[1]?.height).toBeCloseTo(10.8);
    expect(lines[1]?.bottom).toBeCloseTo(129.3);
  });

  it('gives nothing for a page without text', () => {
    expect(pageLines({ ...pdfPage(3, []), hasTextLayer: false })).toEqual([]);
  });
});

describe('wordRuns', () => {
  it('splits a row where the gap is wider than a space', () => {
    const [row] = pageLines(
      pdfPage(1, [
        line(100, [
          { text: 'Carried forward', x: 90 },
          { text: '12,829,600.00', x: 550, right: true },
        ]),
      ]),
    );
    expect(wordRuns(row!).map((run) => wordText(run.words))).toEqual(['Carried forward', '12,829,600.00']);
  });
});

describe('wordText', () => {
  it('reads Latin words left to right and Arabic words right to left', () => {
    const words = (texts: string[]) => texts.map((text, i) => ({ text, x0: i * 40, x1: i * 40 + 30 }));
    expect(wordText(words(['Unit', 'Rate']))).toBe('Unit Rate');
    expect(wordText(words(['الوحدة', 'سعر']))).toBe('سعر الوحدة');
    expect(wordText([])).toBe('');
  });
});
