import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import type { CatalogModel } from '../application/models/pickLineup';
import type { Container } from '../main';
import { askAndPrint } from './ask';
import type { Terminal } from './Terminal';

const HELP = 'Type a question, or /model <id> to change the model, /clear to start a new chat, /exit to leave.';

/**
 * The interactive session: reads questions until /exit or end of input, keeping one chat so follow-ups build on
 * earlier answers. Ctrl+C stops the question in progress, or leaves when none is running. Starts by listing the
 * questions suggested for the folder, if any.
 */
export async function chat(container: Container, terminal: Terminal, suggestions: readonly string[] = []): Promise<void> {
  const { lineup, modelConfig, sessions, askQuestion } = container;
  const models = Object.values(lineup);
  let model: CatalogModel = lineup[modelConfig.answerTier];
  let sessionId = randomUUID();
  let running: AbortController | null = null;

  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'atlas> ' });
  let closed = false;
  rl.on('close', () => (closed = true));
  const prompt = () => {
    if (!closed) rl.prompt();
  };
  const interrupt = () => {
    if (running !== null) running.abort();
    else rl.close();
  };
  rl.on('SIGINT', interrupt);
  process.on('SIGINT', interrupt);

  if (suggestions.length > 0) {
    terminal.line();
    terminal.line('You could ask:');
    for (const suggestion of suggestions) terminal.line(`  ${suggestion}`);
  }
  terminal.line();
  terminal.line(`Model: ${model.id}. ${HELP}`);
  prompt();
  try {
    for await (const typed of rl) {
      // Piped input is not echoed, so show what was asked.
      if (!process.stdin.isTTY) terminal.line(typed);
      const line = typed.trim();
      if (line === '/exit' || line === '/quit') break;
      if (line === '/clear') {
        sessions.clear(sessionId);
        sessionId = randomUUID();
        terminal.line('Chat cleared. The next question starts fresh.');
      } else if (line === '/model' || line.startsWith('/model ')) {
        model = pickModel(models, line.slice('/model'.length).trim(), model, terminal);
      } else if (line.startsWith('/')) {
        terminal.line(HELP);
      } else if (line !== '') {
        running = new AbortController();
        await askAndPrint(askQuestion, terminal, { sessionId, question: line, model: model.id, signal: running.signal });
        running = null;
        terminal.line();
      }
      prompt();
    }
  } finally {
    process.off('SIGINT', interrupt);
    rl.close();
  }
}

/** The model named by id or tier; an empty or unknown name lists the choices and keeps the current one. */
function pickModel(models: CatalogModel[], name: string, current: CatalogModel, terminal: Terminal): CatalogModel {
  const chosen = models.find((model) => model.id === name || model.tier === name);
  if (chosen !== undefined) {
    terminal.line(`Model: ${chosen.id}.`);
    return chosen;
  }
  if (name !== '') terminal.line(`There is no model "${name}".`);
  terminal.line('Models:');
  for (const model of models) {
    const price = `$${model.inputPrice} in / $${model.outputPrice} out per 1M tokens`;
    terminal.line(`  ${model.id === current.id ? '*' : ' '} ${model.id.padEnd(16)} ${model.tier.padEnd(9)} ${price}`);
  }
  return current;
}
