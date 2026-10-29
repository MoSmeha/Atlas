import { isolate } from '../../i18n/bidi';
import { type ArabicNoun, countAr, countEn, figure } from '../../i18n/count';
import type { Bilingual } from '../../i18n/language';

const documents: ArabicNoun = { one: 'مستند واحد', two: 'مستندان', few: 'مستندات', many: 'مستندًا', other: 'مستند' };
const boqs: ArabicNoun = {
  one: 'جدول كميات واحد',
  two: 'جدولا كميات',
  few: 'جداول كميات',
  many: 'جدول كميات',
  other: 'جدول كميات',
};

interface EmptyStateCopy {
  tryAgain: string;
  noFolder: { heading: string; body: string };
  folderEmpty: { heading: (name: string) => string; body: string };
  unreadable: (name: string) => string;
  gettingReady: (name: string) => string;
  suggestionsLater: string;
  askAbout: (name: string) => string;
  suggestedQuestions: string;
  /** The parts of the line under the folder's name. */
  summary: {
    documents: (n: number) => string;
    boqs: (n: number) => string;
    unreadable: (n: number) => string;
    skipped: (n: number) => string;
    separator: string;
  };
}

/** Interface text for the conversation before the first question. */
export const emptyStateCopy: Bilingual<EmptyStateCopy> = {
  en: {
    tryAgain: 'Try again',
    noFolder: {
      heading: 'Load a folder to begin',
      body: 'Type the path of a folder of PDF and Excel files in the documents panel, or drop files there. Atlas reads every file, then answers your questions with the page or rows each fact came from.',
    },
    folderEmpty: {
      heading: (name) => `No PDF or Excel files in ${name}`,
      body: 'Load a folder that holds PDF or Excel files, or drop files into the documents panel.',
    },
    unreadable: (name) => `Atlas could not read ${name}`,
    gettingReady: (name) => `Getting ${name} ready`,
    suggestionsLater: 'Suggested questions appear when it is done.',
    askAbout: (name) => `Ask about ${name}`,
    suggestedQuestions: 'Suggested questions',
    summary: {
      documents: (n) => countEn(n, 'document', 'documents'),
      boqs: (n) => countEn(n, 'BOQ', 'BOQs'),
      unreadable: (n) => `${figure(n)} could not be read`,
      skipped: (n) => `${figure(n)} skipped`,
      separator: ', ',
    },
  },
  ar: {
    tryAgain: 'حاول مرة أخرى',
    noFolder: {
      heading: 'افتح مجلدًا لتبدأ',
      body: 'اكتب مسار مجلد فيه ملفات PDF وExcel في لوحة المستندات، أو أفلت الملفات هناك. يقرأ Atlas كل ملف، ثم يجيب عن أسئلتك مع الصفحة أو الصفوف التي جاءت منها كل معلومة.',
    },
    folderEmpty: {
      heading: (name) => `لا توجد ملفات PDF أو Excel في ${isolate(name)}`,
      body: 'افتح مجلدًا يحوي ملفات PDF أو Excel، أو أفلت الملفات في لوحة المستندات.',
    },
    unreadable: (name) => `تعذّر على Atlas قراءة ${isolate(name)}`,
    gettingReady: (name) => `جارٍ تجهيز ${isolate(name)}`,
    suggestionsLater: 'ستظهر الأسئلة المقترحة عند الانتهاء.',
    askAbout: (name) => `اسأل عن ${isolate(name)}`,
    suggestedQuestions: 'أسئلة مقترحة',
    summary: {
      documents: (n) => countAr(n, documents),
      boqs: (n) => countAr(n, boqs),
      unreadable: (n) => `تعذّرت قراءة ${figure(n)}`,
      skipped: (n) => `تم تخطي ${figure(n)}`,
      separator: '، ',
    },
  },
};
