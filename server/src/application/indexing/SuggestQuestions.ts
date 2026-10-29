import type { DocumentSummary, DocumentType, FileStatus, SuggestedQuestion, TableSummary } from '@atlas/shared';
import { currencyKey, UNSPECIFIED_CURRENCY } from '../../domain/currency';
import { revisionName } from '../../domain/revisionName';
import { isBoqTable } from '../tools/boqTables';

/** How many questions the empty chat shows. */
export const SUGGESTION_COUNT = 5;

/** Files Atlas could not read at all. A scanned file is not one of them: its pages can still be looked at. */
const UNREADABLE: ReadonlySet<FileStatus> = new Set(['empty', 'corrupt', 'encrypted', 'too_large', 'skipped']);
/** Rows from which a table is big enough that a threshold question shows counting over every row. */
const LARGE_TABLE_ROWS = 1000;
/** Guesses from the file name, only for documents with no classification. */
const NAME_TYPES: readonly [DocumentType, RegExp][] = [
  ['Contract', /(?<![a-z])(?:contract|agreement)|عقد/i],
  ['Minutes', /(?<![a-z])(?:minutes|mom)(?![a-z])|محضر/i],
  ['Schedule', /(?<![a-z])(?:programme|program|schedule|milestones?)(?![a-z])/i],
];
const SCHEDULE_LABEL = /(?<![a-z])(?:start|finish|milestone|deadline|due date)(?![a-z])/i;
const UNREADABLE_QUESTION: SuggestedQuestion = {
  en: 'Which files could not be read and why?',
  ar: 'أي الملفات تعذّرت قراءتها، ولماذا؟',
};
/** Questions that suit any folder, so there are always five. */
const GENERAL: readonly SuggestedQuestion[] = [
  {
    en: 'What documents are in this folder and what is each one about?',
    ar: 'ما المستندات الموجودة في هذا المجلد، وما موضوع كل منها؟',
  },
  { en: 'Who are the parties named in these documents?', ar: 'من الأطراف المذكورة في هذه المستندات؟' },
  { en: 'What are the key dates in these documents?', ar: 'ما التواريخ الرئيسية في هذه المستندات؟' },
  UNREADABLE_QUESTION,
  { en: 'Which documents mention payment terms?', ar: 'أي المستندات تذكر شروط الدفع؟' },
];

/**
 * Five questions that fit what the folder holds, in priority order: BOQ totals, items above 1 million in the BOQs'
 * currency, BOQ arithmetic, two revisions of one BOQ, a contract's scope, dates in the PDFs, an Arabic document, a
 * scanned one, a file in several currencies, then general questions. Each comes in English and Arabic, so the
 * empty chat can offer them in the interface language. Real file names, no model call, and the same answer
 * whatever order the documents come in.
 */
export function suggest(documents: readonly DocumentSummary[]): SuggestedQuestion[] {
  const docs = documents.toSorted((a, b) => compareText(a.path, b.path));
  const nameOf = namer(docs);
  const readable = docs.filter((doc) => doc.status === 'ok' && doc.kind !== 'other');
  const boqs = readable.filter(isBoq);
  const questions: (SuggestedQuestion | null)[] = [];

  if (boqs.length > 0) {
    const [only] = boqs;
    questions.push(
      boqs.length === 1 && only
        ? { en: `What is the total of ${nameOf(only)}?`, ar: `ما مجموع ${nameOf(only)}؟` }
        : { en: 'What is the total of each BOQ?', ar: 'ما مجموع كل جدول كميات؟' },
    );
    const currency = mainCurrency(boqs);
    questions.push({
      en: `List all cost items above ${million(currency)}`,
      ar: `اعرض كل بنود التكلفة التي تزيد على ${millionAr(currency)}`,
    });
    questions.push({ en: 'Check the BOQ arithmetic for errors', ar: 'تحقق من أخطاء الحساب في جداول الكميات' });
  }
  const revisions = revisionPair(boqs);
  if (revisions) {
    const earlier = nameOf(revisions[0]);
    const later = nameOf(revisions[1]);
    questions.push({ en: `What changed between ${earlier} and ${later}?`, ar: `ما الذي تغيّر بين ${earlier} و${later}؟` });
  }
  const contract = readable.find((doc) => typeOf(doc) === 'Contract');
  if (contract) {
    questions.push({ en: `Summarize the scope of work in ${nameOf(contract)}`, ar: `لخّص نطاق العمل في ${nameOf(contract)}` });
  }
  if (readable.some((doc) => doc.kind === 'pdf')) {
    questions.push({
      en: 'Extract all dates and deliverables from these documents',
      ar: 'استخرج كل التواريخ والمخرجات من هذه المستندات',
    });
  }
  const arabic = readable.find((doc) => doc.language === 'ar');
  if (arabic) questions.push(aboutArabic(arabic, nameOf(arabic)));
  const scanned = docs.find(isScanned);
  if (scanned) questions.push({ en: `What does ${nameOf(scanned)} show?`, ar: `ماذا يُظهر ${nameOf(scanned)}؟` });
  const mixed = readable.find((doc) => doc.tables.length > 0 && currenciesOf(doc).length > 1);
  if (mixed) {
    questions.push({ en: `What is the total per currency of ${nameOf(mixed)}?`, ar: `ما مجموع ${nameOf(mixed)} لكل عملة؟` });
  }

  if (docs.some((doc) => UNREADABLE.has(doc.status))) questions.push(UNREADABLE_QUESTION);
  questions.push(largeTableQuestion(readable.filter((doc) => !boqs.includes(doc)), nameOf));
  const schedule = readable.find(isSchedule);
  if (schedule) {
    questions.push({
      en: `List the milestones in ${nameOf(schedule)} with their planned dates`,
      ar: `اعرض المراحل الرئيسية في ${nameOf(schedule)} مع تواريخها المخططة`,
    });
  }
  questions.push(...GENERAL);

  const unique = new Map<string, SuggestedQuestion>();
  for (const question of questions) if (question !== null && !unique.has(question.en)) unique.set(question.en, question);
  return [...unique.values()].slice(0, SUGGESTION_COUNT);
}

/** Classified as a BOQ, or holding a table with quantity, rate and amount columns. */
function isBoq(doc: DocumentSummary): boolean {
  return doc.classification?.type === 'BOQ' || doc.tables.some(isBoqTable);
}

/** The classification when there is one, otherwise a guess from the file name. */
function typeOf(doc: DocumentSummary): DocumentType | null {
  if (doc.classification) return doc.classification.type;
  return NAME_TYPES.find(([, pattern]) => pattern.test(doc.name))?.[0] ?? null;
}

function isScanned(doc: DocumentSummary): boolean {
  return doc.kind === 'pdf' && (doc.status === 'scanned' || (doc.status === 'ok' && doc.scannedPages.length > 0));
}

function isSchedule(doc: DocumentSummary): boolean {
  return typeOf(doc) === 'Schedule' || doc.tables.some((table) => table.columns.some((column) => SCHEDULE_LABEL.test(column.label)));
}

/** The latest two revisions of the first BOQ, by name, that has more than one; earlier first. */
function revisionPair(boqs: readonly DocumentSummary[]): [DocumentSummary, DocumentSummary] | null {
  const groups = new Map<string, Map<number, DocumentSummary>>();
  for (const doc of boqs) {
    const revision = revisionName(doc.name);
    if (revision === null) continue;
    const ranks = groups.get(revision.stem) ?? new Map<number, DocumentSummary>();
    if (!ranks.has(revision.rank)) ranks.set(revision.rank, doc);
    groups.set(revision.stem, ranks);
  }
  for (const stem of [...groups.keys()].sort(compareText)) {
    const ranks = [...(groups.get(stem) ?? new Map<number, DocumentSummary>())].sort(([a], [b]) => a - b);
    const [earlier, later] = ranks.slice(-2).map(([, doc]) => doc);
    if (ranks.length > 1 && earlier && later) return [earlier, later];
  }
  return null;
}

/** The currency most BOQs use, SAR first on a tie; null when none states one. */
function mainCurrency(boqs: readonly DocumentSummary[]): string | null {
  const counts = new Map<string, number>();
  for (const doc of boqs) {
    const priced = doc.tables.filter(isBoqTable);
    const fromTables = currencies(priced);
    for (const currency of fromTables.length > 0 ? fromTables : currencies([], doc.currencies)) {
      counts.set(currency, (counts.get(currency) ?? 0) + 1);
    }
  }
  const ranked = [...counts].sort(([a, x], [b, y]) => y - x || Number(b === 'SAR') - Number(a === 'SAR') || compareText(a, b));
  return ranked[0]?.[0] ?? null;
}

/** Every currency a document and its tables state, as codes. */
function currenciesOf(doc: DocumentSummary): string[] {
  return currencies(doc.tables, doc.currencies);
}

function currencies(tables: readonly TableSummary[], extra: readonly string[] = []): string[] {
  const keys = [...extra, ...tables.map((table) => table.currency)].map((currency) => currencyKey(currency));
  return [...new Set(keys.filter((key) => key !== UNSPECIFIED_CURRENCY))];
}

/** A threshold question over the largest table with an amount column, when it is big enough to need SQL. */
function largeTableQuestion(
  docs: readonly DocumentSummary[],
  nameOf: (doc: DocumentSummary) => string,
): SuggestedQuestion | null {
  let best: { doc: DocumentSummary; table: TableSummary } | null = null;
  for (const doc of docs) {
    for (const table of doc.tables) {
      const hasAmount = table.columns.some((column) => column.name === 'amount');
      if (hasAmount && table.rowCount >= LARGE_TABLE_ROWS && (best === null || table.rowCount > best.table.rowCount)) best = { doc, table };
    }
  }
  if (best === null) return null;
  const [currency] = currencies([best.table], best.doc.currencies);
  const name = nameOf(best.doc);
  return {
    en: `How many entries in ${name} are above ${million(currency ?? null)}?`,
    ar: `كم عدد القيود في ${name} التي تزيد على ${millionAr(currency ?? null)}؟`,
  };
}

/** A question about an Arabic document, fitted to its type. */
function aboutArabic(doc: DocumentSummary, name: string): SuggestedQuestion {
  const type = typeOf(doc);
  if (type === 'Minutes') return { en: `What was decided in ${name}?`, ar: `ما الذي تقرر في ${name}؟` };
  if (type === 'Contract') return { en: `What are the key terms of ${name}?`, ar: `ما الشروط الرئيسية في ${name}؟` };
  return { en: `What are the main points of ${name}?`, ar: `ما النقاط الرئيسية في ${name}؟` };
}

/** No-break spaces join the amount and its currency, so a wrapping line never strands "SAR" on its own. */
function million(currency: string | null): string {
  return currency === null ? '1\u00a0million' : `${currency}\u00a01\u00a0million`;
}

/** The threshold in figures, so the Arabic question carries the exact number; the currency code stays as written. */
function millionAr(currency: string | null): string {
  return currency === null ? '1,000,000' : `1,000,000\u00a0${currency}`;
}

/** The file name, or the path when another file in the folder has the same name. */
function namer(docs: readonly DocumentSummary[]): (doc: DocumentSummary) => string {
  const counts = new Map<string, number>();
  for (const doc of docs) counts.set(doc.name.toLowerCase(), (counts.get(doc.name.toLowerCase()) ?? 0) + 1);
  return (doc) => ((counts.get(doc.name.toLowerCase()) ?? 0) > 1 ? doc.path : doc.name);
}

/** Code-unit order, the same on every machine and locale. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
