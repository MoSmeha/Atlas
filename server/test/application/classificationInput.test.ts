import { describe, expect, it } from 'vitest';
import { MAX_CLASSIFICATION_CHARS, classificationInput } from '../../src/application/indexing/classificationInput';
import type { DocumentRecord } from '../../src/application/ports/DocumentIndex';
import { FakeIndex } from '../fakes/FakeIndex';
import { boqTable, excelRecord, pdfRecord } from '../fakes/records';

function indexed(record: DocumentRecord) {
  const index = new FakeIndex();
  index.save(record);
  const document = index.find(record.path);
  if (document === null) throw new Error('record not saved');
  return { index, document };
}

describe('classificationInput', () => {
  it('reads only the first three pages of a PDF', () => {
    const { index, document } = indexed(
      pdfRecord('Contract.pdf', ['AGREEMENT between Al Noor and Gulf Build', 'Recitals', 'Definitions', 'PAGE FOUR TEXT', 'PAGE FIVE TEXT']),
    );
    const input = classificationInput(document, index) ?? '';

    expect(input).toContain('File: Contract.pdf');
    expect(input).toContain('--- Page 1 ---\nAGREEMENT between Al Noor and Gulf Build');
    expect(input).toContain('--- Page 3 ---\nDefinitions');
    expect(input).not.toContain('PAGE FOUR');
    expect(input).not.toContain('PAGE FIVE');
  });

  it('caps the text it sends', () => {
    const long = 'concrete '.repeat(2_000);
    const { index, document } = indexed(pdfRecord('Spec.pdf', [long, long, long]));
    expect(classificationInput(document, index)?.length).toBe(MAX_CLASSIFICATION_CHARS);
  });

  it('is null when the opening pages hold no text', () => {
    const { index, document } = indexed(pdfRecord('Blank.pdf', ['  ', '', '\n']));
    expect(classificationInput(document, index)).toBeNull();
  });

  it('describes a workbook by its sheet names and table titles and headers, not its data rows', () => {
    const table = { ...boqTable([['1.01', 'Site clearance', 8400, 6.5, 54_600], ['1.02', 'DEEP DATA ROW', 10, 2, 20]]), title: 'Riyadh Tower Bill 1' };
    const record: DocumentRecord = {
      ...excelRecord('BOQ_Rev1.xlsx', [table]),
      sheets: ['Summary', 'Bill 1'],
      sheetRows: [
        { sheet: 'Summary', rows: [{ rowNumber: 1, cells: ['Riyadh Tower', null, 'Rev 1'] }] },
        {
          sheet: 'Bill 1',
          rows: [
            { rowNumber: 1, cells: ['Riyadh Tower Bill 1'] },
            { rowNumber: 2, cells: [null, null] },
            { rowNumber: 4, cells: ['Item', 'Description', 'Qty', 'Rate', 'Amount'] },
            { rowNumber: 20, cells: ['9.99', 'FAR BELOW THE TOP', 1, 1, 1] },
          ],
        },
      ],
    };
    const { index, document } = indexed(record);
    const input = classificationInput(document, index) ?? '';

    expect(input).toContain('Sheets: Summary, Bill 1');
    expect(input).toContain('Table on sheet "Bill 1", title "Riyadh Tower Bill 1", currency SAR, 2 rows, columns: Item | Description | Qty | Rate | Amount');
    expect(input).toContain('Sheet "Summary", no table, top rows:\nrow 1: Riyadh Tower | Rev 1');
    expect(input).not.toContain('Sheet "Bill 1", no table');
    expect(input).not.toContain('Site clearance');
    expect(input).not.toContain('DEEP DATA ROW');
    expect(input).not.toContain('FAR BELOW THE TOP');
  });

  it('shows only the top rows of a sheet with no table', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ rowNumber: i + 1, cells: [`Note line ${i + 1}`, null] }));
    const record: DocumentRecord = { ...excelRecord('Notes.xlsx', []), sheets: ['Cover'], sheetRows: [{ sheet: 'Cover', rows }] };
    const { index, document } = indexed(record);
    const input = classificationInput(document, index) ?? '';

    expect(input).toContain('row 1: Note line 1');
    expect(input).toContain('row 5: Note line 5');
    expect(input).not.toContain('Note line 6');
  });

  it('is null for a workbook with no sheets', () => {
    const { index, document } = indexed({ ...excelRecord('Empty.xlsx', []), sheets: [] });
    expect(classificationInput(document, index)).toBeNull();
  });
});
