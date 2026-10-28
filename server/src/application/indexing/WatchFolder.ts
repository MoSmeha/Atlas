import { relative, sep } from 'node:path';
import type { FileChange, FileWatcher, WatchHandle } from '../ports/FileWatcher';
import type { RunLogger } from '../ports/RunLogger';

/** What the watcher asks of the indexer; IndexFolder in the app. */
export interface FileUpdates {
  refreshFile(absolutePath: string): Promise<void>;
  removeFile(absolutePath: string): Promise<void>;
}

export interface WatchFolderDeps {
  watcher: FileWatcher;
  updates: FileUpdates;
  logger: RunLogger;
  /** Quiet time per file before its latest change is applied. */
  debounceMs?: number;
}

interface Watched {
  folder: string;
  handle: WatchHandle | null;
  /** The timer of each file whose latest change is waiting for its quiet time. */
  pending: Map<string, ReturnType<typeof setTimeout>>;
}

const DEBOUNCE_MS = 500;

/**
 * Keeps the index in step with the loaded folder while the app runs. Each file's latest change is applied once the
 * file has been quiet for a moment: added and changed files are read again, removed ones leave the index, and a file
 * replaced during a save is simply read again. One folder is watched at a time; problems are logged, never thrown.
 */
export class WatchFolder {
  private readonly deps: WatchFolderDeps;
  private watched: Watched | null = null;

  constructor(deps: WatchFolderDeps) {
    this.deps = deps;
  }

  /** The folder being watched, or null. */
  folder(): string | null {
    return this.watched?.folder ?? null;
  }

  /** Watches the folder and closes the previous watch; a folder already watched keeps its watch. */
  start(folder: string): void {
    if (this.watched?.folder === folder) return;
    void this.stop();
    const watched: Watched = { folder, handle: null, pending: new Map() };
    this.watched = watched;
    try {
      watched.handle = this.deps.watcher.watch(
        folder,
        (change) => this.schedule(watched, change),
        (error) => this.log(folder, '', 'watch_error', describe(error)),
      );
      this.log(folder, '', 'watching', null);
    } catch (error) {
      this.watched = null;
      this.log(folder, '', 'watch_failed', describe(error));
    }
  }

  /** Closes the watch and drops the changes still waiting. */
  async stop(): Promise<void> {
    const watched = this.watched;
    if (watched === null) return;
    this.watched = null;
    for (const timer of watched.pending.values()) clearTimeout(timer);
    watched.pending.clear();
    try {
      await watched.handle?.close();
    } catch (error) {
      this.log(watched.folder, '', 'watch_close_failed', describe(error));
    }
  }

  private schedule(watched: Watched, change: FileChange): void {
    if (this.watched !== watched) return;
    const { type, absolutePath } = change;
    clearTimeout(watched.pending.get(absolutePath));
    const timer = setTimeout(() => {
      watched.pending.delete(absolutePath);
      void this.apply(watched, type, absolutePath);
    }, this.deps.debounceMs ?? DEBOUNCE_MS);
    watched.pending.set(absolutePath, timer);
  }

  private async apply(watched: Watched, type: FileChange['type'], absolutePath: string): Promise<void> {
    if (this.watched !== watched) return;
    const { updates } = this.deps;
    try {
      await (type === 'removed' ? updates.removeFile(absolutePath) : updates.refreshFile(absolutePath));
    } catch (error) {
      const file = relative(watched.folder, absolutePath).split(sep).join('/');
      this.log(watched.folder, file, 'watch_update_failed', describe(error));
    }
  }

  private log(folder: string, file: string, status: string, detail: string | null): void {
    this.deps.logger.indexing({ folder, file, status, durationMs: 0, detail });
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}
