import { describe, expect, it } from 'vitest';
import type { TextLine } from '../../../src/domain/document';
import { readHeader, sameColumns } from '../../../src/domain/tables/pdfHeader';
import { pageLines } from '../../../src/domain/tables/pdfLines';
import { boqHeader, line, pdfPage, text } from '../pdfPage';

function headerOf(...lines: TextLine[]) {
  return readHeader(pageLines(pdfPage(1, lines)), 0);
}

const labels = (header: ReturnType<typeof headerOf>) => header?.columns.map(({ label, role }) => [label, role]);

describe('readHeader', () => {
  it('reads labels and roles left to right with their positions', () => {
    const header = headerOf(boqHeader(100));
    expect(labels(header)).toEqual([
      ['Item', 'item_code'],
      ['Description', 'description'],
      ['Unit', 'unit'],
      ['Qty', 'quantity'],
      ['Rate (SAR)', 'rate'],
      ['Amount (SAR)', 'amount'],
    ]);
    expect(header?.columns[0]?.x0).toBe(40);
    expect(header?.columns[5]?.x1).toBe(550);
    expect(header).toMatchObject({ first: 0, last: 0 });
  });

  it('splits a header printed as one run of words into the longest labels', () => {
    const header = headerOf(text(100, 'Item No. Description of Works Unit Quantity Unit Rate Total Amount Remarks'));
    expect(labels(header)).toEqual([
      ['Item No.', 'item_code'],
      ['Description of Works', 'description'],
      ['Unit', 'unit'],
      ['Quantity', 'quantity'],
      ['Unit Rate', 'rate'],
      ['Total Amount', 'amount'],
      ['Remarks', null],
    ]);
  });

  it('joins a second header line that completes the labels', () => {
    const header = headerOf(
      line(100, [
        { text: 'Item', x: 40 },
        { text: 'Description', x: 90 },
        { text: 'Quantity', x: 330 },
        { text: 'Unit', x: 410 },
        { text: 'Amount', x: 480 },
      ]),
      line(111, [
        { text: 'No.', x: 40 },
        { text: 'Rate', x: 410 },
        { text: 'SAR', x: 480 },
      ]),
    );
    expect(labels(header)).toEqual([
      ['Item No.', 'item_code'],
      ['Description', 'description'],
      ['Quantity', 'quantity'],
      ['Unit Rate', 'rate'],
      ['Amount (SAR)', 'amount'],
    ]);
    expect(header).toMatchObject({ first: 0, last: 1 });
  });

  it('leaves the first row below alone when it does not complete the labels', () => {
    const header = headerOf(boqHeader(100), line(111, [{ text: 'SUBSTRUCTURE', x: 90 }]));
    expect(header).toMatchObject({ first: 0, last: 0 });
  });

  it('gives each role to the first column that names it', () => {
    const header = headerOf(text(100, 'Description Qty Amount Amount'));
    expect(header?.columns.map((column) => column.role)).toEqual(['description', 'quantity', 'amount', null]);
  });

  it('is null for sentences, numbers and lines naming fewer than three roles', () => {
    expect(headerOf(text(100, 'The unit rate and quantity of each item are given in the description column.'))).toBeNull();
    expect(headerOf(text(100, 'Item Description Unit Qty 2025'))).toBeNull();
    expect(headerOf(text(100, 'Description Amount'))).toBeNull();
    expect(headerOf(text(100, 'Clause 14 Payment'))).toBeNull();
  });
});

describe('sameColumns', () => {
  it('matches a header repeated at another height, not one moved sideways or relabelled', () => {
    const first = headerOf(boqHeader(100));
    const repeated = headerOf(boqHeader(60));
    const moved = headerOf(
      line(100, [
        { text: 'Item', x: 70 },
        { text: 'Description', x: 120 },
        { text: 'Unit', x: 360 },
        { text: 'Qty', x: 430, right: true },
        { text: 'Rate (SAR)', x: 500, right: true },
        { text: 'Amount (SAR)', x: 580, right: true },
      ]),
    );
    const relabelled = headerOf(boqHeader(100, 'Rate', 'Amount'));
    if (first === null || repeated === null || moved === null || relabelled === null) throw new Error('Expected headers');
    expect(sameColumns(first.columns, repeated.columns)).toBe(true);
    expect(sameColumns(first.columns, moved.columns)).toBe(false);
    expect(sameColumns(first.columns, relabelled.columns)).toBe(false);
  });
});
