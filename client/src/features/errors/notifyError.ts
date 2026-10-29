import { notifications } from '@mantine/notifications';
import { toApiError } from '../../api/ApiError';
import type { Language } from '../../i18n/language';
import { type ErrorTone, errorCopy, errorMessage } from './errorCopy';

const toneColor: Record<ErrorTone, string> = { error: 'red', warning: 'yellow', neutral: 'gray' };

/**
 * Shows a failed action that has no place on the page, such as Clear chat, as a notification.
 * With `title` (for example "Atlas could not clear the chat") the body names the cause in one line.
 */
export function notifyError(error: unknown, title: string | undefined, language: Language): void {
  const apiError = toApiError(error);
  const copy = errorCopy(apiError, language);
  notifications.show({
    color: toneColor[copy.tone],
    title: title ?? copy.title,
    message: title === undefined ? copy.detail : errorMessage(apiError, language),
  });
}
