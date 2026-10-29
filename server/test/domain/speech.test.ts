import type { Answer, ResultTable } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import {
  cutAtSentence,
  MAX_SPEECH_CHARS,
  MAX_SPOKEN_PROSE,
  plainText,
  speechFor,
  spokenNumber,
} from '../../src/domain/speech';

function answer(parts: Partial<Answer>): Answer {
  return {
    kind: 'answer',
    language: 'en',
    markdown: '',
    table: null,
    sources: [],
    unreadableFiles: [],
    warnings: [],
    ...parts,
  };
}

const items: ResultTable = {
  resultId: 'r1',
  title: 'Items over SAR 1,000,000',
  columns: ['item_code', 'description', 'amount_sar', '_row'],
  rows: [
    ['A1', 'Piles', 2000000, 5],
    ['A3', 'Structural steel', 1500000.5, 9],
    ['B2', null, 1200000, 14],
  ],
  totalRows: 3,
};

describe('plainText', () => {
  it('keeps the words of headings, list items, emphasis, links and inline code', () => {
    const markdown = [
      '## Contract value',
      '**The contract value is SAR 12,500,000.** It is set in [clause 4](http://x) of `Contract_Main.pdf`.',
      '',
      '- Advance payment: 10%',
      '1. Retention *five* percent',
      '> Quoted clause',
    ].join('\n');
    expect(plainText(markdown)).toBe(
      'Contract value. The contract value is SAR 12,500,000. It is set in clause 4 of Contract_Main.pdf. ' +
        'Advance payment: 10%. Retention five percent. Quoted clause',
    );
  });

  it('leaves out Markdown tables and code blocks, and keeps underscores inside file names', () => {
    const markdown = [
      'Two bills changed in BOQ_Rev_B.xlsx.',
      '',
      '| Bill | Change |',
      '| --- | ---: |',
      '| 1 | 5,000 |',
      '',
      '```sql',
      'SELECT 1',
      '```',
      'Bill 3 did not change.',
    ].join('\n');
    expect(plainText(markdown)).toBe('Two bills changed in BOQ_Rev_B.xlsx. Bill 3 did not change.');
  });

  it('keeps Arabic text and its punctuation', () => {
    expect(plainText('**قيمة العقد** هي 12,500,000 ريال.\n\n- الدفعة المقدمة ١٠٪')).toBe('قيمة العقد هي 12,500,000 ريال. الدفعة المقدمة ١٠٪.');
  });
});

describe('cutAtSentence', () => {
  it('keeps a text that fits', () => {
    expect(cutAtSentence('One. Two.', 50)).toEqual({ text: 'One. Two.', cut: false });
  });

  it('cuts after the last whole sentence that fits, never inside a number', () => {
    const text = 'The total is SAR 1,250,000.50 for Bill 1. Bill 2 adds SAR 300,000. Bill 3 adds more.';
    expect(cutAtSentence(text, 70)).toEqual({ text: 'The total is SAR 1,250,000.50 for Bill 1. Bill 2 adds SAR 300,000.', cut: true });
  });

  it('ends at an Arabic question mark', () => {
    expect(cutAtSentence('هل تقصد المراجعة ب؟ لأن المراجعة أ أقدم بكثير من غيرها', 30)).toEqual({ text: 'هل تقصد المراجعة ب؟', cut: true });
  });

  it('falls back to whole words with an ellipsis when no sentence ends early enough', () => {
    expect(cutAtSentence('one two three four five six seven eight nine ten', 20)).toEqual({ text: 'one two three four…', cut: true });
  });
});

describe('spokenNumber', () => {
  it('groups thousands and keeps every digit', () => {
    expect(spokenNumber(1234567.5)).toBe('1,234,567.5');
    expect(spokenNumber(-1500)).toBe('-1,500');
    expect(spokenNumber(999)).toBe('999');
    expect(spokenNumber(0.125)).toBe('0.125');
  });

  it('leaves codes and numbers in exponent form as they are', () => {
    expect(spokenNumber(20261, false)).toBe('20261');
    expect(spokenNumber(1e21)).toBe('1e+21');
  });
});

describe('speechFor', () => {
  it('reads a short answer as it is', () => {
    expect(speechFor(answer({ markdown: 'The contract value is SAR 12,500,000.' }))).toBe('The contract value is SAR 12,500,000.');
  });

  it('reads the table size, its columns and its rows, without meta columns and with exact grouped amounts', () => {
    const text = speechFor(answer({ markdown: 'Three items cost more than SAR 1,000,000.', table: items }));
    expect(text.split('\n')).toEqual([
      'Three items cost more than SAR 1,000,000.',
      'The table on the screen, "Items over SAR 1,000,000", has 3 rows.',
      'Columns: Item code, Description, Amount SAR.',
      'They are: A1, Piles, 2,000,000; A3, Structural steel, 1,500,000.5; B2, 1,200,000.',
    ]);
  });

  it('reads only the first rows of a long table and says how many there are', () => {
    const rows = Array.from({ length: 12 }, (_, i) => [`C${i + 1}`, 1000 * (i + 1)]);
    const table: ResultTable = { resultId: 'r2', title: null, columns: ['item_code', 'amount'], rows, totalRows: 40 };
    const lines = speechFor(answer({ markdown: 'Forty items are listed.', table })).split('\n');
    expect(lines[1]).toBe('The table on the screen has 40 rows.');
    expect(lines[3]).toBe('The first 5: C1, 1,000; C2, 2,000; C3, 3,000; C4, 4,000; C5, 5,000.');
  });

  it('names up to three sources, then counts the rest', () => {
    const text = speechFor(
      answer({
        markdown: 'Found.',
        sources: [
          { kind: 'pdf', document: 'Contract.pdf', page: 4, quote: null },
          { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 40 },
          { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 2', rowFrom: 7, rowTo: 7 },
          { kind: 'pdf', document: 'Spec.pdf', page: 2, quote: null },
          { kind: 'pdf', document: 'Spec.pdf', page: 3, quote: null },
        ],
      }),
    );
    expect(text.split('\n')[1]).toBe(
      'Sources: Contract.pdf, page 4; BOQ.xlsx, sheet Bill 1, rows 5 to 40; BOQ.xlsx, sheet Bill 2, row 7; and 2 more.',
    );
  });

  it('cuts a long answer at a sentence and says the rest is on the screen', () => {
    const sentence = 'Clause 14 sets the payment terms for each stage of the works. ';
    const lines = speechFor(answer({ markdown: sentence.repeat(30) })).split('\n');
    expect(lines[0]?.length).toBeLessThanOrEqual(MAX_SPOKEN_PROSE);
    expect(lines[0]?.endsWith('works.')).toBe(true);
    expect(lines[1]).toBe('The rest of the answer is on the screen.');
  });

  it('uses Arabic words around an Arabic answer and keeps file names as written', () => {
    const text = speechFor(
      answer({
        language: 'ar',
        markdown: 'ثلاثة بنود تتجاوز مليون ريال.',
        table: items,
        sources: [{ kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 14 }],
      }),
    );
    expect(text.split('\n')).toEqual([
      'ثلاثة بنود تتجاوز مليون ريال.',
      'على الشاشة جدول «Items over SAR 1,000,000»، عدد صفوفه 3.',
      'الأعمدة: Item code, Description, Amount SAR.',
      'وهي: A1, Piles, 2,000,000; A3, Structural steel, 1,500,000.5; B2, 1,200,000.',
      'المصدر: BOQ.xlsx, ورقة Bill 1, الصفوف 5 إلى 14.',
    ]);
  });

  it('names the unreadable files of a not-found answer and the first warning', () => {
    const text = speechFor(
      answer({
        kind: 'not_found',
        markdown: 'The loaded documents do not give the retention rate.',
        unreadableFiles: ['Scan.pdf', 'Locked.pdf'],
        warnings: ['One number in the answer did not come from a tool.', 'A second warning.'],
      }),
    );
    expect(text.split('\n')).toEqual([
      'The loaded documents do not give the retention rate.',
      'Files that could not be read: Scan.pdf, Locked.pdf.',
      'Note: One number in the answer did not come from a tool.',
    ]);
  });

  it('never runs past the length limit', () => {
    const longCell = 'x'.repeat(500);
    const table: ResultTable = {
      resultId: 'r3',
      title: 't'.repeat(300),
      columns: Array.from({ length: 30 }, (_, i) => `column_${i}`),
      rows: Array.from({ length: 5 }, () => Array.from({ length: 30 }, () => longCell)),
      totalRows: 5,
    };
    expect(speechFor(answer({ markdown: 'a. '.repeat(400), table })).length).toBeLessThanOrEqual(MAX_SPEECH_CHARS);
  });
});
