import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WatchFolder, type FileUpdates } from '../../src/application/indexing/WatchFolder';
import { FakeFileWatcher } from '../fakes/FakeFileWatcher';
import { MemoryRunLogger } from '../fakes/MemoryRunLogger';

/** Records each update as "refresh <path>" or "remove <path>"; set `failure` to make updates reject. */
class RecordingUpdates implements FileUpdates {
  readonly calls: string[] = [];
  failure: Error | null = null;

  async refreshFile(absolutePath: string): Promise<void> {
    this.record(`refresh ${absolutePath}`);
  }

  async removeFile(absolutePath: string): Promise<void> {
    this.record(`remove ${absolutePath}`);
  }

  private record(call: string): void {
    this.calls.push(call);
    if (this.failure) throw this.failure;
  }
}

let watcher: FakeFileWatcher;
let updates: RecordingUpdates;
let logger: MemoryRunLogger;
let watchFolder: WatchFolder;

const statuses = () => logger.indexed.map((entry) => entry.status);

beforeEach(() => {
  vi.useFakeTimers();
  watcher = new FakeFileWatcher();
  updates = new RecordingUpdates();
  logger = new MemoryRunLogger();
  watchFolder = new WatchFolder({ watcher, updates, logger, debounceMs: 500 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('WatchFolder', () => {
  it('reads a changed file again once it has been quiet for the debounce time', async () => {
    watchFolder.start('/p');
    const [watch] = watcher.watches;
    watch?.emit({ type: 'added', absolutePath: '/p/BOQ.xlsx' });
    await vi.advanceTimersByTimeAsync(300);
    watch?.emit({ type: 'changed', absolutePath: '/p/BOQ.xlsx' });
    await vi.advanceTimersByTimeAsync(300);
    watch?.emit({ type: 'changed', absolutePath: '/p/BOQ.xlsx' });

    await vi.advanceTimersByTimeAsync(499);
    expect(updates.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(updates.calls).toEqual(['refresh /p/BOQ.xlsx']);
  });

  it('times each file on its own', async () => {
    watchFolder.start('/p');
    const [watch] = watcher.watches;
    watch?.emit({ type: 'added', absolutePath: '/p/A.pdf' });
    await vi.advanceTimersByTimeAsync(300);
    watch?.emit({ type: 'added', absolutePath: '/p/B.pdf' });

    await vi.advanceTimersByTimeAsync(200);
    expect(updates.calls).toEqual(['refresh /p/A.pdf']);
    await vi.advanceTimersByTimeAsync(300);
    expect(updates.calls).toEqual(['refresh /p/A.pdf', 'refresh /p/B.pdf']);
  });

  it('drops a removed file, and reads a file replaced during a save again instead of dropping it', async () => {
    watchFolder.start('/p');
    const [watch] = watcher.watches;
    watch?.emit({ type: 'removed', absolutePath: '/p/Old.pdf' });
    watch?.emit({ type: 'removed', absolutePath: '/p/Saved.xlsx' });
    watch?.emit({ type: 'added', absolutePath: '/p/Saved.xlsx' });

    await vi.advanceTimersByTimeAsync(500);
    expect(updates.calls).toEqual(['remove /p/Old.pdf', 'refresh /p/Saved.xlsx']);
  });

  it('closes the old watch when another folder loads and ignores what the old one still reports', async () => {
    watchFolder.start('/p');
    const [first] = watcher.watches;
    first?.emit({ type: 'added', absolutePath: '/p/A.pdf' });

    watchFolder.start('/q');
    expect(first?.closed).toBe(true);
    expect(watcher.open().map((watch) => watch.folder)).toEqual(['/q']);
    expect(watchFolder.folder()).toBe('/q');
    first?.emit({ type: 'changed', absolutePath: '/p/B.pdf' });
    watcher.open()[0]?.emit({ type: 'added', absolutePath: '/q/C.pdf' });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(updates.calls).toEqual(['refresh /q/C.pdf']);
  });

  it('keeps the watch when the same folder loads again', () => {
    watchFolder.start('/p');
    watchFolder.start('/p');
    expect(watcher.watches).toHaveLength(1);
    expect(watcher.open()).toHaveLength(1);
  });

  it('stop closes the watch and cancels changes still waiting', async () => {
    watchFolder.start('/p');
    watcher.watches[0]?.emit({ type: 'added', absolutePath: '/p/A.pdf' });

    await watchFolder.stop();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(watcher.open()).toEqual([]);
    expect(watchFolder.folder()).toBeNull();
    expect(updates.calls).toEqual([]);
    await expect(watchFolder.stop()).resolves.toBeUndefined();
  });

  it('logs watcher errors and failed updates, and keeps watching', async () => {
    watchFolder.start('/p');
    const [watch] = watcher.watches;
    watch?.fail(new Error('EPERM: the folder could not be read'));
    updates.failure = new Error('disk full');
    watch?.emit({ type: 'added', absolutePath: '/p/Sub/A.pdf' });
    await vi.advanceTimersByTimeAsync(500);

    updates.failure = null;
    watch?.emit({ type: 'added', absolutePath: '/p/B.pdf' });
    await vi.advanceTimersByTimeAsync(500);

    expect(updates.calls).toEqual(['refresh /p/Sub/A.pdf', 'refresh /p/B.pdf']);
    expect(statuses()).toEqual(['watching', 'watch_error', 'watch_update_failed']);
    expect(logger.indexed[1]?.detail).toContain('EPERM');
    expect(logger.indexed[2]).toMatchObject({ folder: '/p', file: 'Sub/A.pdf' });
    expect(logger.indexed[2]?.detail).toContain('disk full');
  });

  it('logs a watch that cannot start, and watches the next folder normally', () => {
    watcher.failure = new Error('ENOSPC: too many watched files');
    watchFolder.start('/p');
    expect(watchFolder.folder()).toBeNull();
    expect(statuses()).toEqual(['watch_failed']);

    watcher.failure = null;
    watchFolder.start('/p');
    expect(watchFolder.folder()).toBe('/p');
    expect(watcher.open()).toHaveLength(1);
  });
});
