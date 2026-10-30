import type { DocumentType, FileKind, FileStatus, IndexPhase } from '@atlas/shared';
import { isolate } from '../../i18n/bidi';
import { type ArabicNoun, countAr, countEn, figure } from '../../i18n/count';
import type { Bilingual } from '../../i18n/language';

type ActivePhase = Extract<IndexPhase, 'scanning' | 'reading' | 'embedding' | 'classifying'>;
type EmptyReason = 'no-folder' | 'no-files';

const files: ArabicNoun = { one: 'ملف واحد', two: 'ملفان', few: 'ملفات', many: 'ملفًا', other: 'ملف' };
const pages: ArabicNoun = { one: 'صفحة واحدة', two: 'صفحتان', few: 'صفحات', many: 'صفحة', other: 'صفحة' };
const sheets: ArabicNoun = { one: 'ورقة واحدة', two: 'ورقتان', few: 'أوراق', many: 'ورقة', other: 'ورقة' };
const tables: ArabicNoun = { one: 'جدول واحد', two: 'جدولان', few: 'جداول', many: 'جدولًا', other: 'جدول' };

export interface SidebarCopy {
  projectFolder: string;
  useSample: string;
  load: string;
  /** The folder button in the path box, which opens the computer's folder window. */
  browse: string;
  /** That window's title. */
  pickTitle: string;
  /** Shown when the computer has no folder window Atlas can open. */
  pickFailed: string;
  emptyPathHint: string;
  folderNotFound: (path: string) => string;
  /** The server's own line counts the files it skipped; Arabic gives the plain next step instead. */
  folderEmpty: (serverMessage: string) => string;
  notAdded: (names: string) => string;
  dropLabel: string;
  dropIdle: string;
  uploading: (n: number) => string;
  dropAccept: string;
  dropReject: string;
  documents: string;
  files: (n: number) => string;
  tryAgain: string;
  loadingDocuments: string;
  empty: Record<EmptyReason, { title: string; body: string }>;
  skipped: (n: number) => string;
  notRead: string;
  readsOnly: string;
  kinds: Record<FileKind, string>;
  statuses: Record<Exclude<FileStatus, 'ok'>, { label: string; detail: string }>;
  types: Record<DocumentType, string>;
  pages: (n: number) => string;
  sheets: (n: number) => string;
  tables: (n: number) => string;
  scanned: (n: number) => string;
  /** A file size such as "7 KB", kept in its own direction inside Arabic text. */
  fileSize: (size: string) => string;
  /** Joins the parts of a file's meta line. */
  listSeparator: string;
  steps: Record<ActivePhase, { label: string; waiting: string }>;
  finished: string;
  allRead: string;
  stepOf: (step: number, total: number) => string;
  /** "3 of 12", added to the step's line when the server's own line is not shown. */
  progressOf: (current: number, total: number) => string;
  indexingStopped: string;
  /** The remove button's tooltip on a file or folder row. */
  removeTip: string;
  /** The remove button's name for a screen reader, with the file or folder's name. */
  removeItem: (name: string) => string;
  /** Asked before an uploaded file or folder is deleted. */
  deleteUploaded: { title: (name: string) => string; body: string };
  /** Asked before the loaded folder is removed: a folder loaded by its path, then the uploads folder. */
  removeFolder: { title: (name: string) => string; body: string };
  removeUploads: { title: string; body: (n: number) => string };
  cancel: string;
  remove: string;
  delete: string;
  removeFailed: string;
  /** The foot line that lists what was removed from a folder loaded by its path. */
  removed: (n: number) => string;
  removedTitle: string;
  removedNote: string;
  putBack: string;
  putBackItem: (name: string) => string;
  putBackFailed: string;
}

/** Interface text for the documents sidebar. */
export const sidebarCopy: Bilingual<SidebarCopy> = {
  en: {
    projectFolder: 'Project folder',
    useSample: 'Use sample project',
    load: 'Load',
    browse: 'Choose a folder',
    pickTitle: 'Choose the project folder',
    pickFailed: "Atlas could not open a folder window on this computer. Type the folder's path instead.",
    emptyPathHint: 'Choose a folder with the folder button, or type its path, for example C:\\Projects\\Riyadh Tower.',
    folderNotFound: (path) =>
      `Folder not found: ${path}. Check the spelling, or copy the path from the File Explorer address bar.`,
    folderEmpty: (serverMessage) => `${serverMessage} Pick a folder that holds PDF or Excel files.`,
    notAdded: (names) => `Not added: ${names}. Atlas reads PDF and Excel files (.pdf, .xlsx, .xlsm).`,
    dropLabel: 'Drop PDF or Excel files here, or press Enter to choose them',
    dropIdle: 'Drop PDF or Excel files',
    uploading: (n) => `Uploading ${countEn(n, 'file', 'files')}`,
    dropAccept: 'Drop to add them',
    dropReject: 'Only PDF and Excel files',
    documents: 'Documents',
    files: (n) => countEn(n, 'file', 'files'),
    tryAgain: 'Try again',
    loadingDocuments: 'Loading documents',
    empty: {
      'no-folder': {
        title: 'No folder loaded yet',
        body: 'Choose a project folder with the folder button above, or type its path and press Load, or drop files into the box. Atlas lists every PDF and Excel file here and marks any it cannot read.',
      },
      'no-files': {
        title: 'No PDF or Excel files here',
        body: 'Drop files into the box above to add them, or load another folder.',
      },
    },
    skipped: (n) => `${countEn(n, 'file', 'files')} skipped`,
    notRead: 'Not read',
    readsOnly: 'Atlas reads PDF and Excel files only.',
    kinds: { pdf: 'PDF', excel: 'Excel workbook', other: 'Other file' },
    statuses: {
      scanned: { label: 'Scanned', detail: 'Some pages are scanned images with no text, so Atlas cannot search them.' },
      too_large: { label: 'Too large', detail: 'The file is over the size limit, so Atlas did not read it.' },
      corrupt: { label: 'Damaged', detail: 'The file is damaged and could not be opened.' },
      encrypted: { label: 'Password protected', detail: 'The file is password protected, so Atlas cannot read it.' },
      empty: { label: 'Empty', detail: 'The file has no text or data to read.' },
      skipped: { label: 'Not read', detail: 'Atlas reads only PDF and Excel files.' },
    },
    types: {
      Contract: 'Contract',
      BOQ: 'BOQ',
      Specification: 'Specification',
      Schedule: 'Schedule',
      Drawing: 'Drawing',
      Minutes: 'Minutes',
      Correspondence: 'Correspondence',
      Other: 'Other',
    },
    pages: (n) => countEn(n, 'page', 'pages'),
    sheets: (n) => countEn(n, 'sheet', 'sheets'),
    tables: (n) => countEn(n, 'table', 'tables'),
    scanned: (n) => `${figure(n)} scanned`,
    fileSize: (size) => size,
    listSeparator: ', ',
    steps: {
      scanning: { label: 'Finding files', waiting: 'Looking for PDF and Excel files' },
      reading: { label: 'Reading files', waiting: 'Opening the files' },
      embedding: { label: 'Preparing search', waiting: 'Preparing search over the text' },
      classifying: { label: 'Sorting by document type', waiting: 'Sorting the documents by type' },
    },
    finished: 'Finished',
    allRead: 'All files read',
    stepOf: (step, total) => `Step ${figure(step)} of ${figure(total)}`,
    progressOf: (current, total) => `${figure(current)} of ${figure(total)}`,
    indexingStopped: 'Indexing stopped.',
    removeTip: 'Remove from Atlas',
    removeItem: (name) => `Remove ${name} from Atlas`,
    deleteUploaded: {
      title: (name) => `Delete ${name}?`,
      body: 'Atlas deletes its uploaded copy and forgets what it read from it. This cannot be undone.',
    },
    removeFolder: {
      title: (name) => `Remove ${name} from Atlas?`,
      body: 'Atlas forgets everything it read from this folder. The files on your disk stay as they are.',
    },
    removeUploads: {
      title: 'Delete all uploaded files?',
      body: (n) => `Atlas deletes the ${countEn(n, 'uploaded file', 'uploaded files')} and forgets what it read from them. This cannot be undone.`,
    },
    cancel: 'Cancel',
    remove: 'Remove',
    delete: 'Delete',
    removeFailed: 'Atlas could not remove it',
    removed: (n) => `${figure(n)} removed from Atlas`,
    removedTitle: 'Removed from Atlas',
    removedNote: 'They stay on your disk. Atlas leaves them out until you put them back.',
    putBack: 'Put back',
    putBackItem: (name) => `Put ${name} back`,
    putBackFailed: 'Atlas could not put it back',
  },
  ar: {
    projectFolder: 'مجلد المشروع',
    useSample: 'استخدم المشروع التجريبي',
    load: 'فتح',
    browse: 'اختر مجلدًا',
    pickTitle: 'اختر مجلد المشروع',
    pickFailed: 'تعذّر على Atlas فتح نافذة اختيار المجلدات على هذا الحاسوب. اكتب مسار المجلد بدلًا من ذلك.',
    emptyPathHint: `اختر مجلدًا بزر المجلد، أو اكتب مساره، مثل ${isolate('C:\\Projects\\Riyadh Tower')}.`,
    folderNotFound: (path) =>
      `لم يُعثر على المجلد ${isolate(path)}. تحقق من الكتابة، أو انسخ المسار من شريط العنوان في مستكشف الملفات.`,
    folderEmpty: () => 'لا يحوي هذا المجلد ملفات PDF أو Excel. اختر مجلدًا يحوي ملفات PDF أو Excel.',
    notAdded: (names) => `لم تُضف: ${isolate(names)}. يقرأ Atlas ملفات PDF وExcel (${isolate('.pdf, .xlsx, .xlsm')}).`,
    dropLabel: 'أفلت ملفات PDF أو Excel هنا، أو اضغط Enter لاختيارها',
    dropIdle: 'أفلت ملفات PDF أو Excel هنا',
    uploading: (n) => `جارٍ رفع ${countAr(n, files)}`,
    dropAccept: 'أفلتها لإضافتها',
    dropReject: 'ملفات PDF وExcel فقط',
    documents: 'المستندات',
    files: (n) => countAr(n, files),
    tryAgain: 'حاول مرة أخرى',
    loadingDocuments: 'جارٍ تحميل المستندات',
    empty: {
      'no-folder': {
        title: 'لم يُفتح أي مجلد بعد',
        body: 'اختر مجلد المشروع بزر المجلد في الأعلى، أو اكتب مساره واضغط «فتح»، أو أفلت الملفات في المربع. يعرض Atlas هنا كل ملف PDF وExcel، ويشير إلى أي ملف لا يستطيع قراءته.',
      },
      'no-files': {
        title: 'لا توجد ملفات PDF أو Excel هنا',
        body: 'أفلت الملفات في المربع في الأعلى لإضافتها، أو افتح مجلدًا آخر.',
      },
    },
    skipped: (n) => `تم تخطي ${countAr(n, files)}`,
    notRead: 'لم تُقرأ',
    readsOnly: 'يقرأ Atlas ملفات PDF وExcel فقط.',
    kinds: { pdf: 'PDF', excel: 'مصنف Excel', other: 'ملف آخر' },
    statuses: {
      scanned: { label: 'ممسوح ضوئيًا', detail: 'بعض الصفحات صور ممسوحة بلا نص، فلا يستطيع Atlas البحث فيها.' },
      too_large: { label: 'كبير جدًا', detail: 'حجم الملف أكبر من الحد المسموح، فلم يقرأه Atlas.' },
      corrupt: { label: 'تالف', detail: 'الملف تالف ولا يمكن فتحه.' },
      encrypted: { label: 'محمي بكلمة مرور', detail: 'الملف محمي بكلمة مرور، فلا يستطيع Atlas قراءته.' },
      empty: { label: 'فارغ', detail: 'لا يحوي الملف نصًا أو بيانات للقراءة.' },
      skipped: { label: 'لم يُقرأ', detail: 'يقرأ Atlas ملفات PDF وExcel فقط.' },
    },
    types: {
      Contract: 'عقد',
      BOQ: 'جدول كميات',
      Specification: 'مواصفات',
      Schedule: 'جدول زمني',
      Drawing: 'مخطط',
      Minutes: 'محضر اجتماع',
      Correspondence: 'مراسلات',
      Other: 'أخرى',
    },
    pages: (n) => countAr(n, pages),
    sheets: (n) => countAr(n, sheets),
    tables: (n) => countAr(n, tables),
    scanned: (n) => `${figure(n)} ممسوحة ضوئيًا`,
    fileSize: (size) => isolate(size),
    listSeparator: '، ',
    steps: {
      scanning: { label: 'البحث عن الملفات', waiting: 'جارٍ البحث عن ملفات PDF وExcel' },
      reading: { label: 'قراءة الملفات', waiting: 'جارٍ فتح الملفات' },
      embedding: { label: 'تجهيز البحث', waiting: 'جارٍ تجهيز البحث في النص' },
      classifying: { label: 'الفرز حسب نوع المستند', waiting: 'جارٍ فرز المستندات حسب النوع' },
    },
    finished: 'اكتمل',
    allRead: 'قُرئت كل الملفات',
    stepOf: (step, total) => `الخطوة ${figure(step)} من ${figure(total)}`,
    progressOf: (current, total) => `${figure(current)} من ${figure(total)}`,
    indexingStopped: 'توقفت الفهرسة.',
    removeTip: 'إزالة من Atlas',
    removeItem: (name) => `إزالة ${isolate(name)} من Atlas`,
    deleteUploaded: {
      title: (name) => `حذف ${isolate(name)}؟`,
      body: 'يحذف Atlas نسخته المرفوعة وينسى ما قرأه منها. لا يمكن التراجع عن ذلك.',
    },
    removeFolder: {
      title: (name) => `إزالة ${isolate(name)} من Atlas؟`,
      body: 'ينسى Atlas كل ما قرأه من هذا المجلد. تبقى الملفات على جهازك كما هي.',
    },
    removeUploads: {
      title: 'حذف كل الملفات المرفوعة؟',
      body: (n) => `يحذف Atlas الملفات المرفوعة (${countAr(n, files)}) وينسى ما قرأه منها. لا يمكن التراجع عن ذلك.`,
    },
    cancel: 'إلغاء',
    remove: 'إزالة',
    delete: 'حذف',
    removeFailed: 'تعذّر على Atlas إزالته',
    removed: (n) => `أُزيل من Atlas: ${figure(n)}`,
    removedTitle: 'أُزيلت من Atlas',
    removedNote: 'تبقى على جهازك، ويتركها Atlas جانبًا حتى تعيدها.',
    putBack: 'إعادة',
    putBackItem: (name) => `إعادة ${isolate(name)}`,
    putBackFailed: 'تعذّر على Atlas إعادته',
  },
};
