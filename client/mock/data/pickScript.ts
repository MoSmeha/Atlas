import type { Script, ScriptContext } from './script';
import { itemsOverAnswer, quotesAnswer, revisionsAnswer } from './tableAnswers';
import {
  concreteCoverAnswer,
  delayDamagesAnswer,
  notFoundAnswer,
  rateLimitedError,
  retentionAnswer,
  slowAnswer,
} from './textAnswers';

const ARABIC = /[؀-ۿ]/;

/**
 * Picks the canned run for a question by its words. Try "retention", "delay damages", "concrete cover",
 * "items over SAR 1 million", "what changed between revisions", "quotations per currency", any Arabic
 * question, "slow" (to test Stop), "fail" (a rate-limit error), or anything else for "not found".
 */
export function pickScript(context: ScriptContext): Script {
  const q = context.question.toLowerCase();
  if (ARABIC.test(q)) return delayDamagesAnswer('ar');
  if (/\b(fail|error|rate limit)/.test(q)) return rateLimitedError(context);
  if (/\b(slow|long|overview)/.test(q)) return slowAnswer(context);
  if (/retention/.test(q)) return retentionAnswer();
  if (/delay|damages|penalt/.test(q)) return delayDamagesAnswer('en');
  if (/cover|specification/.test(q)) return concreteCoverAnswer();
  if (/chang|compare|revision|rev ?2/.test(q)) return revisionsAnswer(context);
  if (/quot|currenc|supplier/.test(q)) return quotesAnswer(context);
  if (/over|above|more than|greater|exceed|boq|bill|item/.test(q)) return itemsOverAnswer(context);
  return notFoundAnswer(context);
}
