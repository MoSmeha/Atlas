import { describe, expect, it } from 'vitest';
import type { FileKind, FileStatus } from '@atlas/shared';
import type { DocumentRecord } from '../../../src/application/ports/DocumentIndex';
import { listDocuments, type ListDocumentsOutput } from '../../../src/application/tools/listDocuments';
import { tools } from '../../../src/application/tools/registry';
import { FakeIndex } from '../../fakes/FakeIndex';
import { boqTable, excelRecord, pdfRecord } from '../../fakes/records';
import { makeToolContext } from '../../fakes/toolContext';

function failedRecord(path: string, kind: FileKind, status: FileStatus, statusDetail: string): DocumentRecord {
  return { ...pdfRecord(path, []), kind, status, statusDetail, pageCount: null, language: null };
}

async function run(index: FakeIndex) {
  const result = await listDocuments.run({}, makeToolContext({ index }));
  return { output: result.output as ListDocumentsOutput, summary: result.summary };
}

describe('list_documents', () => {
  it('lists each document with its tables and columns, sorted by path', async () => {
    const index = new FakeIndex();
    index.save(pdfRecord('contracts/Main Contract.pdf', ['Scope', 'Payment terms']));
    index.save(excelRecord('BOQ_Phase2.xlsx', [boqTable([['A1', 'Piles', 10, 200000, 2000000]])]));

    const { output } = await run(index);

    expect(output.documents.map((doc) => doc.path)).toEqual(['BOQ_Phase2.xlsx', 'contracts/Main Contract.pdf']);
    expect(output.documents[0]).toEqual({
      name: 'BOQ_Phase2.xlsx',
      path: 'BOQ_Phase2.xlsx',
      kind: 'excel',
      status: 'ok',
      statusDetail: null,
      classification: null,
      pageCount: null,
      sheets: ['Bill 1'],
      scannedPages: [],
      tables: [
        {
          sqlName: 'boq_phase2_1',
          title: 'Bill of Quantities',
          sheet: 'Bill 1',
          pages: null,
          columns: [
            { name: 'item_code', label: 'Item', type: 'text' },
            { name: 'description', label: 'Description', type: 'text' },
            { name: 'quantity', label: 'Qty', type: 'number' },
            { name: 'rate', label: 'Rate', type: 'number' },
            { name: 'amount', label: 'Amount', type: 'number' },
          ],
          rowCount: 1,
          currency: 'SAR',
        },
      ],
      currencies: ['SAR'],
      language: 'en',
    });
    expect(output.documents[1]).toMatchObject({ kind: 'pdf', pageCount: 2, sheets: [], tables: [] });
  });

  it('counts readable, empty, unreadable and skipped files and says so in the summary', async () => {
    const index = new FakeIndex();
    index.save(pdfRecord('a.pdf', ['text']));
    index.save({ ...pdfRecord('scan.pdf', ['']), status: 'scanned', scannedPages: [1] });
    index.save(failedRecord('blank.xlsx', 'excel', 'empty', 'The workbook opens, but every sheet is empty.'));
    index.save(failedRecord('broken.pdf', 'pdf', 'corrupt', 'The file is damaged and could not be opened.'));
    index.save(failedRecord('locked.pdf', 'pdf', 'encrypted', 'The file is password protected.'));
    index.save(failedRecord('notes.docx', 'other', 'skipped', 'Only PDF and Excel files are read.'));

    const { output, summary } = await run(index);

    expect(output.counts).toEqual({ total: 6, ready: 2, empty: 1, unreadable: 2, skipped: 1 });
    expect(summary).toBe('6 documents: 2 readable, 1 empty, 2 unreadable, 1 skipped');
    expect(output.documents.find((doc) => doc.name === 'locked.pdf')).toMatchObject({
      status: 'encrypted',
      statusDetail: 'The file is password protected.',
    });
  });

  it('shows the classification type and a rounded confidence when the document has one', async () => {
    const index = new FakeIndex();
    index.save(excelRecord('BOQ.xlsx', [boqTable([['A1', 'Piles', 10, 200000, 2000000]])]));
    index.save(pdfRecord('letter.pdf', ['Dear Sir']));
    index.setClassification('BOQ.xlsx', {
      type: 'BOQ',
      confidence: 0.91666,
      metadata: { projectName: 'Tower', parties: [], contractValue: { amount: 5, currency: 'SAR' }, keyDates: [] },
    });

    const { output } = await run(index);

    expect(output.documents[0]?.classification).toEqual({ type: 'BOQ', confidence: 0.92 });
    expect(output.documents[1]?.classification).toBeNull();
    expect(JSON.stringify(output)).not.toContain('Tower');
  });

  it('collapses scanned pages into ranges and gives PDF tables their pages', async () => {
    const index = new FakeIndex();
    const pdfTable = { ...boqTable([['B1', 'Rebar', 5, 3000, 15000]]), sheet: null, pageFrom: 4, pageTo: 6 };
    index.save({
      ...pdfRecord('specs/Spec.pdf', Array.from({ length: 12 }, (_, i) => `page ${i + 1}`)),
      scannedPages: [1, 2, 3, 9],
      tables: [pdfTable],
    });

    const [doc] = (await run(index)).output.documents;

    expect(doc?.scannedPages).toEqual([
      { from: 1, to: 3 },
      { from: 9, to: 9 },
    ]);
    expect(doc?.tables[0]).toMatchObject({ sqlName: 'spec_1', sheet: null, pages: { from: 4, to: 6 } });
  });

  it('reports an empty folder plainly', async () => {
    const { output, summary } = await run(new FakeIndex());
    expect(output).toEqual({ counts: { total: 0, ready: 0, empty: 0, unreadable: 0, skipped: 0 }, documents: [] });
    expect(summary).toBe('No documents in the loaded folder');
  });

  it('takes no arguments and refuses unknown ones', () => {
    expect(listDocuments.parameters.safeParse({}).success).toBe(true);
    expect(listDocuments.parameters.safeParse({ folder: 'x' }).success).toBe(false);
  });

  it('is registered under its name', () => {
    expect(tools.filter((tool) => tool.name === 'list_documents')).toEqual([listDocuments]);
  });
});
