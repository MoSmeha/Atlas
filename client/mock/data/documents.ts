import type { Classification, DocumentSummary, TableColumn, TableSummary } from '@atlas/shared';
import { type Revision, boqItems } from './boq';

/** Stable short id from the relative path, like the real index (FNV-1a, hex). */
export function documentId(path: string): string {
  let hash = 0x811c9dc5;
  for (const char of path) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `d${hash.toString(16).padStart(8, '0')}`;
}

type Extra = Partial<Omit<DocumentSummary, 'id' | 'name' | 'path' | 'kind'>>;

function doc(path: string, extra: Extra): DocumentSummary {
  const name = path.split('/').pop() ?? path;
  const lower = name.toLowerCase();
  const kind = lower.endsWith('.pdf') ? 'pdf' : lower.endsWith('.xlsx') ? 'excel' : 'other';
  return {
    id: documentId(path),
    name,
    path,
    kind,
    status: 'ok',
    statusDetail: null,
    sizeBytes: 0,
    pageCount: null,
    scannedPages: [],
    sheets: [],
    tables: [],
    currencies: [],
    language: 'en',
    classification: null,
    ...extra,
  };
}

function classified(type: Classification['type'], confidence: number, metadata: Partial<Classification['metadata']> = {}): Classification {
  return {
    type,
    confidence,
    metadata: { projectName: 'Al Nakheel Mixed-Use Tower, Riyadh', parties: [], contractValue: null, keyDates: [], ...metadata },
  };
}

const boqColumns: TableColumn[] = [
  { name: 'item_code', label: 'Item', type: 'text' },
  { name: 'description', label: 'Description', type: 'text' },
  { name: 'unit', label: 'Unit', type: 'text' },
  { name: 'quantity', label: 'Qty', type: 'number' },
  { name: 'rate', label: 'Rate (SAR)', type: 'number' },
  { name: 'amount', label: 'Amount (SAR)', type: 'number' },
];

function boqTables(revision: Revision): TableSummary[] {
  return [
    {
      name: `boq_${revision}_summary`,
      title: 'Summary of Bills',
      sheet: 'Summary',
      pageFrom: null,
      pageTo: null,
      columns: [
        { name: 'bill', label: 'Bill', type: 'text' },
        { name: 'description', label: 'Description', type: 'text' },
        { name: 'amount', label: 'Amount (SAR)', type: 'number' },
      ],
      rowCount: 3,
      currency: 'SAR',
    },
    {
      name: `boq_${revision}_bill_1`,
      title: 'Bill 1 - Substructure',
      sheet: 'Bill 1 - Substructure',
      pageFrom: null,
      pageTo: null,
      columns: boqColumns,
      rowCount: boqItems(revision, 1).length,
      currency: 'SAR',
    },
    {
      name: `boq_${revision}_bill_2`,
      title: 'Bill 2 - Superstructure',
      sheet: 'Bill 2 - Superstructure',
      pageFrom: null,
      pageTo: null,
      columns: boqColumns,
      rowCount: boqItems(revision, 2).length,
      currency: 'SAR',
    },
  ];
}

const parties = ['Al Nakheel Real Estate Development Co.', 'Rawabi Contracting Co. Ltd.'];

/** The canned register: one invented Riyadh tower project, with a file for every status Atlas reports. */
export const projectDocuments: DocumentSummary[] = [
  doc('01 Contract/Contract_Agreement_RUH-NKT.pdf', {
    sizeBytes: 2_840_112,
    pageCount: 64,
    classification: classified('Contract', 0.96, {
      parties,
      contractValue: { amount: 186_450_000, currency: 'SAR' },
      keyDates: [
        { label: 'Commencement', date: '2026-02-01' },
        { label: 'Substantial completion', date: '2028-07-31' },
      ],
    }),
  }),
  doc('02 BOQ/BOQ_Phase2_Rev3.xlsx', {
    sizeBytes: 418_560,
    sheets: ['Summary', 'Bill 1 - Substructure', 'Bill 2 - Superstructure'],
    tables: boqTables('rev3'),
    currencies: ['SAR'],
    classification: classified('BOQ', 0.98, { parties }),
  }),
  doc('02 BOQ/BOQ_Phase2_Rev2.xlsx', {
    sizeBytes: 402_944,
    sheets: ['Summary', 'Bill 1 - Substructure', 'Bill 2 - Superstructure'],
    tables: boqTables('rev2'),
    currencies: ['SAR'],
    classification: classified('BOQ', 0.97, { parties }),
  }),
  doc('02 BOQ/BOQ_Bill3_MEP.pdf', {
    sizeBytes: 911_360,
    pageCount: 6,
    tables: [
      {
        name: 'boq_bill3_mep',
        title: 'Bill 3 - Mechanical, Electrical and Plumbing',
        sheet: null,
        pageFrom: 2,
        pageTo: 5,
        columns: boqColumns,
        rowCount: 64,
        currency: 'SAR',
      },
    ],
    currencies: ['SAR'],
    classification: classified('BOQ', 0.9),
  }),
  doc('02 BOQ/BOQ_Template_Empty.xlsx', {
    status: 'empty',
    statusDetail: 'The workbook has no data in any sheet.',
    sizeBytes: 6_144,
    sheets: ['Sheet1'],
    language: null,
  }),
  doc('03 Specifications/Technical_Specification_Div03_Concrete.pdf', {
    sizeBytes: 9_604_221,
    pageCount: 312,
    classification: classified('Specification', 0.93),
  }),
  doc('04 Programme/Baseline_Programme_Rev1.xlsx', {
    sizeBytes: 96_512,
    sheets: ['Programme'],
    tables: [
      {
        name: 'programme_rev1',
        title: 'Baseline Programme',
        sheet: 'Programme',
        pageFrom: null,
        pageTo: null,
        columns: [
          { name: 'activity_id', label: 'Activity ID', type: 'text' },
          { name: 'activity', label: 'Activity', type: 'text' },
          { name: 'start', label: 'Start', type: 'text' },
          { name: 'finish', label: 'Finish', type: 'text' },
          { name: 'duration_days', label: 'Duration (days)', type: 'integer' },
        ],
        rowCount: 12,
        currency: null,
      },
    ],
    classification: classified('Schedule', 0.91, {
      keyDates: [{ label: 'Substructure complete', date: '2026-11-26' }],
    }),
  }),
  doc('05 Commercial/Supplier_Quotations.xlsx', {
    sizeBytes: 54_272,
    sheets: ['Quotes'],
    tables: [
      {
        name: 'supplier_quotes',
        title: 'Supplier Quotations',
        sheet: 'Quotes',
        pageFrom: null,
        pageTo: null,
        columns: [
          { name: 'supplier', label: 'Supplier', type: 'text' },
          { name: 'item', label: 'Item', type: 'text' },
          { name: 'currency', label: 'Currency', type: 'text' },
          { name: 'amount', label: 'Amount', type: 'number' },
        ],
        rowCount: 9,
        currency: null,
      },
    ],
    currencies: ['SAR', 'USD', 'EUR'],
    language: 'mixed',
    classification: classified('Correspondence', 0.64),
  }),
  doc('05 Commercial/General_Ledger_FY2026.xlsx', {
    sizeBytes: 1_288_704,
    sheets: ['Ledger'],
    tables: [
      {
        name: 'general_ledger',
        title: 'General Ledger FY2026',
        sheet: 'Ledger',
        pageFrom: null,
        pageTo: null,
        columns: [
          { name: 'entry_no', label: 'Entry', type: 'integer' },
          { name: 'date', label: 'Date', type: 'text' },
          { name: 'account', label: 'Account', type: 'text' },
          { name: 'description', label: 'Description', type: 'text' },
          { name: 'debit', label: 'Debit (SAR)', type: 'number' },
          { name: 'credit', label: 'Credit (SAR)', type: 'number' },
        ],
        rowCount: 10_000,
        currency: 'SAR',
      },
    ],
    currencies: ['SAR'],
    classification: classified('Other', 0.72),
  }),
  doc('05 Commercial/Bank_Guarantee_Protected.pdf', {
    status: 'encrypted',
    statusDetail: 'The file is password protected, so Atlas cannot read it.',
    sizeBytes: 182_016,
    language: null,
  }),
  doc('06 Minutes/محضر_اجتماع_الموقع_12.pdf', {
    sizeBytes: 305_664,
    pageCount: 4,
    language: 'ar',
    classification: classified('Minutes', 0.89, { keyDates: [{ label: 'Meeting date', date: '2026-09-14' }] }),
  }),
  doc('06 Minutes/Meeting_Notes_Week14.docx', {
    status: 'skipped',
    statusDetail: 'Word files are not read. Save it as PDF to include it.',
    sizeBytes: 38_912,
    language: null,
  }),
  doc('07 Survey/Site_Survey_Scanned.pdf', {
    status: 'scanned',
    statusDetail: 'All 12 pages are scanned images with no text. Atlas can look at a page but cannot search it.',
    sizeBytes: 14_502_400,
    pageCount: 12,
    scannedPages: Array.from({ length: 12 }, (_, i) => i + 1),
    language: null,
  }),
  doc('08 Drawings/Drawing_Register_Corrupt.pdf', {
    status: 'corrupt',
    statusDetail: 'The file is damaged and could not be opened.',
    sizeBytes: 18_204,
    language: null,
  }),
  doc('09 Photos/Site_Photos_Archive.pdf', {
    status: 'too_large',
    statusDetail: 'At 205 MB it is over the 100 MB limit, so it was not read.',
    sizeBytes: 214_958_080,
    language: null,
  }),
];

export const suggestedQuestions = [
  'What is the retention percentage in the contract?',
  'Which items in Bill 2 of BOQ Rev 3 are over SAR 500,000?',
  'What changed between BOQ Rev 2 and Rev 3?',
  'Total the supplier quotations per currency.',
  'ما هي غرامة التأخير في العقد؟',
];

export function findDocument(documents: DocumentSummary[], id: string): DocumentSummary | null {
  return documents.find((document) => document.id === id) ?? null;
}

export function byPath(path: string): DocumentSummary {
  const found = projectDocuments.find((document) => document.path === path);
  if (!found) throw new Error(`The mock has no document ${path}`);
  return found;
}
