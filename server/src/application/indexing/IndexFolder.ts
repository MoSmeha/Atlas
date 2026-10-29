import { relative, resolve, sep } from 'node:path';
import type { ErrorDetail, IndexPhase, IndexProgress, IndexStatus } from '@atlas/shared';
import { isIgnoredName } from '../../domain/fileTypes';
import { cleanItemPath, isWithin, isWithinAny } from '../../domain/folderItems';
import { AppError, errors } from '../errors';
import type { Clock } from '../ports/Clock';
import type { DocumentIndex, DocumentIndexFactory, DocumentRecord, Fingerprint } from '../ports/DocumentIndex';
import type { DocumentReader } from '../ports/DocumentReader';
import type { EmbeddingClient } from '../ports/EmbeddingClient';
import type { FileEntry, FileSystem } from '../ports/FileSystem';
import type { RunLogger } from '../ports/RunLogger';
import type { Workspace } from '../workspace/Workspace';
import { embedPending } from './embedPending';
import { readDocument } from './readDocument';
import { scanFile, scanFolder, type ScannedFile } from './scanFolder';
import { scanSummary } from './scanSummary';

export interface IndexStepContext {
  folder: string;
  index: DocumentIndex;
  /** Relative paths saved in this pass: new and changed files, whatever their status. */
  changedPaths: string[];
  signal: AbortSignal;
  /** Shows the step's own progress under its phase, such as "Classifying 3 of 12". */
  report(progress: IndexProgress): void;
  /** Sends the document's fresh summary to the client after the step changed it. */
  documentChanged(path: string): void;
}

/** Work after reading and embedding, such as classifying documents; the workspace shows its phase while it runs. */
export interface IndexStep {
  phase: IndexPhase;
  run(context: IndexStepContext): Promise<void>;
}

export interface IndexFolderDeps {
  fs: FileSystem;
  readers: DocumentReader[];
  indexes: DocumentIndexFactory;
  /** Null without an API key; search then works by keyword only. */
  embeddings: EmbeddingClient | null;
  workspace: Workspace;
  logger: RunLogger;
  clock: Clock;
  maxFileBytes: number;
  /** Run in order after embedding, on every pass and every watcher update. */
  steps?: IndexStep[];
  /** Called each time a folder becomes current, for example to start watching it. */
  onFolderActivated?: (folder: string) => void;
  /** Called when the folder is removed from Atlas, before its files are touched, for example to stop watching it. */
  onFolderUnloaded?: () => Promise<void>;
  /** Atlas's own uploads folder: its files are copies, so removing one deletes it. Null when there is none. */
  uploadsDir?: string | null;
}

interface Loaded {
  folder: string;
  index: DocumentIndex;
  /** Aborts this load's pass and the watcher updates queued behind it. */
  controller: AbortController;
  /** The folder is the uploads folder. */
  uploads: boolean;
  /** Uploaded files and folders deleted during this load, which a pass that listed them earlier must not save. */
  deleted: string[];
}

const STEP_MESSAGES: Partial<Record<IndexPhase, string>> = { classifying: 'Classifying documents' };
const INTERNAL_MESSAGE = 'Indexing stopped because of an unexpected problem. Details are in the server log.';

/**
 * Loads a folder: scans it, makes it current, and indexes it in the background. Each pass reads only new and changed
 * files, one bad file never stops the others, files that disappeared leave the index, and then come embeddings and
 * the extra steps. Progress and results reach the workspace status and its events. Passes and watcher updates run
 * one at a time; loading again cancels the pass in progress.
 */
export class IndexFolder {
  private readonly deps: IndexFolderDeps;
  private loaded: Loaded | null = null;
  /** The pass and the watcher updates queued behind it. */
  private work: Promise<void> = Promise.resolve();

  constructor(deps: IndexFolderDeps) {
    this.deps = deps;
  }

  /**
   * Scans the folder and starts indexing it, returning the status straight away. Throws folder_not_found when it is
   * not a directory, and folder_empty when it holds no PDF or Excel file (the files it does hold show in the status).
   */
  async load(folder: string): Promise<IndexStatus> {
    const { fs, workspace, indexes, maxFileBytes } = this.deps;
    const { files } = await scanFolder(fs, folder, { maxFileBytes });
    if (!files.some((file) => file.kind !== 'other')) {
      const error = errors.folderEmpty(folder, files.length);
      this.loaded?.controller.abort();
      this.loaded = null;
      workspace.failLoad(folder, files.map(scanSummary), detailOf(error));
      throw error;
    }

    const index = this.loaded?.folder === folder ? this.loaded.index : indexes.open(folder);
    this.loaded?.controller.abort();
    const uploads = this.isUploads(folder);
    const loaded: Loaded = { folder, index, controller: new AbortController(), uploads, deleted: [] };
    this.loaded = loaded;
    workspace.activate(folder, index, { uploads });
    this.announce(folder);
    void this.enqueue(loaded, (signal) => this.pass(loaded, files, signal));
    return workspace.status();
  }

  /** Re-reads one file the watcher saw added or changed, then embeds it and runs the steps for it. */
  refreshFile(absolutePath: string): Promise<void> {
    const loaded = this.loaded;
    if (loaded === null) return Promise.resolve();
    return this.enqueue(loaded, (signal) => this.refresh(loaded, absolutePath, signal));
  }

  /** Drops a file the watcher saw removed. */
  removeFile(absolutePath: string): Promise<void> {
    const loaded = this.loaded;
    if (loaded === null) return Promise.resolve();
    return this.enqueue(loaded, async () => {
      const path = folderPath(loaded.folder, absolutePath);
      if (path !== null) this.forget(loaded, path);
    });
  }

  /**
   * Removes a file or subfolder from Atlas, and its pages, tables and passages from the index, straight away. In the
   * uploads folder the uploaded copies are deleted; in a folder loaded by its path the files stay on disk and later
   * scans leave them out until they are put back. Throws document_not_found when nothing loaded lies at that path.
   */
  async remove(path: string): Promise<IndexStatus> {
    const loaded = this.require();
    const item = itemPath(path);
    const documents = loaded.index.documents().filter((document) => isWithin(document.path, item));
    if (documents.length === 0) throw errors.documentNotFound(item);
    if (loaded.uploads) {
      // Marked first, so a pass reading the file right now does not save it once it is gone.
      loaded.deleted.push(item);
      try {
        await this.deps.fs.remove(loaded.folder, item);
      } catch (error) {
        loaded.deleted.pop();
        throw error;
      }
    } else {
      // A removed folder covers anything removed inside it, so putting the folder back brings all of it back.
      for (const earlier of loaded.index.excluded()) if (isWithin(earlier, item)) loaded.index.include(earlier);
      loaded.index.exclude(item);
    }
    for (const document of documents) this.forget(loaded, document.path);
    return this.deps.workspace.status();
  }

  /** Puts a removed file or subfolder back: the folder is scanned again, which reads what it holds. */
  async restore(path: string): Promise<IndexStatus> {
    const loaded = this.require();
    const item = itemPath(path);
    if (!loaded.index.excluded().includes(item)) throw errors.documentNotFound(item);
    loaded.index.include(item);
    this.log(loaded.folder, item, 'restored', 0, null);
    return this.load(loaded.folder);
  }

  /**
   * Removes the loaded folder from Atlas: indexing stops, the folder is no longer watched and its index is deleted.
   * Uploaded files are deleted too; a folder loaded by its path keeps its files. Nothing is loaded afterwards.
   */
  async unload(): Promise<IndexStatus> {
    const loaded = this.require();
    const { workspace } = this.deps;
    loaded.controller.abort();
    this.loaded = null;
    try {
      await this.deps.onFolderUnloaded?.();
    } catch (error) {
      this.log(loaded.folder, '', 'unwatch_failed', 0, logText(error));
    }
    workspace.unload();
    await this.deps.indexes.discard(loaded.folder);
    if (loaded.uploads) await this.deps.fs.remove(loaded.folder, '');
    this.log(loaded.folder, '', 'unloaded', 0, null);
    workspace.emit({ type: 'unloaded', folder: loaded.folder });
    return workspace.status();
  }

  /** Resolves once the pass and every queued update have finished, with the status they left. */
  async idle(): Promise<IndexStatus> {
    let current: Promise<void>;
    do {
      current = this.work;
      await current;
    } while (current !== this.work);
    return this.deps.workspace.status();
  }

  private enqueue(loaded: Loaded, job: (signal: AbortSignal) => Promise<void>): Promise<void> {
    const { signal } = loaded.controller;
    const run = this.work.then(() => (signal.aborted ? undefined : job(signal)));
    this.work = run.catch(() => undefined);
    return run;
  }

  private async pass(loaded: Loaded, files: ScannedFile[], signal: AbortSignal): Promise<void> {
    await this.guard(loaded, signal, async () => {
      const { index } = loaded;
      const kept = files.filter((file) => !this.isRemoved(loaded, file.entry.relativePath));
      const present = new Set(kept.map((file) => file.entry.relativePath));
      for (const document of index.documents()) if (!present.has(document.path)) this.forget(loaded, document.path);

      const changed: ScannedFile[] = [];
      for (const file of kept) {
        if (!sameFingerprint(index.fingerprint(file.entry.relativePath), file.entry)) changed.push(file);
        else this.log(loaded.folder, file.entry.relativePath, 'unchanged', 0, null);
      }

      const saved: string[] = [];
      const keep = (path: string | null) => {
        if (path !== null) saved.push(path);
      };
      for (const file of changed.filter((candidate) => candidate.status !== 'pending')) {
        keep(await this.indexFile(loaded, file, signal));
      }
      const toRead = changed.filter((candidate) => candidate.status === 'pending');
      for (const [i, file] of toRead.entries()) {
        checkpoint(signal);
        // Removed while this pass was running.
        if (this.isRemoved(loaded, file.entry.relativePath)) continue;
        const { name } = file.entry;
        this.progress(signal, 'reading', { current: i + 1, total: toRead.length, file: name, message: `Reading ${name}, ${i + 1} of ${toRead.length}` });
        keep(await this.indexFile(loaded, file, signal));
      }
      await this.finish(loaded, saved, signal);
    });
  }

  private async refresh(loaded: Loaded, absolutePath: string, signal: AbortSignal): Promise<void> {
    await this.guard(loaded, signal, async () => {
      const entry = await this.deps.fs.stat(loaded.folder, absolutePath);
      checkpoint(signal);
      if (entry === null) {
        const path = folderPath(loaded.folder, absolutePath);
        if (path !== null) this.forget(loaded, path);
        return;
      }
      const { relativePath } = entry;
      if (!isListed(relativePath) || this.isRemoved(loaded, relativePath)) return;
      if (sameFingerprint(loaded.index.fingerprint(relativePath), entry)) return;
      const file = scanFile(entry, { maxFileBytes: this.deps.maxFileBytes });
      if (file.status === 'pending') {
        this.progress(signal, 'reading', { current: 1, total: 1, file: entry.name, message: `Reading ${entry.name}, 1 of 1` });
      }
      const saved = await this.indexFile(loaded, file, signal);
      await this.finish(loaded, saved === null ? [] : [saved], signal);
    });
  }

  /** Reads, saves, logs and reports one file; returns its relative path, or null when it was removed meanwhile. */
  private async indexFile(loaded: Loaded, file: ScannedFile, signal: AbortSignal): Promise<string | null> {
    const { clock } = this.deps;
    const started = clock.now().getTime();
    const read = await readDocument(file, this.deps.readers);
    checkpoint(signal);
    if (this.isRemoved(loaded, file.entry.relativePath)) return null;
    const record = saveRecord(loaded.index, read);
    this.log(loaded.folder, record.path, record.status, clock.now().getTime() - started, record.statusDetail);
    this.emitDocument(loaded.index, record.path);
    return record.path;
  }

  /** Embeddings, then each step, then ready. */
  private async finish(loaded: Loaded, changedPaths: string[], signal: AbortSignal): Promise<void> {
    await this.embed(loaded, signal);
    const steps = this.deps.steps ?? [];
    for (const [i, step] of steps.entries()) {
      checkpoint(signal);
      const message = STEP_MESSAGES[step.phase] ?? 'Finishing up';
      this.progress(signal, step.phase, { current: i + 1, total: steps.length, file: null, message });
      await step.run({
        folder: loaded.folder,
        index: loaded.index,
        changedPaths,
        signal,
        report: (progress) => this.progress(signal, step.phase, progress),
        documentChanged: (path) => this.emitDocument(loaded.index, path),
      });
    }
    checkpoint(signal);
    this.deps.workspace.update({ phase: 'ready', progress: null, error: null });
    this.deps.workspace.emit({ type: 'ready', folder: loaded.folder });
  }

  private async embed(loaded: Loaded, signal: AbortSignal): Promise<void> {
    const { embeddings, clock } = this.deps;
    const total = loaded.index.pendingEmbeddingCount();
    if (embeddings === null || total === 0) return;
    const started = clock.now().getTime();
    const report = (done: number, all: number) =>
      this.progress(signal, 'embedding', { current: done, total: all, file: null, message: `Embedding ${count(done)} of ${count(all)} passages` });
    report(0, total);
    const result = await embedPending(loaded.index, embeddings, { signal, onProgress: report });
    const detail =
      result.stoppedBecause === null
        ? `${result.embedded} passages, ${result.tokens} tokens.`
        : `Stopped after ${result.embedded} passages, so search works by keyword only: ${result.stoppedBecause}`;
    this.log(loaded.folder, '', result.stoppedBecause === null ? 'embedded' : 'embedding_skipped', clock.now().getTime() - started, detail);
  }

  /** Runs a pass or an update; a failure sets phase 'error', unless the work was cancelled by a newer load. */
  private async guard(loaded: Loaded, signal: AbortSignal, job: () => Promise<void>): Promise<void> {
    const { clock, workspace } = this.deps;
    const started = clock.now().getTime();
    try {
      await job();
    } catch (error) {
      if (signal.aborted) return;
      const detail = detailOf(error);
      this.log(loaded.folder, '', 'error', clock.now().getTime() - started, logText(error));
      workspace.update({ phase: 'error', progress: null, error: detail });
      workspace.emit({ type: 'error', error: detail });
    }
  }

  private require(): Loaded {
    if (this.loaded === null) throw errors.notIndexed();
    return this.loaded;
  }

  /** The path was removed from Atlas: excluded in this folder, or an uploaded copy deleted during this load. */
  private isRemoved(loaded: Loaded, path: string): boolean {
    return isWithinAny(path, loaded.deleted) || isWithinAny(path, loaded.index.excluded());
  }

  private isUploads(folder: string): boolean {
    const uploads = this.deps.uploadsDir ?? null;
    if (uploads === null) return false;
    // Windows paths ignore case, so the same folder may arrive spelt differently.
    const key = (path: string) => (process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path));
    return key(folder) === key(uploads);
  }

  private forget(loaded: Loaded, path: string): void {
    if (loaded.index.fingerprint(path) === null) return;
    loaded.index.remove(path);
    this.log(loaded.folder, path, 'removed', 0, null);
    this.deps.workspace.emit({ type: 'removed', path });
  }

  private emitDocument(index: DocumentIndex, path: string): void {
    const summary = index.find(path);
    if (summary !== null) this.deps.workspace.emit({ type: 'document', document: summary });
  }

  private progress(signal: AbortSignal, phase: IndexPhase, progress: IndexProgress): void {
    if (signal.aborted) return;
    this.deps.workspace.update({ phase, progress });
    this.deps.workspace.emit({ type: 'progress', phase, progress });
  }

  private announce(folder: string): void {
    try {
      this.deps.onFolderActivated?.(folder);
    } catch (error) {
      this.log(folder, '', 'activation_failed', 0, logText(error));
    }
  }

  private log(folder: string, file: string, status: string, durationMs: number, detail: string | null): void {
    this.deps.logger.indexing({ folder, file, status, durationMs, detail });
  }
}

/** Saves a record; when the index cannot store its content, the file is kept as corrupt with the reason. */
function saveRecord(index: DocumentIndex, record: DocumentRecord): DocumentRecord {
  try {
    index.save(record);
    return record;
  } catch (error) {
    const fallback: DocumentRecord = {
      ...record,
      status: 'corrupt',
      statusDetail: `The file could not be stored in the index: ${error instanceof Error ? error.message : String(error)}`,
      pages: [],
      chunks: [],
      tables: [],
      sheetRows: [],
    };
    index.save(fallback);
    return fallback;
  }
}

function sameFingerprint(stored: Fingerprint | null, entry: FileEntry): boolean {
  return stored !== null && stored.mtimeMs === entry.mtimeMs && stored.size === entry.size;
}

/** A file or subfolder path from a request, cleaned; throws invalid_request for one outside the folder. */
function itemPath(path: string): string {
  const item = cleanItemPath(path);
  if (item === null || !isListed(item)) throw errors.invalidRequest(`"${path}" is not a file or folder inside the loaded folder.`);
  return item;
}

/** A path inside the folder that a listing would include: no hidden or lock-file segment and no '..'. */
function isListed(relativePath: string): boolean {
  return relativePath !== '' && !/^[A-Za-z]:|^\//.test(relativePath) && !relativePath.split('/').some(isIgnoredName);
}

/** The relative path the index uses for a file under the folder, or null when it lies outside it. */
function folderPath(folder: string, absolutePath: string): string | null {
  const path = relative(folder, absolutePath).split(sep).join('/');
  return isListed(path) ? path : null;
}

function checkpoint(signal: AbortSignal): void {
  if (signal.aborted) throw errors.stopped();
}

function detailOf(error: unknown): ErrorDetail {
  if (error instanceof AppError) return { code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds };
  return { code: 'internal', message: INTERNAL_MESSAGE };
}

function logText(error: unknown): string {
  if (error instanceof AppError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

function count(value: number): string {
  return value.toLocaleString('en-US');
}
