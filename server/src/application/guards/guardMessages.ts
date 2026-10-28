import type { Answer } from '@atlas/shared';
import type { AnswerProblem } from './problems';

/** The fixed answer when the documents do not hold one, per language. */
const NOT_FOUND: Record<Answer['language'], string> = {
  en: 'Not found in the loaded documents.',
  ar: 'لم أجد ذلك في المستندات المحمّلة.',
};

const quoted = (items: string[]) => items.map((item) => `"${item}"`).join(', ');

/** Text the answer guards send the model when they reject an answer, and show the user when they accept one anyway. */
export const guardMessages = {
  notFound: (language: Answer['language']) => NOT_FOUND[language],

  /** The submit_answer output for a rejected answer: every problem, and what to do about it. */
  feedback(problems: AnswerProblem[]): string {
    const lines: string[] = [];
    const numbers = problems.flatMap((problem) => (problem.type === 'numbers' ? problem.numbers : []));
    if (numbers.length > 0) {
      lines.push(
        `These numbers are not in any tool output, the question or a cited page or row: ${quoted(numbers)}. ` +
          'Compute each one with query_tables or calculate and copy the value exactly as the tool returns it, or leave it out.',
      );
    }
    const sources = problems.flatMap((problem) => (problem.type === 'source' ? [problem.reason] : []));
    if (sources.length > 0) {
      lines.push(
        `These sources are not valid: ${sources.join(' ')} ` +
          'Cite document names, pages, sheets and rows exactly as the tools returned them, or leave the source out.',
      );
    }
    for (const problem of problems) {
      if (problem.type === 'result') {
        lines.push(
          `result_id ${problem.resultId} is not a saved result in this chat. ` +
            'Use an id a tool returned with its rows, such as r1, or null.',
        );
      }
    }
    if (problems.some((problem) => problem.type === 'no_source')) {
      lines.push(
        'An answer of kind "answer" needs at least one valid source: the PDF page, or the Excel sheet and rows, its facts come from. ' +
          'If the documents do not contain the answer, use kind "not_found".',
      );
    }
    return JSON.stringify({
      error: 'The answer was not accepted, so the user has not seen it.',
      problems: lines,
      next: 'Fix these problems and call submit_answer again.',
    });
  },

  /** A note shown with an answer accepted despite a problem, in plain words for the user. */
  warning(problem: AnswerProblem): string {
    switch (problem.type) {
      case 'numbers':
        return `These numbers could not be traced to a tool result or the documents: ${quoted(problem.numbers)}.`;
      case 'source':
        return `A source was left out because it could not be checked: ${problem.reason}`;
      case 'result':
        return `The table for this answer (${problem.resultId}) could not be found, so it is not shown.`;
      case 'no_source':
        return 'No source could be checked for this answer, so it is shown as not found.';
    }
  },
};
