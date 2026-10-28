import type { DocumentSummary, IndexEvent, IndexPhase, IndexProgress, IndexStatus } from '@atlas/shared';
import { documentId, projectDocuments, suggestedQuestions } from './data/documents';
import { delay } from './http';

const idle: IndexStatus = { folder: null, phase: 'idle', progress: null, documents: [], suggestions: [], error: null };

/** The loaded folder and its indexing, played out over a few seconds with the events the real server sends. */
export class MockWorkspace {
  private current: IndexStatus = idle;
  private run = 0;
  private readonly listeners = new Set<(event: IndexEvent) => void>();

  status(): IndexStatus {
    return structuredClone(this.current);
  }

  subscribe(listener: (event: IndexEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Starts indexing the canned project as if it lived at `folder`. */
  load(folder: string): IndexStatus {
    this.current = { ...idle, folder, phase: 'scanning' };
    void this.index(folder, projectDocuments);
    return this.status();
  }

  /** Loads the canned project at once, with no progress, for MOCK_FOLDER. */
  loadReady(folder: string): void {
    this.current = { ...idle, folder, phase: 'ready', documents: structuredClone(projectDocuments), suggestions: suggestedQuestions };
  }

  /** Adds uploaded files by name and indexes just those. */
  upload(names: string[]): IndexStatus {
    const folder = this.current.folder ?? 'C:\\Users\\you\\Atlas\\uploads';
    const added = names.map(uploadedDocument);
    const known = new Set(added.map((d) => d.path));
    this.current = {
      ...this.current,
      folder,
      phase: 'scanning',
      documents: this.current.documents.filter((d) => !known.has(d.path)),
      error: null,
    };
    void this.index(folder, added);
    return this.status();
  }

  private async index(folder: string, documents: DocumentSummary[]): Promise<void> {
    const run = ++this.run;
    const stale = () => run !== this.run;
    const total = documents.length;

    this.progress('scanning', { current: 0, total, file: null, message: 'Looking for PDF and Excel files' });
    await delay(700);
    for (const [i, document] of documents.entries()) {
      if (stale()) return;
      this.progress('reading', { current: i + 1, total, file: document.name, message: `Reading ${document.name}, ${i + 1} of ${total}` });
      await delay(readMs(document));
      if (stale()) return;
      this.put({ ...structuredClone(document), classification: null });
    }

    this.progress('embedding', { current: 1, total: 1, file: null, message: 'Preparing search over 1,284 passages' });
    await delay(900);
    if (stale()) return;
    const readable = documents.filter((d) => d.classification !== null);
    for (const [i, document] of readable.entries()) {
      this.progress('classifying', { current: i + 1, total: readable.length, file: document.name, message: `Sorting ${document.name} by type` });
      await delay(120);
      if (stale()) return;
      this.put(structuredClone(document));
    }

    this.current = { ...this.current, phase: 'ready', progress: null, suggestions: suggestedQuestions };
    this.emit({ type: 'ready', folder });
  }

  private progress(phase: IndexPhase, progress: IndexProgress): void {
    this.current = { ...this.current, phase, progress };
    this.emit({ type: 'progress', phase, progress });
  }

  private put(document: DocumentSummary): void {
    const documents = this.current.documents;
    const known = documents.some((d) => d.path === document.path);
    this.current = {
      ...this.current,
      documents: known ? documents.map((d) => (d.path === document.path ? document : d)) : [...documents, document],
    };
    this.emit({ type: 'document', document });
  }

  private emit(event: IndexEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

function readMs(document: DocumentSummary): number {
  if (document.status !== 'ok') return 150;
  return 250 + Math.min(900, (document.pageCount ?? 10) * 3);
}

function uploadedDocument(name: string): DocumentSummary {
  const path = `Uploads/${name}`;
  const lower = name.toLowerCase();
  const kind = lower.endsWith('.pdf') ? 'pdf' : lower.endsWith('.xlsx') || lower.endsWith('.xls') ? 'excel' : 'other';
  return {
    id: documentId(path),
    name,
    path,
    kind,
    status: kind === 'other' ? 'skipped' : 'ok',
    statusDetail: kind === 'other' ? 'Only PDF and Excel files are read.' : null,
    sizeBytes: 120_000,
    pageCount: kind === 'pdf' ? 3 : null,
    scannedPages: [],
    sheets: kind === 'excel' ? ['Sheet1'] : [],
    tables: [],
    currencies: [],
    language: kind === 'other' ? null : 'en',
    classification:
      kind === 'other'
        ? null
        : { type: 'Other', confidence: 0.55, metadata: { projectName: null, parties: [], contractValue: null, keyDates: [] } },
  };
}
