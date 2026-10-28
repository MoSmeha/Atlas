import type { FileKind } from '@atlas/shared';
import { kindForExtension, skipReason } from '../../domain/fileTypes';
import { errors } from '../errors';
import type { FileEntry, FileSystem } from '../ports/FileSystem';

/** 'pending' means a reader still has to open the file; the others are final. */
export type ScanStatus = 'pending' | 'skipped' | 'too_large' | 'empty';

export interface ScannedFile {
  entry: FileEntry;
  kind: FileKind;
  status: ScanStatus;
  /** Plain-language reason for every status except 'pending'. */
  detail: string | null;
}

export interface ScanOptions {
  maxFileBytes: number;
}

const MB = 1024 * 1024;

/**
 * Lists every file in a folder, sorted by relative path, and decides which ones the readers open.
 * Throws folder_not_found when the path is not a directory. An empty result is the caller's to report.
 */
export async function scanFolder(fs: FileSystem, folder: string, options: ScanOptions): Promise<{ files: ScannedFile[] }> {
  if (!(await fs.isDirectory(folder))) throw errors.folderNotFound(folder);
  const entries = await fs.listFiles(folder);
  const files = entries.map((entry) => scanFile(entry, options));
  return { files: files.sort((a, b) => compare(a.entry.relativePath, b.entry.relativePath)) };
}

/** The scan decision for one file, also used when the watcher reports a single change. */
export function scanFile(entry: FileEntry, options: ScanOptions): ScannedFile {
  const kind = kindForExtension(entry.extension);
  const reason = skipReason(entry.extension);
  if (reason !== null) return { entry, kind, status: 'skipped', detail: reason };
  if (entry.size === 0) return { entry, kind, status: 'empty', detail: 'The file is empty (0 bytes).' };
  if (entry.size > options.maxFileBytes) {
    const detail = `The file is ${megabytes(entry.size, Math.ceil)} MB, larger than the ${megabytes(options.maxFileBytes, Math.round)} MB limit.`;
    return { entry, kind, status: 'too_large', detail };
  }
  return { entry, kind, status: 'pending', detail: null };
}

/** One decimal. The file size rounds up so it never reads as equal to the limit it exceeds. */
function megabytes(bytes: number, round: (value: number) => number): string {
  return String(round((bytes / MB) * 10) / 10);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
