import type { FileChange, FileWatcher, WatchHandle } from '../../src/application/ports/FileWatcher';

/** One watch the fake started; the test sends changes and errors through it. */
export interface FakeWatch {
  folder: string;
  closed: boolean;
  /** Delivers a change, even after close, like a late event from the disk. */
  emit(change: FileChange): void;
  fail(error: Error): void;
}

/** Records every watch it starts; nothing touches the disk. Set `failure` to make the next watch throw. */
export class FakeFileWatcher implements FileWatcher {
  readonly watches: FakeWatch[] = [];
  failure: Error | null = null;

  watch(folder: string, onChange: (change: FileChange) => void, onError: (error: Error) => void): WatchHandle {
    if (this.failure) throw this.failure;
    const watch: FakeWatch = { folder, closed: false, emit: onChange, fail: onError };
    this.watches.push(watch);
    return {
      close: async () => {
        watch.closed = true;
      },
    };
  }

  /** The watches still open. */
  open(): FakeWatch[] {
    return this.watches.filter((watch) => !watch.closed);
  }
}
