import type { DocumentSummary, ToolStep, Usage } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import {
  formatCost,
  formatDuration,
  formatNumber,
  formatProblems,
  formatSources,
  formatStep,
  formatTable,
  formatUsage,
  stepInput,
} from '../../src/cli/format';

describe('formatNumber', () => {
  it('adds thousands separators without rounding', () => {
    expect(formatNumber(4032000)).toBe('4,032,000');
    expect(formatNumber(-1234.567)).toBe('-1,234.567');
    expect(formatNumber(12.5)).toBe('12.5');
  });

  it('leaves codes and exponent forms as they are', () => {
    expect(formatNumber(2026, false)).toBe('2026');
    expect(formatNumber(1e21)).toBe('1e+21');
  });
});

describe('formatTable', () => {
  const table = {
    title: 'Items above SAR 1,000,000',
    columns: ['item_code', 'description', 'amount'],
    rows: [
      ['1.1.02', 'Bulk excavation', 4032000],
      ['2.3.01', 'Unitised curtain wall', 20590000],
      ['3.1.04', 'Fan coil units', 3306000.5],
    ],
    totalRows: 3,
  };

  it('aligns text left and numbers right under a title and a rule', () => {
    expect(formatTable(table).split('\n')).toEqual([
      'Items above SAR 1,000,000',
      'item_code  description                 amount',
      '---------  ---------------------  -----------',
      '1.1.02     Bulk excavation          4,032,000',
      '2.3.01     Unitised curtain wall   20,590,000',
      '3.1.04     Fan coil units         3,306,000.5',
    ]);
  });

  it('prints the first rows and counts the rest, including rows the server did not send', () => {
    const lines = formatTable({ ...table, title: null, totalRows: 45 }, 2).split('\n');
    expect(lines).toHaveLength(5);
    expect(lines.at(-1)).toBe('... 43 more rows');
    expect(formatTable({ ...table, title: null, totalRows: 3 }, 2).split('\n').at(-1)).toBe('... 1 more row');
  });

  it('keeps codes ungrouped, leaves empty cells blank and cuts long text', () => {
    const lines = formatTable({
      title: null,
      columns: ['entry_no', 'note', 'year'],
      rows: [
        [10001, 'x'.repeat(60), 2026],
        [10002, null, null],
      ],
      totalRows: 2,
    }).split('\n');
    expect(lines[0]).toBe(`entry_no  note${' '.repeat(36)}  year`);
    expect(lines[2]).toBe(`   10001  ${'x'.repeat(39)}…  2026`);
    expect(lines[3]).toBe('   10002');
  });
});

describe('formatSources', () => {
  it('numbers Excel row ranges and PDF pages with their quotes', () => {
    expect(
      formatSources([
        { kind: 'excel', document: 'BOQ_Phase1_Rev0.xlsx', sheet: 'Bill 2', rowFrom: 14, rowTo: 18 },
        { kind: 'excel', document: 'BOQ_Phase1_Rev0.xlsx', sheet: 'MEP', rowFrom: 9, rowTo: 9 },
        { kind: 'pdf', document: 'Contract_Main_Works.pdf', page: 3, quote: 'SAR 187,462,350.00' },
        { kind: 'pdf', document: 'Contract_Main_Works.pdf', page: 4, quote: null },
      ]),
    ).toEqual([
      '[1] BOQ_Phase1_Rev0.xlsx, sheet Bill 2, rows 14-18',
      '[2] BOQ_Phase1_Rev0.xlsx, sheet MEP, row 9',
      '[3] Contract_Main_Works.pdf, page 3: "SAR 187,462,350.00"',
      '[4] Contract_Main_Works.pdf, page 4',
    ]);
  });
});

describe('formatStep and stepInput', () => {
  const step: ToolStep = {
    id: 's1',
    name: 'query_tables',
    inputSummary: '{"sql":"SELECT item, amount FROM boq WHERE amount > 1000000"}',
    status: 'ok',
    durationMs: 120,
    resultSummary: '25 rows',
    error: null,
  };

  it('shows a lone argument as it is, with the time taken', () => {
    expect(formatStep(step)).toBe('> query_tables  SELECT item, amount FROM boq WHERE amount > 1000000 (120 ms)');
  });

  it('adds the reason of a failed or refused step', () => {
    expect(formatStep({ ...step, status: 'error', error: 'no such column: amt' })).toBe(
      '> query_tables  SELECT item, amount FROM boq WHERE amount > 1000000 (120 ms)\n    failed: no such column: amt',
    );
    expect(formatStep({ ...step, name: 'list_documents', inputSummary: '', status: 'refused', error: 'Repeated call.', durationMs: null })).toBe(
      '> list_documents\n    refused: Repeated call.',
    );
  });

  it('shows several arguments as pairs and mends input the server cut short', () => {
    expect(stepInput('{"document":"Contract.pdf","from":3,"to":4}')).toBe('document: Contract.pdf, from: 3, to: 4');
    expect(stepInput('{"sql":"SELECT COUNT(*) FROM ledger","title":"Ledger entries"}')).toBe('SELECT COUNT(*) FROM ledger');
    expect(stepInput('{"query":"retention money and the release of…')).toBe('retention money and the release of…');
    expect(stepInput('not json')).toBe('not json');
  });
});

describe('usage, cost and time', () => {
  const usage: Usage = {
    model: 'gpt-6-astra',
    inputTokens: 23456,
    cachedInputTokens: 12000,
    outputTokens: 1234,
    reasoningTokens: 300,
    costUsd: 0.0842,
    durationMs: 14_230,
  };

  it('puts model, tokens, cost and time on one line', () => {
    expect(formatUsage(usage)).toBe('gpt-6-astra | 23,456 input tokens (12,000 cached), 1,234 output | $0.084 | 14.2 s');
    expect(formatUsage({ ...usage, cachedInputTokens: 0 })).toContain('| 23,456 input tokens, 1,234 output |');
  });

  it('formats small and large costs and durations', () => {
    expect(formatCost(0)).toBe('$0.000');
    expect(formatCost(0.0002)).toBe('< $0.001');
    expect(formatCost(1.236)).toBe('$1.24');
    expect(formatDuration(120)).toBe('120 ms');
    expect(formatDuration(65_000)).toBe('1 min 5 s');
  });
});

describe('formatProblems', () => {
  const document = (path: string, status: DocumentSummary['status'], statusDetail: string | null): DocumentSummary => ({
    id: path,
    name: path,
    path,
    kind: 'pdf',
    status,
    statusDetail,
    sizeBytes: 1,
    pageCount: null,
    scannedPages: [],
    sheets: [],
    tables: [],
    currencies: [],
    language: null,
    classification: null,
  });

  it('lists files that were not read cleanly with aligned names', () => {
    expect(
      formatProblems([
        document('Contract.pdf', 'ok', null),
        document('Drawing_Register.pdf', 'corrupt', 'The file is damaged.'),
        document('Big.pdf', 'too_large', null),
      ]),
    ).toEqual([
      '2 files of 3 could not be read fully:',
      '  Drawing_Register.pdf  corrupt - The file is damaged.',
      '  Big.pdf               too large',
    ]);
  });

  it('says nothing when every file was read', () => {
    expect(formatProblems([document('Contract.pdf', 'ok', null)])).toEqual([]);
  });
});
