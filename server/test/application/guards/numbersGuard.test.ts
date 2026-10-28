import { describe, expect, it } from 'vitest';
import { claimedNumbers, unsupportedNumbers, type NumbersEvidence } from '../../../src/application/guards/numbersGuard';
import type { SavedResult } from '../../../src/application/session/Session';

function check(markdown: string, evidence: Partial<NumbersEvidence> = {}): string[] {
  const input: NumbersEvidence = {
    markdown,
    question: '',
    toolOutputs: [],
    results: [],
    sources: [],
    fileNames: [],
    ...evidence,
  };
  return unsupportedNumbers(input).map((mention) => mention.text);
}

function savedResult(rows: (string | number | null)[][]): SavedResult {
  return { id: 'r1', title: 'Items over 100,000', columns: ['item_code', 'amount'], rows, sources: [], tool: 'query_tables', detail: null };
}

const queryOutput = { resultId: 'r1', columns: ['item_code', 'amount'], rows: [['C-01', 1_250_000], ['C-02', 48_000_000]] };

describe('unsupportedNumbers', () => {
  it('catches a number no tool returned', () => {
    expect(check('Bill 3 totals SAR 1,300,000.', { toolOutputs: [queryOutput] })).toEqual(['1,300,000']);
  });

  it('accepts formatted variants of a returned value', () => {
    const markdown = 'C-01 is SAR 1,250,000.00 (about SAR 1.25M, or 1.25 million); C-02 is SAR 48M.';
    expect(check(markdown, { toolOutputs: [queryOutput] })).toEqual([]);
  });

  it('accepts values written as numeric strings in a tool output', () => {
    expect(check('The rate is 1,250.50 per m3.', { toolOutputs: [{ rows: [['1,250.50']] }] })).toEqual([]);
  });

  it('reads Arabic-Indic digits in the answer', () => {
    expect(check('إجمالي البند C-01 هو ١٬٢٥٠٬٠٠٠ ريال.', { toolOutputs: [queryOutput] })).toEqual([]);
    expect(check('الإجمالي ١٬٣٠٠٬٠٠٠ ريال.', { toolOutputs: [queryOutput] })).toEqual(['١٬٣٠٠٬٠٠٠']);
  });

  it('matches percentages to fractions and to percent values', () => {
    expect(check('Retention is 10% and VAT is 15%.', { toolOutputs: [{ retention: 0.1, text: 'VAT at 15 %' }] })).toEqual([]);
  });

  it('accepts numbers from the question', () => {
    expect(check('Two items cost more than SAR 100,000.', { question: 'Which items cost more than 100000?' })).toEqual([]);
  });

  it('accepts values and the row count of an attached result', () => {
    const rows = Array.from({ length: 14 }, (_, i) => [`A${i + 1}`, 48_000_000 + i]);
    expect(check('14 items, the largest SAR 48,000,013.', { results: [savedResult(rows)] })).toEqual([]);
  });

  it('accepts the length of a list a tool returned', () => {
    const documents = Array.from({ length: 12 }, (_, i) => ({ name: `Doc ${i}.pdf` }));
    expect(check('There are 12 loaded documents.', { toolOutputs: [{ documents }] })).toEqual([]);
  });

  it('accepts cited page and row numbers', () => {
    const markdown = 'See page 47 of the contract and rows 120 to 135 of Bill 12.';
    expect(
      check(markdown, {
        sources: [
          { kind: 'pdf', document: 'Contract.pdf', page: 47, quote: null },
          { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 12', rowFrom: 120, rowTo: 135 },
        ],
      }),
    ).toEqual([]);
  });

  it('accepts negative values written as decreases and in parentheses', () => {
    expect(check('It fell by 50,000 to (3,200).', { toolOutputs: [{ difference: -50_000, balance: -3200 }] })).toEqual([]);
  });

  it('accepts values the chat already knows', () => {
    expect(check('Earlier total: SAR 777,777.', { known: (value) => value === 777_777 })).toEqual([]);
  });

  it('lists each unsupported number once, in text order', () => {
    expect(check('Totals 1,300,000 and 2.5M, again 1,300,000.')).toEqual(['1,300,000', '2.5M']);
  });
});

describe('claimedNumbers', () => {
  const texts = (markdown: string, fileNames: string[] = []) => claimedNumbers(markdown, fileNames).map((m) => m.text);

  it('ignores years, small whole numbers and list numbering', () => {
    expect(texts('In 2024 the 3 bills were priced.\n11. First\n12) Second\n  13. Third')).toEqual([]);
  });

  it('still checks years and small numbers written as amounts', () => {
    expect(texts('Rates of 2,024 and 7.5 and 5% apply.')).toEqual(['2,024', '7.5', '5%']);
  });

  it('ignores numbers inside loaded file names, with or without the extension', () => {
    const fileNames = ['BOQ Phase 12 Rev 15.xlsx', 'contracts/BOQ Phase 12 Rev 15.xlsx'];
    expect(texts('Per BOQ Phase 12 Rev 15.xlsx and BOQ Phase 12 Rev 15, the total is 99,000.', fileNames)).toEqual(['99,000']);
  });

  it('ignores numbers in file-like names and links', () => {
    expect(texts('See Contract-2024-v31.pdf, [the page](https://atlas.local/doc/9931) and https://x.y/99?p=77.')).toEqual([]);
  });
});
