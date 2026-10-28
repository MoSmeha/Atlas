import type { IndexStatus } from '@atlas/shared';
import type { ApiError } from '../../api/ApiError';

/** Whether a question can be sent now, and if not, a hint that says why. */
export interface AskReadiness {
  canAsk: boolean;
  /** Typing ahead is fine while a loaded folder is still being read. */
  canType: boolean;
  hint: string | null;
}

export interface ReadinessInput {
  status: IndexStatus | undefined;
  /** Why the folder status could not be fetched. */
  statusError: ApiError | null;
  /** From the health check; undefined until it answers. */
  apiKeyPresent: boolean | undefined;
}

/** Decides whether the composer may send, from the folder status and the server's health. */
export function askReadiness({ status, statusError, apiKeyPresent }: ReadinessInput): AskReadiness {
  if (!status) {
    if (statusError) return blocked(statusError.message);
    return blocked('Checking for a loaded folder.');
  }
  const canType = status.folder !== null && status.phase !== 'error';
  if (apiKeyPresent === false) {
    return blocked('Atlas has no OpenAI API key. Add OPENAI_API_KEY to the .env file, then restart the server.', canType);
  }
  if (status.folder === null) return blocked('Load a folder of PDF and Excel files to ask about it.');
  if (status.phase === 'error') return blocked('Atlas could not read this folder. Load it again to try once more.');
  if (status.phase !== 'ready') return blocked('Atlas is still reading the folder. You can ask once it is done.', canType);
  return { canAsk: true, canType: true, hint: null };
}

function blocked(hint: string, canType = false): AskReadiness {
  return { canAsk: false, canType, hint };
}
