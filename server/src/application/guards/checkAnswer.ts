import { z } from 'zod';
import type { Answer } from '@atlas/shared';
import { agentMessages } from '../agent/agentMessages';
import type { SubmitVerdict } from '../agent/runAgent';
import type { DocumentIndex } from '../ports/DocumentIndex';
import type { Session } from '../session/Session';
import { submitAnswerParameters } from '../tools/submitAnswer';
import { buildAnswer } from './buildAnswer';
import { guardMessages } from './guardMessages';
import { unsupportedNumbers } from './numbersGuard';
import type { AnswerProblem } from './problems';
import { checkSources, requireSources } from './sourcesGuard';

/** Answers rejected per question before one is accepted anyway, with its problems shown as warnings. */
export const MAX_REJECTIONS = 2;

export interface CheckAnswerOptions {
  question: string;
  index: DocumentIndex;
  session: Session;
  /** What the tools returned for this question so far, such as the outputs of a ToolOutputLog. */
  toolOutputs: () => readonly unknown[];
  maxRejections?: number;
}

/**
 * The onSubmit check runAgent calls with each submit_answer call of one question. An answer whose numbers all
 * trace to the evidence and whose sources and result_id all check out is accepted as the shared Answer. Otherwise
 * it is rejected with feedback naming every problem, up to MAX_REJECTIONS times; after that the next answer is
 * accepted with the problems as warnings, invalid sources left out, and the "no source means not found" rule applied.
 */
export function checkAnswer(options: CheckAnswerOptions): (args: unknown) => Promise<SubmitVerdict<Answer>> {
  const { index, session } = options;
  const limit = options.maxRejections ?? MAX_REJECTIONS;
  let rejections = 0;

  return async (args) => {
    const parsed = submitAnswerParameters.safeParse(args);
    if (!parsed.success) {
      return { accepted: false, feedback: JSON.stringify({ error: agentMessages.invalidArguments(z.prettifyError(parsed.error)) }) };
    }
    const submitted = parsed.data;
    const checked = checkSources({ index, session, kind: submitted.kind, sources: submitted.sources, resultId: submitted.result_id });
    const numbers = unsupportedNumbers({
      markdown: submitted.markdown,
      question: options.question,
      toolOutputs: options.toolOutputs(),
      results: checked.result === null ? [] : [checked.result],
      sources: checked.sources,
      fileNames: index.documents().flatMap((doc) => [doc.name, doc.path]),
      known: (value) => session.evidence.has(value),
    });
    const problems: AnswerProblem[] = [
      ...(numbers.length > 0 ? [{ type: 'numbers' as const, numbers: numbers.map((mention) => mention.text) }] : []),
      ...checked.problems,
    ];
    if (problems.length > 0 && rejections < limit) {
      rejections += 1;
      return { accepted: false, feedback: guardMessages.feedback(problems) };
    }

    const settled = requireSources(index, submitted, checked.sources);
    const replaced = settled.kind !== submitted.kind;
    const warnings = problems.filter((problem) => !(replaced && problem.type === 'numbers')).map(guardMessages.warning);
    const answer = buildAnswer({
      ...settled,
      language: submitted.language,
      result: replaced ? null : checked.result,
      sources: checked.sources,
      warnings,
    });
    return { accepted: true, value: answer };
  };
}
