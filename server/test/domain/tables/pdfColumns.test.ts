import { describe, expect, it } from 'vitest';
import type { TextLine } from '../../../src/domain/document';
import { columnLayout, fitLine } from '../../../src/domain/tables/pdfColumns';
import { readHeader } from '../../../src/domain/tables/pdfHeader';
import { type PageLine, pageLines } from '../../../src/domain/tables/pdfLines';
import { BOQ_X, boqHeader, boqLine, line, pdfPage, text } from '../pdfPage';

/** The header's layout grown over the body lines, and the body lines as printed rows. */
function layoutOf(header: TextLine, body: TextLine[]) {
  const lines = pageLines(pdfPage(1, [header, ...body]));
  const found = readHeader(lines, 0);
  if (found === null) throw new Error('Expected a header');
  const rows: PageLine[] = lines.slice(1);
  return { layout: columnLayout(found.columns, rows), rows };
}

describe('fitLine', () => {
  it('puts each cell of a row in its column', () => {
    const { layout, rows } = layoutOf(boqHeader(100), [
      boqLine(118, ['3.01', 'Reinforced concrete grade C40 to rafts', 'm3', '4,250', '410.00', '1,742,500.00']),
      boqLine(131, ['', 'including formwork', '', '', '', '']),
    ]);
    expect(rows.map((row) => fitLine(row, layout))).toEqual([
      ['3.01', 'Reinforced concrete grade C40 to rafts', 'm3', '4,250', '410.00', '1,742,500.00'],
      ['', 'including formwork', '', '', '', ''],
    ]);
  });

  it('takes numbers wider than their label and placed past it', () => {
    const header = line(100, [
      { text: 'Item', x: 40 },
      { text: 'Description', x: 90 },
      { text: 'Qty', x: 340 },
      { text: 'Amount', x: 450 },
    ]);
    const { layout, rows } = layoutOf(header, [
      line(118, [
        { text: 'A.1', x: 40 },
        { text: 'Piling', x: 90 },
        { text: '12,345.50', x: 400, right: true },
        { text: '1,234,567.00', x: 550, right: true },
      ]),
      line(131, [
        { text: 'A.2', x: 40 },
        { text: 'Caps', x: 90 },
        { text: '40', x: 400, right: true },
        { text: '9,000.00', x: 550, right: true },
      ]),
    ]);
    expect(rows.map((row) => fitLine(row, layout))).toEqual([
      ['A.1', 'Piling', '12,345.50', '1,234,567.00'],
      ['A.2', 'Caps', '40', '9,000.00'],
    ]);
  });

  it('gives a label that starts in the item column to the description', () => {
    const { layout, rows } = layoutOf(boqHeader(100), [
      line(118, [
        { text: 'Carried forward to next page', x: 40 },
        { text: '12,829,600.00', x: BOQ_X.amount, right: true },
      ]),
    ]);
    expect(fitLine(rows[0]!, layout)).toEqual(['', 'Carried forward to next page', '', '', '', '12,829,600.00']);
  });

  it('rejects paragraphs, page numbers in the amount column and notes in the left margin', () => {
    const { layout, rows } = layoutOf(boqHeader(100), [
      text(118, 'All rates include supply, delivery, installation, testing and protection until handover.'),
      line(131, [
        { text: 'Fictional sample document.', x: 40 },
        { text: 'Page 1 of 3', x: BOQ_X.amount, right: true },
      ]),
      line(144, [{ text: 'Rev', x: 2 }]),
    ]);
    expect(rows.map((row) => fitLine(row, layout))).toEqual([null, null, null]);
  });
});
