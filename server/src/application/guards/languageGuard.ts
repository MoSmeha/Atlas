import type { Answer } from '@atlas/shared';
import type { SubmitVerdict } from '../agent/runAgent';

type OnSubmit<T> = (args: unknown) => Promise<SubmitVerdict<T>>;

const NAMES: Record<Answer['language'], string> = { en: 'English', ar: 'Arabic' };

/**
 * Wraps an onSubmit check so that an answer whose language is not the question's goes back to the model once,
 * before the inner check sees it. A second answer in the other language is passed on, since a question mixing
 * both languages may be read either way.
 */
export function checkLanguage<T>(expected: Answer['language'], next: OnSubmit<T>): OnSubmit<T> {
  let rejected = false;
  return async (args) => {
    const language = languageOf(args);
    if (rejected || language === null || language === expected) return next(args);
    rejected = true;
    return { accepted: false, feedback: languageFeedback(expected) };
  };
}

/** The submit_answer output for an answer in the wrong language. */
export function languageFeedback(expected: Answer['language']): string {
  const name = NAMES[expected];
  return JSON.stringify({
    error: 'The answer was not accepted, so the user has not seen it.',
    problems: [
      `The question is written in ${name}, so the answer must be too: write markdown in ${name} and set language to ` +
        `"${expected}". Keep file names, sheet names, item codes and numbers exactly as written.`,
    ],
    next: 'Fix this and call submit_answer again.',
  });
}

function languageOf(args: unknown): string | null {
  if (args === null || typeof args !== 'object' || !('language' in args)) return null;
  return typeof args.language === 'string' ? args.language : null;
}
