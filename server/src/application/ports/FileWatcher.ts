export interface FileChange {
  type: 'added' | 'changed' | 'removed';
  absolutePath: string;
}

export interface WatchHandle {
  close(): Promise<void>;
}

export interface FileWatcher {
  /** Reports files added, changed or removed under the folder while the app runs. */
  watch(folder: string, onChange: (change: FileChange) => void): WatchHandle;
}
