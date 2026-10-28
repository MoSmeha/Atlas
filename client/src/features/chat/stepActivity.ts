import type { ToolStep } from '@atlas/shared';
import { describeStepInput } from './stepInput';

/** What each tool is doing, as a reader would say it while it runs. */
const activities: Record<string, string> = {
  list_documents: 'Checking the document list',
  search_documents: 'Searching the documents',
  read_pages: 'Reading pages',
  look_at_page: 'Looking at a page image',
  query_tables: 'Running a query over the tables',
  calculate: 'Calculating',
  check_boq_arithmetic: 'Checking the BOQ arithmetic',
  compare_revisions: 'Comparing the revisions',
  extract_schedule: 'Reading the schedule',
  export_table: 'Preparing the export',
  submit_answer: 'Checking the answer',
};

/** "Searching the documents" for search_documents; tools added later read as "Working: tool name". */
export function stepActivity(name: string): string {
  return activities[name] ?? `Working: ${name.replaceAll('_', ' ')}`;
}

/** What to say while an answer has no text yet: the step running now, or that the answer is being written. */
export function pendingActivity(steps: ToolStep[]): { label: string; detail: string | null } {
  const runningStep = steps.findLast((step) => step.status === 'running');
  if (runningStep) {
    const input = describeStepInput(runningStep.name, runningStep.inputSummary);
    return { label: stepActivity(runningStep.name), detail: input?.text ?? null };
  }
  if (steps.length > 0) return { label: 'Writing the answer', detail: null };
  return { label: 'Reading the question', detail: null };
}
