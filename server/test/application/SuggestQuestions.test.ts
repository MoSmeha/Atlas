import type { Classification, DocumentSummary, DocumentType, TableColumn, TableSummary } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { SUGGESTION_COUNT, suggest as suggestBoth } from '../../src/application/indexing/SuggestQuestions';

/** The English side, which most checks read. */
const suggest = (documents: readonly DocumentSummary[]) => suggestBoth(documents).map((question) => question.en);

function doc(path: string, overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  const name = path.split('/').pop() ?? path;
  return {
    id: path,
    name,
    path,
    kind: name.endsWith('.pdf') ? 'pdf' : name.endsWith('.xlsx') ? 'excel' : 'other',
    status: 'ok',
    statusDetail: null,
    sizeBytes: 1000,
    pageCount: null,
    scannedPages: [],
    sheets: [],
    tables: [],
    currencies: [],
    language: 'en',
    classification: null,
    ...overrides,
  };
}

const column = (name: string, label = name): TableColumn => ({ name, label, type: 'text' });

function table(columns: TableColumn[], currency: string | null = 'SAR', rowCount = 20): TableSummary {
  return { name: 't', title: null, sheet: 'Sheet1', pageFrom: null, pageTo: null, columns, rowCount, currency };
}

const priced = (currency: string | null = 'SAR') =>
  table([column('item_code', 'Item'), column('description'), column('quantity', 'Qty'), column('rate'), column('amount')], currency);

const classified = (type: DocumentType): Classification => ({
  type,
  confidence: 0.9,
  metadata: { projectName: null, parties: [], contractValue: null, keyDates: [] },
});

/** The demo folder as the index lists it after reading, before classification. */
const sampleFolder = (): DocumentSummary[] => [
  doc('Blank_Template.xlsx', { status: 'empty', language: null }),
  doc('BOQ_Phase1_Rev0.xlsx', { tables: [table([column('description'), column('amount')]), priced()], currencies: ['SAR'] }),
  doc('BOQ_Phase1_Rev1.xlsx', { tables: [priced()], currencies: ['SAR'] }),
  doc('BOQ_Phase2_Facade.pdf', { tables: [priced()], currencies: ['SAR'] }),
  doc('Contract_Main_Works.pdf', { currencies: ['SAR'] }),
  doc('Cost_Ledger_10k.xlsx', { tables: [table([column('date'), column('amount')], 'SAR', 10_000)], currencies: ['SAR'] }),
  doc('Cover_Letter.docx', { status: 'skipped', language: null }),
  doc('Drawing_Register.pdf', { status: 'corrupt', language: null }),
  doc('Equipment_Imports.xlsx', { tables: [priced('USD'), priced('EUR'), priced('AED')], currencies: ['USD', 'EUR', 'AED'] }),
  doc('Meeting_Minutes_07_AR.pdf', { language: 'ar', currencies: ['SAR'] }),
  doc('Programme_Milestones.xlsx', { tables: [table([column('id'), column('planned_start', 'Planned Start')], null)] }),
  doc('Site_Survey_Scanned.pdf', { status: 'scanned', scannedPages: [1], language: null }),
  doc('Tender_Addendum_03.pdf', { status: 'encrypted', language: null }),
];

describe('suggest', () => {
  it('leads with the BOQ questions, the revisions and the contract for the demo folder', () => {
    expect(suggest(sampleFolder())).toEqual([
      'What is the total of each BOQ?',
      'List all cost items above SAR 1 million',
      'Check the BOQ arithmetic for errors',
      'What changed between BOQ_Phase1_Rev0.xlsx and BOQ_Phase1_Rev1.xlsx?',
      'Summarize the scope of work in Contract_Main_Works.pdf',
    ]);
  });

  it('writes each question in Arabic too, with the file names and currency code as they are', () => {
    expect(suggestBoth(sampleFolder()).map((question) => question.ar)).toEqual([
      'ما مجموع كل جدول كميات؟',
      'اعرض كل بنود التكلفة التي تزيد على 1,000,000 SAR',
      'تحقق من أخطاء الحساب في جداول الكميات',
      'ما الذي تغيّر بين BOQ_Phase1_Rev0.xlsx وBOQ_Phase1_Rev1.xlsx؟',
      'لخّص نطاق العمل في Contract_Main_Works.pdf',
    ]);
  });

  it('gives the same five whatever order the documents come in', () => {
    const folder = sampleFolder();
    expect(suggest(folder.toReversed())).toEqual(suggest(folder));
    expect(suggest([...folder.slice(5), ...folder.slice(0, 5)])).toEqual(suggest(folder));
  });

  it('asks no BOQ question when the folder holds no BOQ', () => {
    const questions = suggest([
      doc('Contract_Main_Works.pdf'),
      doc('Meeting_Minutes_07_AR.pdf', { language: 'ar' }),
      doc('Site_Survey_Scanned.pdf', { status: 'scanned', scannedPages: [1], language: null }),
      doc('Drawing_Register.pdf', { status: 'corrupt', language: null }),
    ]);
    expect(questions).toEqual([
      'Summarize the scope of work in Contract_Main_Works.pdf',
      'Extract all dates and deliverables from these documents',
      'What was decided in Meeting_Minutes_07_AR.pdf?',
      'What does Site_Survey_Scanned.pdf show?',
      'Which files could not be read and why?',
    ]);
    expect(questions.join(' ')).not.toMatch(/BOQ/);
  });

  it('asks in English about an Arabic document, by its type when known', () => {
    expect(suggest([doc('report.pdf', { language: 'ar' })])).toContain('What are the main points of report.pdf?');
    expect(suggest([doc('m7.pdf', { language: 'ar', classification: classified('Minutes') })])).toContain('What was decided in m7.pdf?');
    expect(suggest([doc('deal.pdf', { language: 'ar', classification: classified('Contract') })])).toContain('What are the key terms of deal.pdf?');
  });

  it('asks what a scanned document shows, including one with only some scanned pages', () => {
    expect(suggest([doc('Survey.pdf', { status: 'scanned', scannedPages: [1] })])).toEqual([
      'What does Survey.pdf show?',
      'What documents are in this folder and what is each one about?',
      'Who are the parties named in these documents?',
      'What are the key dates in these documents?',
      'Which files could not be read and why?',
    ]);
    expect(suggest([doc('Report.pdf', { scannedPages: [4, 5], pageCount: 9 })])).toContain('What does Report.pdf show?');
  });

  it('asks for totals per currency of a file priced in several currencies', () => {
    const questions = suggest([doc('Equipment.xlsx', { tables: [table([column('amount')], 'USD'), table([column('amount')], 'EUR')] })]);
    expect(questions).toContain('What is the total per currency of Equipment.xlsx?');
    expect(suggest([doc('Spec.pdf', { currencies: ['SAR', 'USD'] })]).join(' ')).not.toMatch(/per currency/);
  });

  it('uses the currency the BOQs are priced in, and names a single BOQ', () => {
    const questions = suggest([doc('Bill.xlsx', { tables: [priced('USD')], currencies: ['USD'] })]);
    expect(questions.slice(0, 3)).toEqual([
      'What is the total of Bill.xlsx?',
      'List all cost items above USD 1 million',
      'Check the BOQ arithmetic for errors',
    ]);
    expect(suggest([doc('Bill.xlsx', { tables: [priced(null)] })])).toContain('List all cost items above 1 million');
  });

  it('counts a document classified as a BOQ even when no priced table was found in it', () => {
    const questions = suggest([doc('Facade.pdf', { classification: classified('BOQ') })]);
    expect(questions[0]).toBe('What is the total of Facade.pdf?');
  });

  it('pairs the latest two revisions of one BOQ, earlier first', () => {
    const questions = suggest([
      doc('BOQ Rev 2.xlsx', { tables: [priced()] }),
      doc('BOQ Rev 0.xlsx', { tables: [priced()] }),
      doc('BOQ Rev 1.xlsx', { tables: [priced()] }),
      doc('Other_Rev3.xlsx', { tables: [table([column('amount')])] }),
    ]);
    expect(questions).toContain('What changed between BOQ Rev 1.xlsx and BOQ Rev 2.xlsx?');
    expect(questions.join(' ')).not.toMatch(/Other_Rev3/);
  });

  it('asks no revision question for BOQs with different stems', () => {
    const questions = suggest([doc('Bill1_Rev0.xlsx', { tables: [priced()] }), doc('Bill2_Rev1.xlsx', { tables: [priced()] })]);
    expect(questions.join(' ')).not.toMatch(/changed between/);
  });

  it('trusts the classification over the file name', () => {
    expect(suggest([doc('Contract_Notes.pdf', { classification: classified('Correspondence') })]).join(' ')).not.toMatch(/scope of work/);
    expect(suggest([doc('Tower_Deal.pdf', { classification: classified('Contract') })])).toContain(
      'Summarize the scope of work in Tower_Deal.pdf',
    );
  });

  it('fills with a threshold question on a large table and the milestones of a programme', () => {
    expect(
      suggest([
        doc('Ledger.xlsx', { tables: [table([column('date'), column('amount')], 'SAR', 10_000)] }),
        doc('Programme.xlsx', { tables: [table([column('milestone'), column('planned_finish', 'Planned Finish')], null)] }),
      ]),
    ).toEqual([
      'How many entries in Ledger.xlsx are above SAR 1 million?',
      'List the milestones in Programme.xlsx with their planned dates',
      'What documents are in this folder and what is each one about?',
      'Who are the parties named in these documents?',
      'What are the key dates in these documents?',
    ]);
  });

  it('names a file by its path when another file has the same name', () => {
    const questions = suggest([doc('phase1/Contract.pdf'), doc('phase2/Contract.pdf')]);
    expect(questions[0]).toBe('Summarize the scope of work in phase1/Contract.pdf');
  });

  it('always gives exactly five different questions, even when nothing could be read', () => {
    for (const folder of [[doc('Broken.pdf', { status: 'corrupt' })], [], sampleFolder()]) {
      const questions = suggest(folder);
      expect(questions).toHaveLength(SUGGESTION_COUNT);
      expect(new Set(questions).size).toBe(SUGGESTION_COUNT);
    }
  });
});
