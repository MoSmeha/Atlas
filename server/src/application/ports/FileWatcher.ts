export interface FileChange {
  type: 'added' | 'changed' | 'removed';
  absolutePath: string;
}

export interface WatchHandle {
  close(): Promise<void>;
}

export interface FileWatcher {
  /**
   * Reports files added, changed or removed under the folder while the app runs. Problems while watching go to
   * onError and never throw.
   */
  watch(folder: string, onChange: (change: FileChange) => void, onError: (error: Error) => void): WatchHandle;
}
