export interface FileEntry {
  absolutePath: string;
  /** Relative to the scanned root, with forward slashes. */
  relativePath: string;
  name: string;
  /** Lower case with the dot, for example '.xlsx'; empty when there is none. */
  extension: string;
  size: number;
  mtimeMs: number;
}

export interface FileSystem {
  isDirectory(path: string): Promise<boolean>;
  /** Every file under root, recursively, skipping hidden files and folders and Office lock files (`isIgnoredName`). */
  listFiles(root: string): Promise<FileEntry[]>;
  /** One file's entry relative to root, or null when it does not exist. */
  stat(root: string, absolutePath: string): Promise<FileEntry | null>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array | string): Promise<void>;
  ensureDir(path: string): Promise<void>;
  /**
   * Deletes a file or folder under root, given relative to it with forward slashes, or root itself for ''. A folder
   * goes with everything in it; a path that does not exist is fine.
   */
  remove(root: string, relativePath: string): Promise<void>;
}
