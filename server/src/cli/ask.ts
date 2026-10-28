import type { Answer, ChatEvent, Usage } from '@atlas/shared';
import type { AskQuestion } from '../application/AskQuestion';
import { formatSources, formatStep, formatTable, formatUsage } from './format';
import type { Terminal } from './Terminal';

export interface AskOptions {
  sessionId: string;
  question: string;
  /** Model ID; null for the default answer model. */
  model: string | null;
  signal: AbortSignal;
}

/**
 * Asks one question and prints it as it runs: each tool step when it ends, then the answer, its table, its sources
 * and its usage. A failure prints its plain message. Returns whether the question was answered.
 */
export async function askAndPrint(askQuestion: AskQuestion, terminal: Terminal, options: AskOptions): Promise<boolean> {
  const outcome = await askQuestion.execute({ ...options, onEvent: (event) => showProgress(terminal, event) });
  terminal.clearStatus();
  if (!outcome.ok) {
    terminal.line(outcome.error.message);
    return false;
  }
  printAnswer(terminal, outcome.answer, outcome.usage);
  return true;
}

function showProgress(terminal: Terminal, event: ChatEvent): void {
  if (event.type === 'started') terminal.status(`Working on it with ${event.model}...`);
  else if (event.type === 'step') {
    if (event.step.status === 'running') terminal.status(formatStep(event.step));
    else terminal.line(formatStep(event.step));
  } else if (event.type === 'answer_delta') terminal.status('Writing the answer...');
  else if (event.type === 'answer_reset') terminal.status('Checking the answer again...');
}

function printAnswer(terminal: Terminal, answer: Answer, usage: Usage): void {
  terminal.line();
  terminal.line(answer.markdown.trim());
  if (answer.table !== null) {
    terminal.line();
    terminal.line(formatTable(answer.table));
  }
  if (answer.unreadableFiles.length > 0) {
    terminal.line();
    terminal.line(`Files that could not be read: ${answer.unreadableFiles.join(', ')}`);
  }
  if (answer.warnings.length > 0) terminal.line();
  for (const warning of answer.warnings) terminal.line(`Note: ${warning}`);
  if (answer.sources.length > 0) {
    terminal.line();
    terminal.line('Sources');
    for (const source of formatSources(answer.sources)) terminal.line(source);
  }
  terminal.line();
  terminal.line(formatUsage(usage));
}
