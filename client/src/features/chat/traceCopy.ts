import { type ArabicNoun, countAr, countEn } from '../../i18n/count';
import type { Bilingual } from '../../i18n/language';
import type { TraceStepState } from './TraceStepIcon';

const steps: ArabicNoun = { one: 'خطوة واحدة', two: 'خطوتان', few: 'خطوات', many: 'خطوة', other: 'خطوة' };

/** Units of a step's or an answer's duration. */
export interface DurationUnits {
  ms: string;
  s: string;
  min: string;
}

/** The words around a step's input; the query, file names and questions arrive already isolated. */
export interface StepInputWords {
  quoted: (query: string) => string;
  within: (query: string, document: string) => string;
  page: (page: number) => string;
  pages: (from: number, to: number) => string;
  /** Joins a file name and its pages. */
  separator: string;
  asked: (where: string, question: string) => string;
  everyBoqTable: string;
  everyDocument: string;
  against: (before: string, after: string) => string;
  exportAs: (resultId: string, format: string) => string;
}

export interface TraceCopy {
  toggle: string;
  stepsList: string;
  /** The pause a screen reader hears between the parts of one line. */
  pause: string;
  steps: (n: number) => string;
  soFar: (steps: string) => string;
  took: (steps: string, time: string) => string;
  units: DurationUnits;
  /** Each state, as words for screen readers. */
  states: Record<TraceStepState, string>;
  unfinished: string;
  /** Why a step failed or was skipped. The server's own line is English, so Arabic says it in its own words. */
  failed: (state: 'error' | 'refused', serverMessage: string | null) => string;
  /** What each tool did, for a reader who is not an engineer. */
  labels: Record<string, string>;
  /** A tool added later, which has no label yet. */
  otherLabel: (name: string) => string;
  /** What each tool is doing, as a reader would say it while it runs. */
  activities: Record<string, string>;
  otherActivity: (name: string) => string;
  writingAnswer: string;
  readingQuestion: string;
  input: StepInputWords;
}

/** Interface text for "How I found this": the steps Atlas took to answer, and what it is doing now. */
export const traceCopy: Bilingual<TraceCopy> = {
  en: {
    toggle: 'How I found this',
    stepsList: 'Steps Atlas took',
    pause: ', ',
    steps: (n) => countEn(n, 'step', 'steps'),
    soFar: (count) => `${count} so far`,
    took: (count, time) => `${count}, ${time}`,
    units: { ms: 'ms', s: 's', min: 'min' },
    states: {
      running: 'Running',
      ok: 'Done',
      error: 'Failed',
      refused: 'Skipped',
      unfinished: 'Did not finish',
    },
    unfinished: 'Did not finish.',
    failed: (state, serverMessage) => serverMessage ?? (state === 'error' ? 'Failed' : 'Skipped'),
    labels: {
      list_documents: 'Listed documents',
      search_documents: 'Searched the text',
      read_pages: 'Read pages',
      query_tables: 'Queried the tables',
      look_at_page: 'Looked at a page image',
      check_boq_arithmetic: 'Checked BOQ arithmetic',
      extract_schedule: 'Extracted dates',
      compare_revisions: 'Compared revisions',
      calculate: 'Calculated',
      export_table: 'Exported a table',
    },
    otherLabel: (name) => `Used ${name.replaceAll('_', ' ')}`,
    activities: {
      list_documents: 'Checking the document list',
      search_documents: 'Searching the documents',
      read_pages: 'Reading pages',
      look_at_page: 'Looking at a page image',
      query_tables: 'Running a query over the tables',
      calculate: 'Calculating',
      check_boq_arithmetic: 'Checking the BOQ arithmetic',
      compare_revisions: 'Comparing the revisions',
      extract_schedule: 'Reading the schedule',
      export_table: 'Preparing the export',
      submit_answer: 'Checking the answer',
    },
    otherActivity: (name) => `Working: ${name.replaceAll('_', ' ')}`,
    writingAnswer: 'Writing the answer',
    readingQuestion: 'Reading the question',
    input: {
      quoted: (query) => `"${query}"`,
      within: (query, document) => `"${query}" in ${document}`,
      page: (page) => `page ${page}`,
      pages: (from, to) => `pages ${from} to ${to}`,
      separator: ', ',
      asked: (where, question) => `${where}: ${question}`,
      everyBoqTable: 'Every BOQ table',
      everyDocument: 'Every document',
      against: (before, after) => `${before} against ${after}`,
      exportAs: (resultId, format) => `${resultId} as ${format}`,
    },
  },
  ar: {
    toggle: 'كيف وجدت هذا',
    stepsList: 'الخطوات التي اتبعها Atlas',
    pause: '، ',
    steps: (n) => countAr(n, steps),
    soFar: (count) => `${count} حتى الآن`,
    took: (count, time) => `${count}، ${time}`,
    // The two words of "millisecond" never part across lines either.
    units: { ms: 'مللي ثانية', s: 'ث', min: 'د' },
    states: {
      running: 'قيد التنفيذ',
      ok: 'تمت',
      error: 'تعذّرت',
      refused: 'تم تخطيها',
      unfinished: 'لم تكتمل',
    },
    unfinished: 'لم تكتمل.',
    failed: (state) => (state === 'error' ? 'تعذّر تنفيذ هذه الخطوة.' : 'تخطّى Atlas هذه الخطوة.'),
    labels: {
      list_documents: 'راجع قائمة المستندات',
      search_documents: 'بحث في النص',
      read_pages: 'قرأ صفحات',
      query_tables: 'استعلم من الجداول',
      look_at_page: 'نظر في صورة صفحة',
      check_boq_arithmetic: 'تحقق من حسابات جدول الكميات',
      extract_schedule: 'استخرج التواريخ',
      compare_revisions: 'قارن بين الإصدارات',
      calculate: 'أجرى عملية حسابية',
      export_table: 'صدّر جدولًا',
    },
    // A tool's own name is an English code word, so Arabic names the step plainly instead.
    otherLabel: () => 'استخدم أداة أخرى',
    activities: {
      list_documents: 'جارٍ مراجعة قائمة المستندات',
      search_documents: 'جارٍ البحث في المستندات',
      read_pages: 'جارٍ قراءة الصفحات',
      look_at_page: 'جارٍ النظر في صورة صفحة',
      query_tables: 'جارٍ الاستعلام من الجداول',
      calculate: 'جارٍ الحساب',
      check_boq_arithmetic: 'جارٍ التحقق من حسابات جدول الكميات',
      compare_revisions: 'جارٍ المقارنة بين الإصدارات',
      extract_schedule: 'جارٍ قراءة الجدول الزمني',
      export_table: 'جارٍ تجهيز التصدير',
      submit_answer: 'جارٍ التحقق من الإجابة',
    },
    otherActivity: () => 'جارٍ العمل',
    writingAnswer: 'جارٍ كتابة الإجابة',
    readingQuestion: 'جارٍ قراءة السؤال',
    input: {
      quoted: (query) => `«${query}»`,
      within: (query, document) => `«${query}» في ${document}`,
      page: (page) => `صفحة ${page}`,
      pages: (from, to) => `الصفحات من ${from} إلى ${to}`,
      separator: '، ',
      asked: (where, question) => `${where}: ${question}`,
      everyBoqTable: 'كل جداول الكميات',
      everyDocument: 'كل المستندات',
      against: (before, after) => `${before} مقابل ${after}`,
      exportAs: (resultId, format) => `${resultId} بصيغة ${format}`,
    },
  },
};
