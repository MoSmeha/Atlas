import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { AppError, errors } from './application/errors';
import { askAndPrint } from './cli/ask';
import { chat } from './cli/chat';
import { loadFolder } from './cli/loadFolder';
import { Terminal } from './cli/Terminal';
import { compose, type Container } from './main';

const USAGE = [
  'Usage: pnpm cli <folder> ["<question>"]',
  '  With a question, Atlas answers it and exits.',
  '  Without one, it starts a chat that remembers earlier questions (/model <id>, /clear, /exit).',
].join('\n');

/** `pnpm cli <folder> "<question>"` answers one question; `pnpm cli <folder>` starts a chat. Returns the exit code. */
async function run(args: string[]): Promise<number> {
  const terminal = new Terminal(process.stdout);
  const [folderArg, ...questionWords] = args[0] === '--' ? args.slice(1) : args;
  if (folderArg === undefined || folderArg === '--help' || folderArg === '-h') {
    terminal.line(USAGE);
    return folderArg === undefined ? 1 : 0;
  }
  // pnpm runs scripts from the repository root and sets INIT_CWD to where the command was typed.
  const folder = resolve(process.env.INIT_CWD ?? process.cwd(), folderArg);
  const question = questionWords.join(' ').trim();

  let container: Container | null = null;
  try {
    container = await compose();
    if (container.modelClient === null) throw errors.missingApiKey();
    const status = await loadFolder(container, folder, terminal);
    if (question === '') {
      await chat(container, terminal, status.suggestions.map((suggestion) => suggestion.en));
      return 0;
    }
    return (await askOnce(container, terminal, question)) ? 0 : 1;
  } catch (error) {
    terminal.line(error instanceof AppError ? error.message : `Something went wrong: ${String(error)}`);
    if (!(error instanceof AppError)) console.error(error);
    return 1;
  } finally {
    if (container !== null) closeIndex(container);
  }
}

/** One question; Ctrl+C stops it, a second Ctrl+C quits at once. */
async function askOnce(container: Container, terminal: Terminal, question: string): Promise<boolean> {
  const controller = new AbortController();
  const interrupt = () => (controller.signal.aborted ? process.exit(130) : controller.abort());
  process.on('SIGINT', interrupt);
  try {
    terminal.line();
    const options = { sessionId: randomUUID(), question, model: null, signal: controller.signal };
    return await askAndPrint(container.askQuestion, terminal, options);
  } finally {
    process.off('SIGINT', interrupt);
  }
}

function closeIndex(container: Container): void {
  try {
    container.workspace.require().index.close();
  } catch {
    // Nothing was loaded.
  }
}

run(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
  // Lets output drain; anything still holding the process open is cut off shortly after.
  setTimeout(() => process.exit(code), 2_000).unref();
});
