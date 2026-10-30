import type { ToolStep } from '@atlas/shared';
import type { Language } from '../../i18n/language';
import { type StepInput, describeStepInput } from './stepInput';
import { traceCopy } from './traceCopy';

/** "Searching the documents" for search_documents; tools added later read as "Working: tool name". */
export function stepActivity(name: string, language: Language = 'en'): string {
  const copy = traceCopy[language];
  return copy.activities[name] ?? copy.otherActivity(name);
}

/**
 * What to say while an answer has no text yet: the step running now with what it was asked, or that the answer is
 * being written.
 */
export function pendingActivity(
  steps: ToolStep[],
  language: Language = 'en',
): { label: string; detail: string | null; input: StepInput | null } {
  const runningStep = steps.findLast((step) => step.status === 'running');
  if (runningStep) {
    const input = describeStepInput(runningStep.name, runningStep.inputSummary, language);
    return { label: stepActivity(runningStep.name, language), detail: input?.text ?? null, input };
  }
  const copy = traceCopy[language];
  return { label: steps.length > 0 ? copy.writingAnswer : copy.readingQuestion, detail: null, input: null };
}
