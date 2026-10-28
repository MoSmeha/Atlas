import { describe, expect, it } from 'vitest';
import { findDocument } from '../../../src/application/tools/findDocument';
import { ToolError } from '../../../src/application/tools/Tool';
import { FakeIndex } from '../../fakes/FakeIndex';
import { boqTable, excelRecord, pdfRecord } from '../../fakes/records';

const HINT = 'Use one of these names.';

function indexWith(...paths: string[]): FakeIndex {
  const index = new FakeIndex();
  for (const path of paths) {
    index.save(path.endsWith('.pdf') ? pdfRecord(path, ['text']) : excelRecord(path, [boqTable([['A1', 'Piles', 1, 1, 1]])]));
  }
  return index;
}

function failure(index: FakeIndex, name: string): ToolError {
  try {
    findDocument(index, name, HINT);
  } catch (error) {
    if (error instanceof ToolError) return error;
    throw error;
  }
  throw new Error(`expected "${name}" not to match`);
}

describe('findDocument', () => {
  it('matches a file name or a path, ignoring case and surrounding spaces', () => {
    const index = indexWith('contracts/Main Contract.pdf', 'BOQ.xlsx');
    expect(findDocument(index, 'main contract.PDF', HINT).path).toBe('contracts/Main Contract.pdf');
    expect(findDocument(index, ' contracts/Main Contract.pdf ', HINT).path).toBe('contracts/Main Contract.pdf');
  });

  it('matches a name given without its extension when only one document fits', () => {
    const index = indexWith('contracts/Main Contract.pdf', 'BOQ_Phase2.xlsx', 'Spec Rev 2.1.pdf');
    expect(findDocument(index, 'Main Contract', HINT).path).toBe('contracts/Main Contract.pdf');
    expect(findDocument(index, 'contracts/main contract', HINT).path).toBe('contracts/Main Contract.pdf');
    expect(findDocument(index, 'boq_phase2', HINT).path).toBe('BOQ_Phase2.xlsx');
    expect(findDocument(index, 'Spec Rev 2.1', HINT).path).toBe('Spec Rev 2.1.pdf');
  });

  it('refuses to guess between documents that share a name without extension', () => {
    const error = failure(indexWith('BOQ.pdf', 'BOQ.xlsx'), 'BOQ');
    expect(error.message).toBe('No loaded document matches "BOQ". Loaded documents: BOQ.pdf, BOQ.xlsx. Use one of these names.');
  });

  it('lists the loaded documents, sorted, and ends with the hint', () => {
    const error = failure(indexWith('specs/Spec.pdf', 'BOQ.xlsx', 'contracts/Main.pdf'), 'Contract.pdf');
    expect(error.message).toBe(
      'No loaded document matches "Contract.pdf". Loaded documents: BOQ.xlsx, contracts/Main.pdf, specs/Spec.pdf. ' +
        'Use one of these names.',
    );
  });

  it('lists only the first 30 of a large folder and points at list_documents', () => {
    const paths = Array.from({ length: 45 }, (_, i) => `file${String(i + 1).padStart(2, '0')}.pdf`);
    const { message } = failure(indexWith(...paths), 'missing.pdf');
    expect(message).toContain('Loaded documents (first 30 of 45; list_documents has them all): file01.pdf,');
    expect(message).toContain('file30.pdf.');
    expect(message).not.toContain('file31.pdf');
    expect(message.endsWith(HINT)).toBe(true);
  });

  it('says so when no documents are loaded', () => {
    expect(failure(new FakeIndex(), 'Main.pdf').message).toBe('No loaded document matches "Main.pdf": no documents are loaded.');
  });
});
