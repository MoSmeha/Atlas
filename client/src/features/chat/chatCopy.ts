import type { ExportFormat } from '@atlas/shared';
import type { MicrophoneProblem } from '../../api/microphone';
import { isolate } from '../../i18n/bidi';
import { type ArabicNoun, countAr, countEn, figure } from '../../i18n/count';
import type { Bilingual } from '../../i18n/language';
import type { ReadinessReason } from './askReadiness';

const rows: ArabicNoun = { one: 'صف واحد', two: 'صفان', few: 'صفوف', many: 'صفًا', other: 'صف' };

export interface ChatCopy {
  composer: {
    /** The question box's accessible name. */
    question: string;
    placeholder: { ready: string; noFolder: string; transcribing: string };
    hint: { idle: string; idleWithCall: string; streaming: string; recording: string; transcribing: string };
    /** Why a question cannot be sent yet. */
    readiness: Record<ReadinessReason, string>;
    send: string;
    stop: string;
    stopTip: string;
    call: string;
    callTip: string;
    dictate: string;
    cancelDictation: string;
    cancelTip: string;
    finishDictation: string;
    finishTip: string;
    openingMicrophone: string;
    listening: string;
    /** A dictation that could not be written down, then why. */
    dictationFailed: (reason: string) => string;
    /** A microphone that could not be opened, and what to do about it. */
    microphone: Record<MicrophoneProblem, string>;
  };
  answer: {
    spokenQuestion: string;
    unreadableFiles: (n: number) => string;
    warnings: string;
    saidAloud: string;
    stoppedWithText: string;
    stoppedWithoutText: string;
    askAgain: string;
  };
  table: {
    /** The title of a result the model did not name. */
    untitled: string;
    /** "214 rows", or "Showing 50 of 214 rows" when only some are on screen. */
    rowCount: (shown: number, total: number) => string;
    /** The row count, then that only the export holds every row. */
    someSent: (count: string) => string;
    showMore: (n: number) => string;
    noValue: string;
  };
  export: {
    button: string;
    formats: Record<ExportFormat, string>;
    saved: Record<ExportFormat, string>;
    savedTo: (path: string) => string;
    failed: string;
  };
  sources: {
    heading: string;
    page: (page: number) => string;
    /** "sheet BOQ, rows 14–18". */
    sheet: (sheet: string, rows: string) => string;
    /** "row 14" or "rows 14–18", numbered as Excel shows them. */
    rows: (from: number, to: number) => string;
  };
}

/** Interface text for the conversation: the question box, answers, result tables and sources. */
export const chatCopy: Bilingual<ChatCopy> = {
  en: {
    composer: {
      question: 'Question',
      placeholder: {
        ready: 'Ask a question about these documents',
        noFolder: 'Load a folder to ask a question',
        transcribing: 'Writing down what you said…',
      },
      hint: {
        idle: 'Enter sends. Shift + Enter adds a line.',
        idleWithCall: 'Enter sends. Shift + Enter adds a line. The phone starts a voice call.',
        streaming: 'Atlas is answering. Stop it with the button or Esc.',
        recording: 'Say your question. The check mark writes it into the box; Esc cancels.',
        transcribing: 'Writing down what you said.',
      },
      readiness: {
        checking: 'Checking for a loaded folder.',
        'no-folder': 'Load a folder of PDF and Excel files to ask about it.',
        'folder-empty': 'Load a folder that holds PDF or Excel files to ask about it.',
        unreadable: 'Atlas could not read this folder. Load it again to try once more.',
        reading: 'Atlas is still reading the folder. You can ask once it is done.',
      },
      send: 'Send the question',
      stop: 'Stop the answer',
      stopTip: 'Stop the answer (Esc)',
      call: 'Start a voice call',
      callTip: 'Talk to Atlas in a voice call',
      dictate: 'Dictate a question',
      cancelDictation: 'Cancel the dictation',
      cancelTip: 'Cancel (Esc)',
      finishDictation: 'Finish the dictation',
      finishTip: 'Write it into the box',
      openingMicrophone: 'Opening the microphone…',
      listening: 'Listening',
      dictationFailed: (reason) => `Atlas could not write down what you said. ${reason}`,
      microphone: {
        blocked: 'The browser blocked the microphone. Allow it from the icon in the address bar, then try again.',
        missing: 'No microphone was found. Connect one, then try again.',
        busy: 'Another app is using the microphone. Close it, then try again.',
        unsupported: 'This browser cannot use a microphone here. Open Atlas in Edge or Chrome at localhost.',
        failed: 'The microphone could not be opened. Check it, then try again.',
      },
    },
    answer: {
      spokenQuestion: 'Asked in a voice call',
      unreadableFiles: (n) => (n === 1 ? 'File Atlas could not read' : 'Files Atlas could not read'),
      warnings: 'Checks on this answer',
      saidAloud: 'Said aloud',
      stoppedWithText: 'Stopped before Atlas checked this answer.',
      stoppedWithoutText: 'Stopped before Atlas wrote an answer.',
      askAgain: 'Ask again',
    },
    table: {
      untitled: 'Result',
      rowCount: (shown, total) =>
        shown >= total ? countEn(total, 'row', 'rows') : `Showing ${figure(shown)} of ${countEn(total, 'row', 'rows')}`,
      someSent: (count) => `${count}. Export the table to get every row.`,
      showMore: (n) => `Show ${figure(n)} more`,
      noValue: 'No value',
    },
    export: {
      button: 'Export',
      formats: { xlsx: 'Excel (.xlsx)', csv: 'CSV' },
      saved: { xlsx: 'Excel file saved', csv: 'CSV file saved' },
      savedTo: (path) => `Saved to ${path}`,
      failed: 'Atlas could not export the table',
    },
    sources: {
      heading: 'Sources',
      page: (page) => `page ${page}`,
      sheet: (sheet, rowsText) => `sheet ${isolate(sheet)}, ${rowsText}`,
      rows: (from, to) => (from === to ? `row ${from}` : `rows ${from}–${to}`),
    },
  },
  ar: {
    composer: {
      question: 'السؤال',
      placeholder: {
        ready: 'اسأل سؤالًا عن هذه المستندات',
        noFolder: 'افتح مجلدًا لتطرح سؤالًا',
        transcribing: 'جارٍ كتابة ما قلته…',
      },
      hint: {
        idle: 'Enter للإرسال، وShift + Enter لسطر جديد.',
        idleWithCall: 'Enter للإرسال، وShift + Enter لسطر جديد. زر الهاتف يبدأ مكالمة صوتية.',
        streaming: 'يجيب Atlas الآن. أوقفه بالزر أو بمفتاح Esc.',
        recording: 'قل سؤالك. علامة الصح تكتبه في المربع، وEsc يلغيه.',
        transcribing: 'جارٍ كتابة ما قلته.',
      },
      readiness: {
        checking: 'جارٍ التحقق من وجود مجلد مفتوح.',
        'no-folder': 'افتح مجلدًا فيه ملفات PDF وExcel لتسأل عنه.',
        'folder-empty': 'افتح مجلدًا يحوي ملفات PDF أو Excel لتسأل عنه.',
        unreadable: 'تعذّر على Atlas قراءة هذا المجلد. افتحه مرة أخرى لتعيد المحاولة.',
        reading: 'لا يزال Atlas يقرأ المجلد. يمكنك أن تسأل عند انتهائه.',
      },
      send: 'أرسل السؤال',
      stop: 'أوقف الإجابة',
      stopTip: 'أوقف الإجابة (Esc)',
      call: 'ابدأ مكالمة صوتية',
      callTip: 'تحدث إلى Atlas في مكالمة صوتية',
      dictate: 'أملِ سؤالًا بصوتك',
      cancelDictation: 'ألغِ الإملاء الصوتي',
      cancelTip: 'إلغاء (Esc)',
      finishDictation: 'أنهِ الإملاء الصوتي',
      finishTip: 'اكتبه في المربع',
      openingMicrophone: 'جارٍ فتح الميكروفون…',
      listening: 'أستمع',
      dictationFailed: (reason) => `تعذّر على Atlas كتابة ما قلته. ${reason}`,
      microphone: {
        blocked: 'منع المتصفح الميكروفون. اسمح به من الأيقونة في شريط العنوان، ثم حاول مرة أخرى.',
        missing: 'لم يُعثر على ميكروفون. وصّل ميكروفونًا، ثم حاول مرة أخرى.',
        busy: 'تطبيق آخر يستخدم الميكروفون. أغلقه، ثم حاول مرة أخرى.',
        unsupported: 'لا يستطيع هذا المتصفح استخدام الميكروفون هنا. افتح Atlas في Edge أو Chrome على localhost.',
        failed: 'تعذّر فتح الميكروفون. تحقق منه، ثم حاول مرة أخرى.',
      },
    },
    answer: {
      spokenQuestion: 'سُئل في مكالمة صوتية',
      unreadableFiles: (n) => (n === 1 ? 'ملف تعذّر على Atlas قراءته' : 'ملفات تعذّر على Atlas قراءتها'),
      warnings: 'ملاحظات التحقق من هذه الإجابة',
      saidAloud: 'قيل صوتيًا',
      stoppedWithText: 'تم الإيقاف قبل أن يتحقق Atlas من هذه الإجابة.',
      stoppedWithoutText: 'تم الإيقاف قبل أن يكتب Atlas إجابة.',
      askAgain: 'اسأل مرة أخرى',
    },
    table: {
      untitled: 'النتيجة',
      // The shown rows lead, so their count takes the noun: "يُعرض 50 صفًا من أصل 214".
      rowCount: (shown, total) =>
        shown >= total ? countAr(total, rows) : `يُعرض ${countAr(shown, rows)} من أصل ${figure(total)}`,
      someSent: (count) => `${count}. صدّر الجدول لتحصل على كل الصفوف.`,
      showMore: (n) => `اعرض الصفوف الباقية (${figure(n)})`,
      noValue: 'لا قيمة',
    },
    export: {
      button: 'تصدير',
      formats: { xlsx: `ملف Excel (${isolate('.xlsx')})`, csv: 'ملف CSV' },
      saved: { xlsx: 'حُفظ ملف Excel', csv: 'حُفظ ملف CSV' },
      savedTo: (path) => `حُفظ في ${isolate(path)}`,
      failed: 'تعذّر على Atlas تصدير الجدول',
    },
    sources: {
      heading: 'المصادر',
      page: (page) => `صفحة ${page}`,
      sheet: (sheet, rowsText) => `ورقة ${isolate(sheet)}، ${rowsText}`,
      rows: (from, to) => (from === to ? `الصف ${from}` : `الصفوف من ${from} إلى ${to}`),
    },
  },
};
