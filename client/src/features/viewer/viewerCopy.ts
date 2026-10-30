import { isolate } from '../../i18n/bidi';
import { figure } from '../../i18n/count';
import type { Bilingual } from '../../i18n/language';

export interface ViewerCopy {
  closeFile: string;
  closeSource: string;
  /** Where a PDF source points, in the viewer's title: "page 37". */
  pagePlace: (page: number) => string;
  /** Before the sheet name in a source's title: "sheet Summary, rows 4–12". */
  sheetPlace: string;
  /** Joins the sheet name and its rows in the title. */
  listSeparator: string;

  findingFile: string;
  openingPdf: string;
  loadingSheet: string;
  loadingRows: (from: number, to: number) => string;
  tryAgain: string;
  /** Behind a "file not found" notice; the notice itself gives the next step. */
  notInFolder: (path: string) => string;

  cannotShow: string;
  download: string;
  noSheets: string;
  readsOnly: string;

  previousPage: string;
  nextPage: string;
  /** The button's tooltip with its arrow key; the keys mirror with the buttons in Arabic. */
  previousPageHint: string;
  nextPageHint: string;
  /** "Page [3] of 64" around the page field. */
  pageLabel: string;
  ofPages: (pageCount: number) => string;
  /** The page on screen, read out when it changes. */
  pageOf: (page: number, pageCount: number | null) => string;
  pageField: (pageCount: number | null) => string;
  backToPage: (page: number) => string;

  quoteOnPage: (page: number) => string;
  quoteNotFound: string;
  quoteNoText: string;

  sheets: string;
  /** The hidden label of the row-number column. */
  rowHeader: string;
  /** "row 14" or "rows 14–18", numbered as Excel shows them. */
  rows: (from: number, to: number) => string;
  /** "All 29 rows", "Showing rows 2,768–2,817 of 10,001", or that the sheet is empty. */
  shownRows: (from: number, to: number, total: number) => string;
  /** Adds to the rows line when a source cites rows past the sheet's end. */
  citedPastEnd: (shownRows: string) => string;
  citedRows: (from: number, to: number) => string;
  showRows: (from: number, to: number) => string;
}

/** Interface text for the document and source viewer. */
export const viewerCopy: Bilingual<ViewerCopy> = {
  en: {
    closeFile: 'Close the file',
    closeSource: 'Close the source',
    pagePlace: (page) => `page ${figure(page)}`,
    sheetPlace: 'sheet',
    listSeparator: ', ',

    findingFile: 'Finding the file',
    openingPdf: 'Opening the PDF',
    loadingSheet: 'Loading the sheet',
    loadingRows: (from, to) => `Loading rows ${figure(from)}–${figure(to)}`,
    tryAgain: 'Try again',
    notInFolder: (path) => `${path} is not in the loaded folder.`,

    cannotShow: 'Atlas cannot show this file',
    download: 'Download the file',
    noSheets: 'Atlas found no sheets in this workbook.',
    readsOnly: 'Atlas reads only PDF and Excel files.',

    previousPage: 'Previous page',
    nextPage: 'Next page',
    previousPageHint: 'Previous page (Left arrow)',
    nextPageHint: 'Next page (Right arrow)',
    pageLabel: 'Page',
    ofPages: (pageCount) => `of ${figure(pageCount)}`,
    pageOf: (page, pageCount) =>
      pageCount === null ? `Page ${figure(page)}` : `Page ${figure(page)} of ${figure(pageCount)}`,
    pageField: (pageCount) => (pageCount === null ? 'Page number' : `Page number, 1 to ${figure(pageCount)}`),
    backToPage: (page) => `Back to page ${figure(page)}`,

    quoteOnPage: (page) => `The quoted passage is on page ${figure(page)}.`,
    quoteNotFound: 'These words are not in the page text exactly as quoted, so nothing is highlighted. Check the page by eye.',
    quoteNoText:
      'This page is a scanned image with no text to search, so the passage cannot be highlighted. Check the page by eye.',

    sheets: 'Sheets',
    rowHeader: 'Row',
    rows: (from, to) => (from === to ? `row ${from}` : `rows ${from}–${to}`),
    shownRows: (from, to, total) => {
      if (total === 0) return 'This sheet is empty';
      if (from <= 1 && to >= total) return total === 1 ? 'The only row' : `All ${figure(total)} rows`;
      return `Showing rows ${figure(from)}–${figure(to)} of ${figure(total)}`;
    },
    citedPastEnd: (shownRows) => `${shownRows}. The cited rows are past its last row.`,
    citedRows: (from, to) => (from === to ? `Cited row ${from}` : `Cited rows ${from}–${to}`),
    showRows: (from, to) => `Show rows ${figure(from)}–${figure(to)}`,
  },
  ar: {
    closeFile: 'أغلق الملف',
    closeSource: 'أغلق المصدر',
    pagePlace: (page) => `صفحة ${figure(page)}`,
    sheetPlace: 'ورقة',
    listSeparator: '، ',

    findingFile: 'جارٍ البحث عن الملف',
    openingPdf: 'جارٍ فتح ملف PDF',
    loadingSheet: 'جارٍ تحميل الورقة',
    loadingRows: (from, to) => `جارٍ تحميل الصفوف ${figure(from)} إلى ${figure(to)}`,
    tryAgain: 'حاول مرة أخرى',
    notInFolder: (path) => `الملف ${isolate(path)} ليس في المجلد المفتوح.`,

    cannotShow: 'لا يستطيع Atlas عرض هذا الملف',
    download: 'نزّل الملف',
    noSheets: 'لم يجد Atlas أي ورقة في مصنف Excel هذا.',
    readsOnly: 'يقرأ Atlas ملفات PDF وExcel فقط.',

    previousPage: 'الصفحة السابقة',
    nextPage: 'الصفحة التالية',
    previousPageHint: 'الصفحة السابقة (السهم الأيمن)',
    nextPageHint: 'الصفحة التالية (السهم الأيسر)',
    pageLabel: 'صفحة',
    ofPages: (pageCount) => `من ${figure(pageCount)}`,
    pageOf: (page, pageCount) =>
      pageCount === null ? `صفحة ${figure(page)}` : `صفحة ${figure(page)} من ${figure(pageCount)}`,
    pageField: (pageCount) => (pageCount === null ? 'رقم الصفحة' : `رقم الصفحة، من 1 إلى ${figure(pageCount)}`),
    backToPage: (page) => `عد إلى الصفحة ${figure(page)}`,

    quoteOnPage: (page) => `المقطع المقتبس في الصفحة ${figure(page)}.`,
    quoteNotFound: 'لا ترد هذه الكلمات في نص الصفحة كما اقتُبست تمامًا، لذلك لم يُظلَّل شيء. راجع الصفحة بنفسك.',
    quoteNoText: 'هذه الصفحة صورة ممسوحة ضوئيًا بلا نص يمكن البحث فيه، لذلك لا يمكن تظليل المقطع. راجع الصفحة بنفسك.',

    sheets: 'الأوراق',
    rowHeader: 'رقم الصف',
    rows: (from, to) => (from === to ? `الصف ${from}` : `الصفوف ${from} إلى ${to}`),
    shownRows: (from, to, total) => {
      if (total === 0) return 'هذه الورقة فارغة';
      if (from <= 1 && to >= total) return total === 1 ? 'الصف الوحيد' : `كل الصفوف (${figure(total)})`;
      return `الصفوف ${figure(from)} إلى ${figure(to)} من ${figure(total)}`;
    },
    citedPastEnd: (shownRows) => `${shownRows}. الصفوف المستشهد بها بعد آخر صف في الورقة.`,
    citedRows: (from, to) => (from === to ? `الصف المستشهد به ${from}` : `الصفوف المستشهد بها ${from} إلى ${to}`),
    showRows: (from, to) => `اعرض الصفوف ${figure(from)} إلى ${figure(to)}`,
  },
};
