import { AnswerEffort } from '@atlas/shared';
import type { ReasoningEffort } from '../ports/ModelClient';

/**
 * The configured effort as one the user can swap for another, or null when they cannot: the provider leaves thinking
 * to each model (null), or the config names a level the picker does not offer, such as 'minimal'.
 */
export function pickableEffort(configured: ReasoningEffort | null): AnswerEffort | null {
  const parsed = AnswerEffort.safeParse(configured);
  return parsed.success ? parsed.data : null;
}

/** The effort a question runs at: the one asked for, unless the configured effort cannot be swapped. */
export function questionEffort(configured: ReasoningEffort | null, requested: AnswerEffort | null | undefined): ReasoningEffort | null {
  return pickableEffort(configured) === null ? configured : (requested ?? configured);
}
