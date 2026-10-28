import type { IndexPhase, IndexStatus } from '@atlas/shared';
import { AppError } from '../application/errors';
import type { Container } from '../main';
import { formatDuration, formatProblems } from './format';
import type { Terminal } from './Terminal';

/**
 * Loads and indexes a folder, showing progress on the status line (or one line per phase when output is piped),
 * then prints how many files were read and which ones had problems. Throws the AppError that stopped the load.
 */
export async function loadFolder(container: Container, folder: string, terminal: Terminal): Promise<IndexStatus> {
  const started = Date.now();
  let phase: IndexPhase | null = null;
  const unsubscribe = container.workspace.subscribe((event) => {
    if (event.type !== 'progress') return;
    if (terminal.live) terminal.status(event.progress.message);
    else if (event.phase !== phase) terminal.line(event.progress.message);
    phase = event.phase;
  });

  let status: IndexStatus;
  try {
    terminal.status(`Scanning ${folder}`);
    await container.indexFolder.load(folder);
    status = await container.indexFolder.idle();
  } finally {
    unsubscribe();
    terminal.clearStatus();
  }
  if (status.phase === 'error' && status.error) {
    throw new AppError(status.error.code, status.error.message, status.error.retryAfterSeconds ?? null);
  }

  const read = status.documents.filter((document) => document.status === 'ok').length;
  const files = status.documents.length === 1 ? '1 file' : `${status.documents.length} files`;
  terminal.line(`Loaded ${folder}: ${read} of ${files} read in ${formatDuration(Date.now() - started)}.`);
  for (const line of formatProblems(status.documents)) terminal.line(line);
  return status;
}
