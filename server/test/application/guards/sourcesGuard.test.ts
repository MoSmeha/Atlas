import { describe, expect, it } from 'vitest';
import { checkSources, requireSources, unreadableFiles } from '../../../src/application/guards/sourcesGuard';
import { Session } from '../../../src/application/session/Session';
import type { SubmittedSource } from '../../../src/application/tools/submitAnswer';
import { FakeIndex } from '../../fakes/FakeIndex';
import { boqTable, excelRecord, pdfRecord } from '../../fakes/records';

function setup() {
  const index = new FakeIndex();
  index.save(pdfRecord('contracts/Main Contract.pdf', ['Clause 1', 'Clause 2', 'Retention is 10%']));
  index.save(excelRecord('boq/BOQ Phase 1.xlsx', [boqTable([['A1', 'Concrete', 10, 100, 1000]], 'Bill 1'), boqTable([], 'Bill 2')]));
  index.save(excelRecord('boq/Ledger.xlsx', [boqTable([], 'Ledger')]));
  index.save({ ...pdfRecord('locked.pdf', []), status: 'encrypted', pageCount: null });
  index.save({ ...pdfRecord('broken.pdf', []), status: 'corrupt', pageCount: null });
  index.save({ ...pdfRecord('notes.docx', []), kind: 'other', status: 'skipped', pageCount: null });
  return { index, session: new Session('s1') };
}

const pdf = (document: string, page: number | null, quote: string | null = null): SubmittedSource => ({
  document,
  page,
  sheet: null,
  row_from: null,
  row_to: null,
  quote,
});

const excel = (document: string, sheet: string | null, from: number | null, to: number | null): SubmittedSource => ({
  document,
  page: null,
  sheet,
  row_from: from,
  row_to: to,
  quote: null,
});

function check(sources: SubmittedSource[], options: { kind?: 'answer' | 'not_found'; resultId?: string | null } = {}) {
  const { index, session } = setup();
  return checkSources({ index, session, kind: options.kind ?? 'answer', sources, resultId: options.resultId ?? null });
}

describe('checkSources', () => {
  it('resolves documents by name or path, ignoring case, and cites them by path', () => {
    const result = check([pdf('main contract.pdf', 3, '  Retention   is 10% '), excel('boq/BOQ Phase 1.xlsx', 'Bill 1', 5, 9)]);
    expect(result.problems).toEqual([]);
    expect(result.sources).toEqual([
      { kind: 'pdf', document: 'contracts/Main Contract.pdf', page: 3, quote: 'Retention is 10%' },
      { kind: 'excel', document: 'boq/BOQ Phase 1.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 9 },
    ]);
  });

  it('drops an unknown document', () => {
    const result = check([pdf('Missing.pdf', 1), pdf('Main Contract.pdf', 1)]);
    expect(result.sources).toHaveLength(1);
    expect(result.problems).toEqual([{ type: 'source', reason: '"Missing.pdf" is not a loaded document.' }]);
  });

  it('drops a PDF page outside the document and a PDF source without a page', () => {
    const result = check([pdf('Main Contract.pdf', 4), pdf('Main Contract.pdf', 0), pdf('Main Contract.pdf', null)]);
    expect(result.sources).toEqual([]);
    expect(result.problems).toEqual([
      { type: 'source', reason: 'contracts/Main Contract.pdf has 3 pages, so page 4 does not exist.' },
      { type: 'source', reason: 'contracts/Main Contract.pdf has 3 pages, so page 0 does not exist.' },
      { type: 'source', reason: 'contracts/Main Contract.pdf is a PDF, so its source needs a page number.' },
      { type: 'no_source' },
    ]);
  });

  it('drops a sheet the workbook does not have and names the sheets it has', () => {
    const result = check([excel('BOQ Phase 1.xlsx', 'Bill 9', 5, 5), excel('BOQ Phase 1.xlsx', null, 5, 5)]);
    expect(result.problems).toEqual([
      { type: 'source', reason: 'boq/BOQ Phase 1.xlsx has no sheet "Bill 9"; its sheets are Bill 1, Bill 2.' },
      { type: 'source', reason: 'boq/BOQ Phase 1.xlsx is a workbook, so its source needs a sheet name; its sheets are Bill 1, Bill 2.' },
      { type: 'no_source' },
    ]);
  });

  it('matches a sheet ignoring case, uses the only sheet when none is given and orders the rows', () => {
    const result = check([excel('BOQ Phase 1.xlsx', ' bill 2 ', 12, 7), excel('Ledger.xlsx', null, 20, null)]);
    expect(result.problems).toEqual([]);
    expect(result.sources).toEqual([
      { kind: 'excel', document: 'boq/BOQ Phase 1.xlsx', sheet: 'Bill 2', rowFrom: 7, rowTo: 12 },
      { kind: 'excel', document: 'boq/Ledger.xlsx', sheet: 'Ledger', rowFrom: 20, rowTo: 20 },
    ]);
  });

  it('drops Excel sources without rows or with rows before 1', () => {
    const result = check([excel('Ledger.xlsx', 'Ledger', null, null), excel('Ledger.xlsx', 'Ledger', 0, 4)]);
    expect(result.problems).toEqual([
      { type: 'source', reason: 'The source in boq/Ledger.xlsx, sheet Ledger, needs row_from and row_to.' },
      { type: 'source', reason: 'Rows start at 1, so row 0 of boq/Ledger.xlsx, sheet Ledger, does not exist.' },
      { type: 'no_source' },
    ]);
  });

  it('drops unreadable and unsupported files', () => {
    const result = check([pdf('locked.pdf', 1), pdf('notes.docx', 1)]);
    expect(result.problems).toEqual([
      { type: 'source', reason: 'locked.pdf could not be read, so it cannot be a source.' },
      { type: 'source', reason: 'notes.docx could not be read, so it cannot be a source.' },
      { type: 'no_source' },
    ]);
  });

  it('adds the attached result sources and removes repeats', () => {
    const { index, session } = setup();
    const saved = session.saveResult({
      title: 'Bill 1',
      columns: ['item_code', 'amount'],
      rows: [['A1', 1000]],
      sources: [
        { kind: 'excel', document: 'boq/BOQ Phase 1.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 5 },
        { kind: 'pdf', document: 'contracts/Main Contract.pdf', page: 3, quote: null },
      ],
      tool: 'query_tables',
      detail: 'SELECT ...',
    });
    const result = checkSources({ index, session, kind: 'answer', sources: [pdf('Main Contract.pdf', 3, 'Retention')], resultId: saved.id });
    expect(result.result).toBe(saved);
    expect(result.problems).toEqual([]);
    expect(result.sources).toEqual([
      { kind: 'pdf', document: 'contracts/Main Contract.pdf', page: 3, quote: 'Retention' },
      { kind: 'excel', document: 'boq/BOQ Phase 1.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 5 },
    ]);
  });

  it('lists at most 25 sources, merging the closest rows of a result that cites many', () => {
    const { index, session } = setup();
    // Items on every other row from 5 to 63: 30 single-row ranges on one sheet.
    const rows = Array.from({ length: 30 }, (_, i) => 5 + 2 * i);
    const saved = session.saveResult({
      title: 'Items',
      columns: ['item_code', '_row'],
      rows: rows.map((row) => [`A${row}`, row]),
      sources: rows.map((row) => ({ kind: 'excel', document: 'boq/BOQ Phase 1.xlsx', sheet: 'Bill 1', rowFrom: row, rowTo: row })),
      tool: 'query_tables',
      detail: 'SELECT ...',
    });
    const result = checkSources({ index, session, kind: 'answer', sources: [pdf('Main Contract.pdf', 3)], resultId: saved.id });

    expect(result.sources).toHaveLength(25);
    expect(result.sources[0]).toEqual({ kind: 'pdf', document: 'contracts/Main Contract.pdf', page: 3, quote: null });
    const ranges = result.sources.flatMap((source) => (source.kind === 'excel' ? [source] : []));
    expect(rows.every((row) => ranges.some((range) => range.rowFrom <= row && row <= range.rowTo))).toBe(true);
    expect(session.result(saved.id)?.sources).toHaveLength(30);
  });

  it('rejects a result_id that is not saved in the session', () => {
    const result = check([pdf('Main Contract.pdf', 1)], { resultId: 'r9' });
    expect(result.result).toBeNull();
    expect(result.problems).toEqual([{ type: 'result', resultId: 'r9' }]);
  });

  it('asks for a source only when the answer is of kind answer', () => {
    expect(check([]).problems).toEqual([{ type: 'no_source' }]);
    expect(check([], { kind: 'not_found' }).problems).toEqual([]);
  });

  it('cuts long quotes', () => {
    const [source] = check([pdf('Main Contract.pdf', 1, 'word '.repeat(100))]).sources;
    expect(source?.kind === 'pdf' && source.quote?.length).toBe(300);
    expect(source?.kind === 'pdf' && source.quote?.endsWith('…')).toBe(true);
  });
});

describe('requireSources', () => {
  it('turns an answer with no valid source into not found, naming unreadable files', () => {
    const { index } = setup();
    expect(requireSources(index, { kind: 'answer', language: 'en', markdown: 'It is SAR 5.' }, [])).toEqual({
      kind: 'not_found',
      markdown: 'Not found in the loaded documents.',
      unreadableFiles: ['broken.pdf', 'locked.pdf'],
    });
  });

  it('writes the not found text in Arabic for an Arabic answer', () => {
    const { index } = setup();
    expect(requireSources(index, { kind: 'answer', language: 'ar', markdown: 'الإجمالي' }, []).markdown).toBe(
      'لم أجد ذلك في المستندات المحمّلة.',
    );
  });

  it('keeps the model text of a not found answer and still names unreadable files', () => {
    const { index } = setup();
    const markdown = 'The documents do not state a retention release date.';
    expect(requireSources(index, { kind: 'not_found', language: 'en', markdown }, [])).toEqual({
      kind: 'not_found',
      markdown,
      unreadableFiles: ['broken.pdf', 'locked.pdf'],
    });
    expect(requireSources(index, { kind: 'not_found', language: 'en', markdown: '  ' }, []).markdown).toBe(
      'Not found in the loaded documents.',
    );
  });

  it('leaves sourced answers and out of scope answers alone', () => {
    const { index } = setup();
    const source = { kind: 'pdf' as const, document: 'contracts/Main Contract.pdf', page: 1, quote: null };
    expect(requireSources(index, { kind: 'answer', language: 'en', markdown: 'Yes.' }, [source])).toEqual({
      kind: 'answer',
      markdown: 'Yes.',
      unreadableFiles: [],
    });
    expect(requireSources(index, { kind: 'out_of_scope', language: 'en', markdown: 'I only read the documents.' }, [])).toEqual({
      kind: 'out_of_scope',
      markdown: 'I only read the documents.',
      unreadableFiles: [],
    });
  });
});

describe('unreadableFiles', () => {
  it('lists corrupt, encrypted and too large files, not scanned, empty or skipped ones', () => {
    const { index } = setup();
    index.save({ ...pdfRecord('scan.pdf', ['']), status: 'scanned' });
    index.save({ ...pdfRecord('huge.pdf', []), status: 'too_large' });
    index.save({ ...excelRecord('blank.xlsx', []), status: 'empty' });
    expect(unreadableFiles(index)).toEqual(['broken.pdf', 'huge.pdf', 'locked.pdf']);
  });

  it('rejects an empty file as a source, saying it is empty', () => {
    const { index, session } = setup();
    index.save({ ...excelRecord('blank.xlsx', []), status: 'empty' });
    const { problems } = checkSources({ index, session, kind: 'answer', sources: [excel('blank.xlsx', null, 1, 1)], resultId: null });
    expect(problems).toContainEqual({ type: 'source', reason: 'blank.xlsx is empty, so it cannot be a source.' });
  });
});
