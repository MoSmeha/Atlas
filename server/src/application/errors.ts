import type { ErrorCode } from '@atlas/shared';

/** An expected failure with a code the API and CLI can explain to the user. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly retryAfterSeconds: number | null;

  constructor(code: ErrorCode, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const errors = {
  missingApiKey: () =>
    new AppError(
      'missing_api_key',
      'No model is set up. Add OPENAI_API_KEY or GEMINI_API_KEY to the .env file, or start Ollama, then restart Atlas.',
    ),
  /** Voice calls and dictation run on OpenAI whichever provider answers. */
  missingOpenAiKey: () =>
    new AppError('missing_api_key', 'OPENAI_API_KEY is not set. Add it to the .env file and restart Atlas.'),
  folderNotFound: (path: string) => new AppError('folder_not_found', `Folder not found: ${path}`),
  folderEmpty: (path: string, skipped: number) =>
    new AppError(
      'folder_empty',
      skipped > 0
        ? `No PDF or Excel files in ${path} (${skipped} other file${skipped === 1 ? '' : 's'} skipped).`
        : `The folder ${path} is empty.`,
    ),
  notIndexed: () => new AppError('not_indexed', 'Load a folder before asking a question.'),
  documentNotFound: (name: string) => new AppError('document_not_found', `No loaded document matches "${name}".`),
  sheetNotFound: (document: string, sheet: string) =>
    new AppError('document_not_found', `${document} has no sheet named "${sheet}".`),
  resultNotFound: (id: string) => new AppError('result_not_found', `No saved result with id ${id} in this chat.`),
  rateLimited: (retryAfterSeconds: number | null, provider = 'OpenAI') =>
    new AppError(
      'rate_limited',
      retryAfterSeconds === null
        ? `The ${provider} rate limit was reached. Try again shortly.`
        : `The ${provider} rate limit was reached. Try again in ${retryAfterSeconds} seconds.`,
      retryAfterSeconds,
    ),
  modelRefusal: (reason: string) => new AppError('model_refusal', `The model declined to answer: ${reason}`),
  modelError: (message: string) => new AppError('model_error', `The model call failed: ${message}`),
  voiceUnavailable: (model: string) =>
    new AppError('model_error', `Voice calls need the ${model} model, which this OpenAI account cannot use.`),
  folderPickerUnavailable: () =>
    new AppError('invalid_request', "Atlas could not open a folder window on this computer. Type the folder's path instead."),
  stopped: () => new AppError('stopped', 'The question was stopped.'),
  invalidRequest: (message: string) => new AppError('invalid_request', message),
};
