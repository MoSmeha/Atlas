import type { DocumentSummary } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { documentProblem } from '../../src/features/viewer/documentProblem';

const pdf: DocumentSummary = {
  id: 'contract',
  name: 'Contract_Main_Works.pdf',
  path: 'Contract_Main_Works.pdf',
  kind: 'pdf',
  status: 'ok',
  statusDetail: null,
  sizeBytes: 120_000,
  pageCount: 64,
  scannedPages: [],
  sheets: [],
  tables: [],
  currencies: [],
  language: 'en',
  classification: null,
};
const workbook: DocumentSummary = {
  ...pdf,
  id: 'boq',
  name: 'BOQ_Phase1_Rev1.xlsx',
  path: 'BOQ_Phase1_Rev1.xlsx',
  kind: 'excel',
  pageCount: null,
  sheets: ['Summary', 'Bill 1'],
};

describe('documentProblem', () => {
  it('shows a readable PDF or workbook', () => {
    expect(documentProblem(pdf)).toBeNull();
    expect(documentProblem(workbook)).toBeNull();
  });

  it('still draws a scanned or oversized PDF', () => {
    expect(documentProblem({ ...pdf, status: 'scanned', scannedPages: [1, 2] })).toBeNull();
    expect(documentProblem({ ...pdf, status: 'too_large' })).toBeNull();
  });

  it('gives the server reason for a file it cannot draw', () => {
    const damaged = { ...pdf, status: 'corrupt', statusDetail: 'The PDF ends before its last page.' } as const;
    expect(documentProblem(damaged)).toBe('The PDF ends before its last page.');
  });

  it('falls back to the status reason when the server sent none', () => {
    expect(documentProblem({ ...pdf, status: 'encrypted' })).toBe(
      'The file is password protected, so Atlas cannot read it.',
    );
  });

  it('has nothing to show for a workbook with no sheets read', () => {
    expect(documentProblem({ ...workbook, status: 'too_large', sheets: [] })).toBe(
      'The file is over the size limit, so Atlas did not read it.',
    );
    expect(documentProblem({ ...workbook, sheets: [] })).toBe('Atlas found no sheets in this workbook.');
  });

  it('gives the reason in Arabic, never the English server detail', () => {
    const damaged = { ...pdf, status: 'corrupt', statusDetail: 'The PDF ends before its last page.' } as const;
    expect(documentProblem(damaged, 'ar')).toBe('الملف تالف ولا يمكن فتحه.');
    expect(documentProblem({ ...workbook, sheets: [] }, 'ar')).toBe('لم يجد Atlas أي ورقة في مصنف Excel هذا.');
    expect(documentProblem(pdf, 'ar')).toBeNull();
  });
});
