import { relative } from 'node:path';
import { watch } from 'chokidar';
import type { FileChange, FileWatcher, WatchHandle } from '../../application/ports/FileWatcher';
import { isIgnoredName } from '../../domain/fileTypes';

/** A watch that also says when its first look at the folder is done; changes after that are reported. */
export interface ChokidarWatch extends WatchHandle {
  ready: Promise<void>;
}

export interface ChokidarWatcherOptions {
  /** How long a file's size must stay the same before it counts as written. */
  stabilityMs?: number;
}

const STABILITY_MS = 800;

/**
 * The FileWatcher port with chokidar. Every file is reported, including kinds Atlas does not read, so the document
 * list stays complete; hidden files and folders and Office lock files are not. Files are reported once their writing
 * has settled. The watch never keeps the process alive by itself.
 */
export class ChokidarWatcher implements FileWatcher {
  private readonly stabilityMs: number;

  constructor(options: ChokidarWatcherOptions = {}) {
    this.stabilityMs = options.stabilityMs ?? STABILITY_MS;
  }

  watch(folder: string, onChange: (change: FileChange) => void, onError: (error: Error) => void): ChokidarWatch {
    const watcher = watch(folder, {
      ignoreInitial: true,
      persistent: false,
      ignored: (path) => isHiddenInside(folder, path),
      awaitWriteFinish: { stabilityThreshold: this.stabilityMs, pollInterval: 100 },
    });
    const report = (type: FileChange['type']) => (absolutePath: string) => onChange({ type, absolutePath });
    watcher.on('add', report('added'));
    watcher.on('change', report('changed'));
    watcher.on('unlink', report('removed'));
    watcher.on('error', (error) => onError(error instanceof Error ? error : new Error(String(error))));
    const ready = new Promise<void>((resolve) => watcher.once('ready', resolve));
    return { ready, close: () => watcher.close() };
  }
}

/** True for a path under the folder with a hidden or lock-file segment; the folder itself and paths above it never are. */
function isHiddenInside(folder: string, path: string): boolean {
  const segments = relative(folder, path).split(/[\\/]/);
  if (segments[0] === '' || segments[0] === '..') return false;
  return segments.some(isIgnoredName);
}
