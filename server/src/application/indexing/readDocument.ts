import type { DocumentRecord } from '../ports/DocumentIndex';
import type { DocumentReader } from '../ports/DocumentReader';
import { buildRecord, statusRecord } from './buildRecord';
import type { ScannedFile } from './scanFolder';

/**
 * Reads one scanned file with the reader for its extension and builds its record. Never throws: a file the scan
 * already ruled out keeps its scan status, and a reader or table step that fails gives a corrupt record with the message.
 */
export async function readDocument(file: ScannedFile, readers: readonly DocumentReader[]): Promise<DocumentRecord> {
  if (file.status !== 'pending') return statusRecord(file, file.status, file.detail);
  const { extension, absolutePath } = file.entry;
  const reader = readers.find((candidate) => candidate.extensions.includes(extension));
  if (reader === undefined) return statusRecord(file, 'skipped', `No reader is set up for ${extension} files.`);
  try {
    return buildRecord(file, await reader.read(absolutePath));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return statusRecord(file, 'corrupt', `The file could not be read: ${message}`);
  }
}
