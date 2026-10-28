import type { ParsedDocument } from '../../domain/document';

/**
 * What reading one file produced. `scanned` means no page has a text layer; the document is still
 * usable through page images. Readers never throw for a bad file; they return a status instead.
 */
export type ReadOutcome =
  | { status: 'ok' | 'scanned'; document: ParsedDocument; detail: string | null }
  | { status: 'empty' | 'corrupt' | 'encrypted'; detail: string };

export interface DocumentReader {
  /** Lower-case extensions including the dot, for example ['.pdf']. */
  readonly extensions: readonly string[];
  read(filePath: string): Promise<ReadOutcome>;
}
