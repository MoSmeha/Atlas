import type { ApiErrorCode } from '../../api/ApiError';
import { type ArabicNoun, countAr, countEn } from '../../i18n/count';
import type { Bilingual, Language } from '../../i18n/language';

/** Anything with an error code and a message: an ApiError, an ErrorDetail or a chat turn's error. */
export interface NoticeError {
  code: ApiErrorCode;
  message: string;
  retryAfterSeconds?: number | null;
}

export type ErrorTone = 'error' | 'warning' | 'neutral';

export interface ErrorCopy {
  /** What went wrong, in a few plain words. */
  title: string;
  /** What to do next; empty when the title says it all. */
  detail: string;
  /** Red for failures, amber for waits that pass on their own, gray for things the user chose. */
  tone: ErrorTone;
  /** Asking the same question again can work. */
  retryable: boolean;
}

interface Entry {
  title: string;
  detail: string | ((error: NoticeError) => string);
}

const tones: Record<ApiErrorCode, Pick<ErrorCopy, 'tone' | 'retryable'>> = {
  missing_api_key: { tone: 'error', retryable: false },
  folder_not_found: { tone: 'error', retryable: false },
  folder_empty: { tone: 'warning', retryable: false },
  not_indexed: { tone: 'warning', retryable: false },
  document_not_found: { tone: 'error', retryable: false },
  result_not_found: { tone: 'warning', retryable: true },
  rate_limited: { tone: 'warning', retryable: true },
  model_refusal: { tone: 'warning', retryable: false },
  model_error: { tone: 'error', retryable: true },
  stopped: { tone: 'neutral', retryable: true },
  invalid_request: { tone: 'error', retryable: false },
  internal: { tone: 'error', retryable: true },
  unreachable: { tone: 'error', retryable: true },
};

const seconds: ArabicNoun = { one: 'ثانية واحدة', two: 'ثانيتين', few: 'ثوانٍ', many: 'ثانية', other: 'ثانية' };
const minutes: ArabicNoun = { one: 'دقيقة واحدة', two: 'دقيقتين', few: 'دقائق', many: 'دقيقة', other: 'دقيقة' };

const copy: Bilingual<Record<ApiErrorCode, Entry>> = {
  en: {
    missing_api_key: {
      title: 'No model is set up',
      detail: 'Add OPENAI_API_KEY or GEMINI_API_KEY to .env, or start Ollama, then restart Atlas.',
    },
    folder_not_found: {
      title: 'Folder not found',
      detail: 'Check the path. It must be a folder on the computer running Atlas.',
    },
    folder_empty: { title: 'The folder has no PDF or Excel files', detail: 'Pick a folder that holds PDF or Excel files.' },
    not_indexed: { title: 'No folder is loaded', detail: 'Load a folder of PDF and Excel files, then ask again.' },
    document_not_found: {
      title: 'That file is no longer in the folder',
      detail: 'It may have been moved or deleted. Load the folder again.',
    },
    result_not_found: { title: 'That result is no longer available', detail: 'Ask the question again to get a fresh table.' },
    rate_limited: {
      title: 'The model is busy',
      detail: (error) => `Wait ${waitText(error.retryAfterSeconds, 'en')}, then ask again.`,
    },
    model_refusal: { title: 'The model would not answer this', detail: 'Try asking in different words.' },
    model_error: {
      title: 'The model ran into a problem',
      // The server names the cause (a timeout, no connection, no quota), which says what to do.
      detail: (error) => sentence(error.message) || 'Ask again. If it keeps happening, pick another model.',
    },
    stopped: { title: 'Stopped', detail: '' },
    invalid_request: {
      title: 'Atlas could not take that request',
      detail: (error) => sentence(error.message) || 'Check what you typed, then try again.',
    },
    internal: { title: 'Something went wrong in Atlas', detail: 'Try again, and reload the page if it keeps happening.' },
    unreachable: { title: 'No connection to Atlas', detail: 'Check that the Atlas server is running, then try again.' },
  },
  // The server's own messages are English, so Arabic gives the plain next step instead of quoting them.
  ar: {
    missing_api_key: {
      title: 'لا يوجد نموذج مُعدّ',
      detail: 'أضف OPENAI_API_KEY أو GEMINI_API_KEY إلى ملف ‎.env، أو شغّل Ollama، ثم أعد تشغيل Atlas.',
    },
    folder_not_found: {
      title: 'لم يُعثر على المجلد',
      detail: 'تحقق من المسار. يجب أن يكون مجلدًا على الجهاز الذي يعمل عليه Atlas.',
    },
    folder_empty: { title: 'لا يحوي المجلد ملفات PDF أو Excel', detail: 'اختر مجلدًا يحوي ملفات PDF أو Excel.' },
    not_indexed: { title: 'لم يُفتح أي مجلد', detail: 'افتح مجلدًا فيه ملفات PDF وExcel، ثم اسأل مرة أخرى.' },
    document_not_found: { title: 'هذا الملف لم يعد في المجلد', detail: 'ربما نُقل أو حُذف. افتح المجلد مرة أخرى.' },
    result_not_found: { title: 'هذه النتيجة لم تعد متاحة', detail: 'اطرح السؤال مرة أخرى لتحصل على جدول جديد.' },
    rate_limited: {
      title: 'النموذج مشغول',
      detail: (error) => `انتظر ${waitText(error.retryAfterSeconds, 'ar')}، ثم اسأل مرة أخرى.`,
    },
    model_refusal: { title: 'رفض النموذج الإجابة عن هذا', detail: 'جرّب أن تسأل بكلمات أخرى.' },
    model_error: { title: 'واجه النموذج مشكلة', detail: 'اسأل مرة أخرى. إذا تكرر ذلك، فاختر نموذجًا آخر.' },
    stopped: { title: 'تم الإيقاف', detail: '' },
    invalid_request: { title: 'تعذّر على Atlas قبول هذا الطلب', detail: 'تحقق مما كتبته، ثم حاول مرة أخرى.' },
    internal: { title: 'حدث خطأ في Atlas', detail: 'حاول مرة أخرى، وأعد تحميل الصفحة إذا تكرر ذلك.' },
    unreachable: { title: 'لا يوجد اتصال بـ Atlas', detail: 'تأكد من أن خادم Atlas يعمل، ثم حاول مرة أخرى.' },
  },
};

/** The title, next step and tone shown for an error, in the interface language. */
export function errorCopy(error: NoticeError, language: Language = 'en'): ErrorCopy {
  const { title, detail } = copy[language][error.code];
  return { ...tones[error.code], title, detail: typeof detail === 'function' ? detail(error) : detail };
}

/** The error as one plain line, title then next step, for inline messages and notifications. */
export function errorMessage(error: NoticeError, language: Language = 'en'): string {
  const { title, detail } = errorCopy(error, language);
  return detail === '' ? sentence(title) : `${sentence(title)} ${detail}`;
}

/** "20 seconds", "1 second", "3 minutes", or "a few seconds" when the server gave no time. */
function waitText(wait: number | null | undefined, language: Language): string {
  if (wait == null || !Number.isFinite(wait) || wait <= 0) return language === 'ar' ? 'بضع ثوانٍ' : 'a few seconds';
  const whole = Math.ceil(wait);
  if (whole < 90) return language === 'ar' ? countAr(whole, seconds) : countEn(whole, 'second', 'seconds');
  const mins = Math.ceil(whole / 60);
  return language === 'ar' ? countAr(mins, minutes) : countEn(mins, 'minute', 'minutes');
}

/** Trims text and ends it with a full stop unless it already ends a sentence. Empty stays empty. */
export function sentence(text: string): string {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  return /[.!?؟]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
