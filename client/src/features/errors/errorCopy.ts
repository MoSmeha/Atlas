import type { ApiErrorCode } from '../../api/ApiError';

export type ErrorTone = 'error' | 'warning' | 'neutral';

export interface ErrorCopy {
  /** What went wrong, in a few plain words. */
  title: string;
  /** What to do next, used when the server sent no message of its own. */
  advice: string;
  /** Red for failures, amber for waits that pass on their own, gray for things the user chose. */
  tone: ErrorTone;
  /** Asking the same question again can work. */
  retryable: boolean;
}

const copy: Record<ApiErrorCode, ErrorCopy> = {
  missing_api_key: {
    title: 'Atlas has no OpenAI API key',
    advice: 'Add OPENAI_API_KEY to the .env file, then restart the Atlas server.',
    tone: 'error',
    retryable: false,
  },
  folder_not_found: {
    title: 'Folder not found',
    advice: 'Check the path. It must be a folder on the computer running Atlas.',
    tone: 'error',
    retryable: false,
  },
  folder_empty: {
    title: 'The folder has no files',
    advice: 'Pick a folder that holds PDF or Excel files.',
    tone: 'warning',
    retryable: false,
  },
  not_indexed: {
    title: 'No folder is loaded',
    advice: 'Load a folder of PDF and Excel files, then ask again.',
    tone: 'warning',
    retryable: false,
  },
  document_not_found: {
    title: 'That file is no longer in the folder',
    advice: 'It may have been moved or deleted. Load the folder again.',
    tone: 'error',
    retryable: false,
  },
  result_not_found: {
    title: 'That result is no longer available',
    advice: 'Ask the question again to get a fresh table.',
    tone: 'warning',
    retryable: true,
  },
  rate_limited: {
    title: 'OpenAI is busy',
    advice: 'Wait a few seconds, then ask again.',
    tone: 'warning',
    retryable: true,
  },
  model_refusal: {
    title: 'The model would not answer this',
    advice: 'Try asking in different words.',
    tone: 'warning',
    retryable: false,
  },
  model_error: {
    title: 'The model ran into a problem',
    advice: 'Ask again. If it keeps happening, pick another model.',
    tone: 'error',
    retryable: true,
  },
  stopped: {
    title: 'Stopped',
    advice: 'Atlas did not finish this answer.',
    tone: 'neutral',
    retryable: true,
  },
  invalid_request: {
    title: 'Atlas could not take that request',
    advice: 'Check what you typed, then try again.',
    tone: 'error',
    retryable: false,
  },
  internal: {
    title: 'Something went wrong in Atlas',
    advice: 'Try again, and reload the page if it keeps happening.',
    tone: 'error',
    retryable: true,
  },
  unreachable: {
    title: 'No connection to Atlas',
    advice: 'Check that the Atlas server is running, then try again.',
    tone: 'error',
    retryable: true,
  },
};

/** The title, advice and tone shown for an error code. */
export function errorCopy(code: ApiErrorCode): ErrorCopy {
  return copy[code];
}
