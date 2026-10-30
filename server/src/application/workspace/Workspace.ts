import type { DocumentSummary, ErrorDetail, IndexEvent, IndexStatus } from '@atlas/shared';
import { errors } from '../errors';
import type { DocumentIndex } from '../ports/DocumentIndex';

const idle: IndexStatus = {
  folder: null,
  phase: 'idle',
  progress: null,
  documents: [],
  suggestions: [],
  error: null,
  uploads: false,
  removed: [],
};

/** The folder currently loaded, its index and its indexing status, shared by every use case. */
export class Workspace {
  private current: IndexStatus = idle;
  private active: { folder: string; index: DocumentIndex } | null = null;
  private readonly listeners = new Set<(event: IndexEvent) => void>();

  status(): IndexStatus {
    if (!this.active) return this.current;
    const { index } = this.active;
    return { ...this.current, documents: index.documents(), removed: index.excluded() };
  }

  /**
   * Makes a folder current, closing the index of the previous one. `uploads` marks Atlas's own uploads folder, whose
   * files are copies Atlas may delete.
   */
  activate(folder: string, index: DocumentIndex, { uploads = false }: { uploads?: boolean } = {}): void {
    if (this.active && this.active.index !== index) this.active.index.close();
    this.active = { folder, index };
    this.current = { ...idle, folder, phase: 'scanning', uploads };
  }

  /** Shows a folder that could not be loaded, with the files found in it; the previous folder is closed. */
  failLoad(folder: string, documents: DocumentSummary[], error: ErrorDetail): void {
    this.active?.index.close();
    this.active = null;
    this.current = { ...idle, folder, phase: 'error', documents, error };
  }

  /** Closes the loaded folder's index; nothing is loaded afterwards. */
  unload(): void {
    this.active?.index.close();
    this.active = null;
    this.current = idle;
  }

  update(patch: Partial<Omit<IndexStatus, 'documents' | 'removed'>>): void {
    this.current = { ...this.current, ...patch };
  }

  /** The loaded folder and index; throws not_indexed when nothing is loaded. */
  require(): { folder: string; index: DocumentIndex } {
    if (!this.active) throw errors.notIndexed();
    return this.active;
  }

  emit(event: IndexEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: (event: IndexEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
