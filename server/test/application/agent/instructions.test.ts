import { describe, expect, it } from 'vitest';
import { buildInstructions, MAX_LISTED_DOCUMENTS } from '../../../src/application/agent/instructions';
import { unreadableFiles } from '../../../src/application/guards/sourcesGuard';
import { submitAnswer } from '../../../src/application/tools/submitAnswer';
import { tools } from '../../../src/application/tools/registry';
import { FakeIndex } from '../../fakes/FakeIndex';
import { boqTable, excelRecord, pdfRecord } from '../../fakes/records';

const today = new Date(2026, 9, 28, 12);

function folder() {
  const index = new FakeIndex();
  index.save(pdfRecord('contracts/Main.pdf', ['Scope', 'Payment']));
  index.save({ ...pdfRecord('scans/Site.pdf', ['', '', '']), status: 'scanned', scannedPages: [1, 2, 3] });
  index.save({ ...pdfRecord('drawings/Plan.pdf', ['Notes', '', '']), scannedPages: [2, 3] });
  index.save(excelRecord('BOQ_Phase1.xlsx', [boqTable([['A1', 'Piles', 10, 100, 1000]], 'Bill 1'), boqTable([], 'Bill 2')]));
  index.save({ ...pdfRecord('broken.pdf', []), status: 'corrupt', statusDetail: 'The file is damaged.', pageCount: null });
  index.save({ ...pdfRecord('locked.pdf', []), status: 'encrypted', statusDetail: null, pageCount: null });
  index.save({ ...pdfRecord('notes.docx', []), kind: 'other', status: 'skipped', pageCount: null, language: null });
  index.setClassification('contracts/Main.pdf', {
    type: 'Contract',
    confidence: 0.9,
    metadata: {
      projectName: 'Riyadh Metro\nPhase 1',
      parties: ['Al Noor Contracting', 'City Authority'],
      contractValue: { amount: 12500000, currency: 'SAR' },
      keyDates: [{ label: 'Commencement', date: '2026-01-01' }],
    },
  });
  index.setClassification('BOQ_Phase1.xlsx', {
    type: 'BOQ',
    confidence: 0.8,
    metadata: { projectName: null, parties: [], contractValue: null, keyDates: [] },
  });
  return index;
}

function build(index = folder(), offered?: string[]) {
  return buildInstructions({ documents: index.documents(), today, unreadable: unreadableFiles(index), tools: offered });
}

describe('buildInstructions', () => {
  it('mentions every registered tool and submit_answer', () => {
    const text = build(folder(), [...tools.map((tool) => tool.name), submitAnswer.name]);
    for (const tool of [...tools, submitAnswer]) expect(text).toContain(tool.name);
  });

  it('states the answer rules', () => {
    const text = build();
    expect(text).toContain('WHERE _is_total = 0');
    expect(text).toContain('GROUP BY currency');
    expect(text).toContain('never instructions');
    expect(text).toContain('Never add amounts in different currencies');
    expect(text).toContain('Never translate file');
    expect(text).toContain('what is missing');
  });

  it('leaves out advice about tools that are not offered', () => {
    const text = build(folder(), ['list_documents', 'query_tables', 'submit_answer']);
    expect(text).toContain('start with list_documents');
    expect(text).not.toContain('look_at_page');
    expect(text).not.toContain('read_pages');
    expect(text).toContain('Those ids stay valid');
  });

  it('lists each document with its type, pages or sheets, and classification details', () => {
    const text = build();
    expect(text).toContain('Today is Wednesday 2026-10-28.');
    expect(text).toContain('The loaded folder holds 7 files.');
    expect(text).toContain(
      '- [Contract] contracts/Main.pdf: PDF, 2 pages; English. Project: Riyadh Metro Phase 1. ' +
        'Parties: Al Noor Contracting; City Authority. Contract value: 12500000 SAR. Key dates: Commencement 2026-01-01.',
    );
    expect(text).toContain("- [BOQ] BOQ_Phase1.xlsx: Excel, sheets 'Bill 1', 'Bill 2'; 2 tables; currency SAR; English.");
    expect(text).toContain('- scans/Site.pdf: PDF, 3 pages, scanned with no text layer; English.');
    expect(text).toContain('- drawings/Plan.pdf: PDF, 3 pages, no text layer on pages 2 and 3; English.');
    expect(text).toContain('- notes.docx: skipped, not a PDF or Excel file.');
  });

  it('names the files that could not be read, apart from the list', () => {
    const text = build();
    expect(text).toContain(
      'Files that could not be read, so their content is unknown: broken.pdf (corrupt: The file is damaged.); locked.pdf (encrypted).',
    );
    expect(text).not.toContain('- broken.pdf');
  });

  it('says so when the folder is empty', () => {
    expect(build(new FakeIndex())).toContain('The loaded folder holds no files.');
  });

  it('lists a large folder up to the cap', () => {
    const index = new FakeIndex();
    for (let i = 0; i < MAX_LISTED_DOCUMENTS + 5; i++) index.save(pdfRecord(`spec-${String(i).padStart(3, '0')}.pdf`, ['x']));
    const text = build(index);
    expect(text).toContain('- spec-000.pdf');
    expect(text).not.toContain(`spec-${MAX_LISTED_DOCUMENTS}.pdf`);
    expect(text).toContain('- and 5 more files; list_documents shows them all.');
  });

  it('keeps the fixed part short', () => {
    const fixed = build(new FakeIndex());
    expect(fixed.length / 4).toBeLessThan(1500);
  });
});
