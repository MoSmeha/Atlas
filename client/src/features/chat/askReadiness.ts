import type { IndexStatus } from '@atlas/shared';
import type { ApiError } from '../../api/ApiError';
import type { NoticeError } from '../errors/errorCopy';

/** Why a question cannot be sent yet, when no error says it. The composer puts it into words. */
export type ReadinessReason = 'checking' | 'no-folder' | 'folder-empty' | 'unreadable' | 'reading';

/** Whether a question can be sent now, and if not, why: a reason, or the error that stops it. */
export interface AskReadiness {
  canAsk: boolean;
  /** Typing ahead is fine while a loaded folder is still being read. */
  canType: boolean;
  hint: ReadinessReason | NoticeError | null;
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
  if (!status) return blocked(statusError ?? 'checking');
  const canType = status.folder !== null && status.phase !== 'error';
  if (apiKeyPresent === false) return blocked({ code: 'missing_api_key', message: '' }, canType);
  if (status.folder === null) return blocked('no-folder');
  if (status.phase === 'error' && status.error?.code === 'folder_empty') return blocked('folder-empty');
  if (status.phase === 'error') return blocked('unreadable');
  if (status.phase !== 'ready') return blocked('reading', canType);
  return { canAsk: true, canType: true, hint: null };
}

function blocked(hint: ReadinessReason | NoticeError, canType = false): AskReadiness {
  return { canAsk: false, canType, hint };
}
