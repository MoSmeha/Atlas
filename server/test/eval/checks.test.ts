import type { Answer, ResultTable } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import {
  hasCode,
  hasNumber,
  hasSource,
  matchRows,
  mentions,
  missingCodes,
  missingNumbers,
  textHasDate,
} from '../../scripts/eval/checks';

function answer(markdown: string, extra: Partial<Answer> = {}): Answer {
  return { kind: 'answer', language: 'en', markdown, table: null, sources: [], unreadableFiles: [], warnings: [], ...extra };
}

function table(columns: string[], rows: ResultTable['rows']): ResultTable {
  return { resultId: 'r1', title: null, columns, rows, totalRows: rows.length };
}

describe('number matching', () => {
  it('finds a number however it is written', () => {
    for (const text of ['Total SAR 1,250,000.00', 'Total 1250000', 'about SAR 1.25M', '1.25 million riyals', 'المجموع ١٬٢٥٠٬٠٠٠ ريال']) {
      expect(hasNumber(answer(text), 1_250_000), text).toBe(true);
    }
  });

  it('allows only the rounding the written precision implies', () => {
    expect(hasNumber(answer('SAR 187.5M'), 187_462_350)).toBe(true);
    expect(hasNumber(answer('SAR 1.3M'), 1_250_000)).toBe(true);
    expect(hasNumber(answer('SAR 1.4M'), 1_250_000)).toBe(false);
    expect(hasNumber(answer('SAR 1,250,001'), 1_250_000)).toBe(false);
  });

  it('ignores the sign, so a decrease of 9,000 matches -9000', () => {
    expect(hasNumber(answer('decreased by (9,000)'), -9000)).toBe(true);
    expect(hasNumber(answer('a change of -435,700'), 435_700)).toBe(true);
  });

  it('reads table cells, numbers and text', () => {
    const rows = answer('See the table.', { table: table(['Item', 'Amount'], [['1.1.02', 4_032_000], ['1.1.03', 'SAR 2,597,000.00']]) });
    expect(missingNumbers(rows, [4_032_000, 2_597_000, 99])).toEqual([99]);
  });

  it('does not read dates or item codes as amounts', () => {
    expect(hasNumber(answer('Item 1.1.05 is due 2026-02-01'), 1.1)).toBe(false);
    expect(hasNumber(answer('due 2026-02-01'), 2026)).toBe(false);
  });
});

describe('code and text matching', () => {
  it('matches a code only as a whole token', () => {
    expect(hasCode('Item 1.1.05: amount', '1.1.05')).toBe(true);
    expect(hasCode('Item 1.1.050', '1.1.05')).toBe(false);
    expect(hasCode('Item 21.1.05', '1.1.05')).toBe(false);
    expect(hasCode('M6 finishes late, M16 is fine', 'M6')).toBe(true);
    expect(hasCode('M16 is fine', 'M6')).toBe(false);
  });

  it('lists the codes missing from both markdown and table', () => {
    const found = answer('Added 2.3.07.', { table: table(['Item'], [['3.4.02']]) });
    expect(missingCodes(found, ['2.3.07', '3.4.02', '3.2.07'])).toEqual(['3.2.07']);
  });

  it('ignores case, spacing and Arabic letter variants', () => {
    expect(mentions(answer('Approved: Riyadh   LIMESTONE'), 'riyadh limestone')).toBe(true);
    expect(mentions(answer('اعتمد حجر الرياض الجيري'), 'حجر الرياض الجيري')).toBe(true);
    expect(mentions(answer('اعتمد حجر الرياض الجيرى'), 'حجر الرياض الجيري')).toBe(true);
  });
});

describe('date matching', () => {
  it('accepts the usual ways of writing a date', () => {
    for (const text of ['1 February 2026', '1st Feb 2026', 'February 1, 2026', '2026-02-01', '01/02/2026', '1.2.2026']) {
      expect(textHasDate(text, '2026-02-01'), text).toBe(true);
    }
    expect(textHasDate('١٥ نوفمبر ٢٠٢٦م', '2026-11-15')).toBe(true);
  });

  it('rejects a different day, month or year', () => {
    for (const text of ['11 February 2026', '1 March 2026', '1 February 2027', '2026-02-11', '12/02/2026']) {
      expect(textHasDate(text, '2026-02-01'), text).toBe(false);
    }
  });
});

describe('source matching', () => {
  const cited = answer('x', {
    sources: [
      { kind: 'pdf', document: 'riyadh-tower/Contract_Main_Works.pdf', page: 3, quote: null },
      { kind: 'excel', document: 'Equipment_Imports.xlsx', sheet: 'Regional Supply', rowFrom: 5, rowTo: 9 },
    ],
  });

  it('matches the file name in any folder and case, and the page or sheet when given', () => {
    expect(hasSource(cited, { document: 'contract_main_works.pdf' })).toBe(true);
    expect(hasSource(cited, { document: 'Contract_Main_Works.pdf', page: 3 })).toBe(true);
    expect(hasSource(cited, { document: 'Contract_Main_Works.pdf', page: 4 })).toBe(false);
    expect(hasSource(cited, { document: 'Equipment_Imports.xlsx', sheet: 'regional supply' })).toBe(true);
    expect(hasSource(cited, { document: 'Equipment_Imports.xlsx', sheet: 'Imported Equipment' })).toBe(false);
    expect(hasSource(cited, { document: 'Main_Works.pdf' })).toBe(false);
  });
});

describe('row matching', () => {
  const expected = [
    { label: 'Rev0 1.1.02', codes: ['1.1.02'], amount: 4_032_000, file: 'BOQ_Phase1_Rev0.xlsx' },
    { label: 'Rev1 1.1.02', codes: ['1.1.02'], amount: 4_263_000, file: 'BOQ_Phase1_Rev1.xlsx' },
    { label: 'Rev1 1.2.01', codes: ['1.2.01'], amount: 2_597_000, file: 'BOQ_Phase1_Rev1.xlsx' },
  ];

  it('matches every expected row once and reports the rest as missing or extra', () => {
    const result = matchRows(
      table(['File', 'Item', 'Amount'], [
        ['BOQ_Phase1_Rev0.xlsx', '1.1.02', 4_032_000],
        ['BOQ_Phase1_Rev1.xlsx', '1.1.02', 4_263_000],
        ['BOQ_Phase2_Facade.pdf', '4.2.05', 1_000_000],
      ]),
      expected,
    );
    expect(result.matched.map((row) => row.label)).toEqual(['Rev0 1.1.02', 'Rev1 1.1.02']);
    expect(result.missing.map((row) => row.label)).toEqual(['Rev1 1.2.01']);
    expect(result.extra).toHaveLength(1);
  });

  it('needs the amount, and the file when the row names one', () => {
    const wrongAmount = matchRows(table(['Item', 'Amount'], [['1.2.01', 2_500_000]]), expected);
    expect(wrongAmount.extra).toHaveLength(1);
    const wrongFile = matchRows(table(['File', 'Item', 'Amount'], [['BOQ_Phase1_Rev0', '1.2.01', 2_597_000]]), expected);
    expect(wrongFile.extra).toHaveLength(1);
    const noFile = matchRows(table(['Item', 'Amount'], [['1.2.01', 'SAR 2,597,000.00']]), expected);
    expect(noFile.matched.map((row) => row.label)).toEqual(['Rev1 1.2.01']);
  });

  it('treats a missing table as every row missing', () => {
    expect(matchRows(null, expected).missing).toHaveLength(3);
  });
});
