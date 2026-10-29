import type { DocumentSummary } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { speechKeywords } from '../../src/domain/speechKeywords';

function doc(parts: Partial<DocumentSummary> & { path: string }): DocumentSummary {
  return {
    id: parts.path,
    name: parts.path,
    kind: 'excel',
    status: 'ok',
    statusDetail: null,
    sizeBytes: 1,
    pageCount: null,
    scannedPages: [],
    sheets: [],
    tables: [],
    currencies: [],
    language: 'en',
    classification: null,
    ...parts,
  };
}

const classified = (projectName: string | null, parties: string[]) => ({
  type: 'Contract' as const,
  confidence: 0.9,
  metadata: { projectName, parties, contractValue: null, keyDates: [] },
});

describe('speechKeywords', () => {
  it('names files without extensions, then projects and parties, then sheets', () => {
    const documents = [
      doc({ path: 'Bills/BOQ-Phase1.xlsx', sheets: ['Bill 1', 'Summary'] }),
      doc({ path: 'Contract Main.pdf', kind: 'pdf', classification: classified('Riyadh Tower', ['Al Noor Contracting', 'Atlas Developers']) }),
    ];
    expect(speechKeywords(documents)).toEqual([
      'BOQ-Phase1',
      'Contract Main',
      'Riyadh Tower',
      'Al Noor Contracting',
      'Atlas Developers',
      'Bill 1',
      'Summary',
    ]);
  });

  it('keeps each term once ignoring case, and skips files that could not be read', () => {
    const documents = [
      doc({ path: 'BOQ.xlsx', sheets: ['boq', 'Bill 1'] }),
      doc({ path: 'Locked.pdf', kind: 'pdf', status: 'encrypted' }),
      doc({ path: 'Scan.pdf', kind: 'pdf', status: 'scanned' }),
    ];
    expect(speechKeywords(documents)).toEqual(['BOQ', 'Scan', 'Bill 1']);
  });

  it('drops line breaks and angle brackets, bare numbers, and terms too short or too long', () => {
    const documents = [doc({ path: '2026.xlsx', sheets: ['<Bill\n2>', 'A', '12,500', 'x'.repeat(61), 'جدول الكميات'] })];
    expect(speechKeywords(documents)).toEqual(['Bill 2', 'جدول الكميات']);
  });

  it('stops at the limit', () => {
    const documents = Array.from({ length: 10 }, (_, i) => doc({ path: `File ${i}.pdf` }));
    expect(speechKeywords(documents, 3)).toEqual(['File 0', 'File 1', 'File 2']);
  });
});
