import type { IndexEvent } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/application/errors';
import { IndexFolder, type IndexStep, type IndexStepContext } from '../../src/application/indexing/IndexFolder';
import type { DocumentIndexFactory } from '../../src/application/ports/DocumentIndex';
import type { DocumentReader, ReadOutcome } from '../../src/application/ports/DocumentReader';
import type { EmbeddingClient } from '../../src/application/ports/EmbeddingClient';
import { Workspace } from '../../src/application/workspace/Workspace';
import { pdfPage, text } from '../domain/pdfPage';
import { sheet } from '../domain/tables/grid';
import { FakeClock } from '../fakes/FakeClock';
import { FakeEmbeddingClient } from '../fakes/FakeEmbeddingClient';
import { FakeFileSystem } from '../fakes/FakeFileSystem';
import { FakeIndex } from '../fakes/FakeIndex';
import { MemoryRunLogger } from '../fakes/MemoryRunLogger';

const pdf = (...pages: string[]): ReadOutcome => ({
  status: 'ok',
  document: { kind: 'pdf', pages: pages.map((content, i) => pdfPage(i + 1, [text(60, content)])) },
  detail: null,
});

const workbook: ReadOutcome = {
  status: 'ok',
  document: {
    kind: 'excel',
    sheets: [
      sheet(
        [
          ['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount (SAR)'],
          ['1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600],
          ['1.02', 'Bulk excavation', 'm3', 96_000, 42, 4_032_000],
        ],
        [],
        'Bill 1',
      ),
    ],
  },
  detail: null,
};

/** Returns the outcome set for each path, throws the errors set, and can hold a path until it is released. */
class ScriptedReader implements DocumentReader {
  readonly reads: string[] = [];
  private readonly held = new Map<string, Promise<void>>();

  constructor(
    readonly extensions: readonly string[],
    private readonly outcomes: Record<string, ReadOutcome | Error>,
  ) {}

  hold(path: string): () => void {
    let release = () => {};
    this.held.set(path, new Promise<void>((resolve) => (release = resolve)));
    return () => release();
  }

  async read(filePath: string): Promise<ReadOutcome> {
    this.reads.push(filePath);
    await this.held.get(filePath);
    const outcome = this.outcomes[filePath];
    if (outcome instanceof Error) throw outcome;
    return outcome ?? { status: 'corrupt', detail: 'No outcome scripted.' };
  }
}

class RecordingStep implements IndexStep {
  readonly runs: IndexStepContext[] = [];

  constructor(
    readonly phase: IndexStep['phase'] = 'classifying',
    private readonly failure: Error | null = null,
  ) {}

  async run(context: IndexStepContext): Promise<void> {
    this.runs.push(context);
    if (this.failure) throw this.failure;
  }
}

interface SetupOptions {
  outcomes?: Record<string, ReadOutcome | Error>;
  embeddings?: EmbeddingClient | null;
  steps?: IndexStep[];
  uploadsDir?: string;
}

function setup({ outcomes = {}, embeddings = new FakeEmbeddingClient(), steps, uploadsDir }: SetupOptions = {}) {
  const fs = new FakeFileSystem();
  const pdfReader = new ScriptedReader(['.pdf'], outcomes);
  const excelReader = new ScriptedReader(['.xlsx', '.xlsm'], outcomes);
  const indexes = new Map<string, FakeIndex>();
  const factory: DocumentIndexFactory = {
    open: (folder) => {
      const index = indexes.get(folder) ?? new FakeIndex();
      indexes.set(folder, index);
      return index;
    },
    discard: async (folder) => {
      indexes.delete(folder);
    },
  };
  const workspace = new Workspace();
  const events: IndexEvent[] = [];
  workspace.subscribe((event) => events.push(event));
  const logger = new MemoryRunLogger();
  const activated: string[] = [];
  const unloads: number[] = [];
  const indexFolder = new IndexFolder({
    fs,
    readers: [pdfReader, excelReader],
    indexes: factory,
    embeddings,
    workspace,
    logger,
    clock: new FakeClock(),
    maxFileBytes: 1000,
    steps,
    onFolderActivated: (folder) => activated.push(folder),
    onFolderUnloaded: async () => {
      unloads.push(unloads.length + 1);
    },
    uploadsDir,
  });
  return { fs, pdfReader, excelReader, indexes, workspace, events, logger, activated, unloads, indexFolder };
}

async function rejection(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('expected the promise to reject');
}

const statuses = (documents: { path: string; status: string }[]) =>
  Object.fromEntries(documents.map((document) => [document.path, document.status]));

describe('IndexFolder.load', () => {
  function mixedFolder() {
    const context = setup({
      outcomes: {
        '/p/BOQ.xlsx': workbook,
        '/p/Broken.pdf': new Error('mupdf blew up'),
        '/p/Contract.pdf': pdf('The contract sum is SAR 12,000,000.', 'Payment within 30 days.'),
        '/p/Locked.pdf': { status: 'encrypted', detail: 'The PDF is password-protected.' },
      },
    });
    for (const name of ['BOQ.xlsx', 'Broken.pdf', 'Contract.pdf', 'Locked.pdf', 'Notes.docx']) context.fs.addFile(`/p/${name}`, 'data');
    context.fs.addFile('/p/Empty.xlsx', '');
    context.fs.addFile('/p/Huge.pdf', 'x'.repeat(2000));
    return context;
  }

  it('returns the status at once and indexes in the background', async () => {
    const { indexFolder, activated } = mixedFolder();
    const status = await indexFolder.load('/p');
    expect(status).toMatchObject({ folder: '/p', phase: 'scanning', error: null });
    expect(activated).toEqual(['/p']);
    expect((await indexFolder.idle()).phase).toBe('ready');
  });

  it('gives every file a status, and a throwing reader does not stop the others', async () => {
    const { indexFolder, pdfReader } = mixedFolder();
    await indexFolder.load('/p');
    const status = await indexFolder.idle();

    expect(statuses(status.documents)).toEqual({
      'BOQ.xlsx': 'ok',
      'Broken.pdf': 'corrupt',
      'Contract.pdf': 'ok',
      'Empty.xlsx': 'empty',
      'Huge.pdf': 'too_large',
      'Locked.pdf': 'encrypted',
      'Notes.docx': 'skipped',
    });
    const broken = status.documents.find((document) => document.path === 'Broken.pdf');
    expect(broken?.statusDetail).toBe('The file could not be read: mupdf blew up');
    expect(pdfReader.reads).toEqual(['/p/Broken.pdf', '/p/Contract.pdf', '/p/Locked.pdf']);
    const boq = status.documents.find((document) => document.path === 'BOQ.xlsx');
    expect(boq).toMatchObject({ sheets: ['Bill 1'], currencies: ['SAR'] });
    expect(boq?.tables).toHaveLength(1);
  });

  it('emits progress per file read, a document event per file, embedding progress and ready', async () => {
    const { indexFolder, events } = mixedFolder();
    await indexFolder.load('/p');
    await indexFolder.idle();

    const reading = events.flatMap((event) => (event.type === 'progress' && event.phase === 'reading' ? [event.progress.message] : []));
    expect(reading).toEqual([
      'Reading BOQ.xlsx, 1 of 4',
      'Reading Broken.pdf, 2 of 4',
      'Reading Contract.pdf, 3 of 4',
      'Reading Locked.pdf, 4 of 4',
    ]);
    expect(events.filter((event) => event.type === 'document')).toHaveLength(7);
    const embedding = events.flatMap((event) => (event.type === 'progress' && event.phase === 'embedding' ? [event.progress.message] : []));
    expect(embedding).toEqual(['Embedding 0 of 2 passages', 'Embedding 2 of 2 passages']);
    expect(events.at(-1)).toEqual({ type: 'ready', folder: '/p' });
  });

  it('logs every file with its status', async () => {
    const { indexFolder, logger } = mixedFolder();
    await indexFolder.load('/p');
    await indexFolder.idle();
    const files = logger.indexed.filter((entry) => entry.file !== '');
    expect(files.map((entry) => [entry.file, entry.status])).toEqual([
      ['Empty.xlsx', 'empty'],
      ['Huge.pdf', 'too_large'],
      ['Notes.docx', 'skipped'],
      ['BOQ.xlsx', 'ok'],
      ['Broken.pdf', 'corrupt'],
      ['Contract.pdf', 'ok'],
      ['Locked.pdf', 'encrypted'],
    ]);
    expect(files.every((entry) => entry.folder === '/p' && typeof entry.durationMs === 'number')).toBe(true);
    expect(logger.indexed.find((entry) => entry.status === 'embedded')?.detail).toMatch(/^2 passages/);
  });

  it('skips unchanged files on the next load, re-reads changed ones and drops removed ones', async () => {
    const { fs, indexFolder, pdfReader, events } = mixedFolder();
    await indexFolder.load('/p');
    await indexFolder.idle();
    pdfReader.reads.length = 0;
    events.length = 0;

    fs.addFile('/p/Contract.pdf', 'new data', 2);
    fs.deleteFile('/p/Locked.pdf');
    await indexFolder.load('/p');
    const status = await indexFolder.idle();

    expect(pdfReader.reads).toEqual(['/p/Contract.pdf']);
    expect(events).toContainEqual({ type: 'removed', path: 'Locked.pdf' });
    expect(status.documents.map((document) => document.path)).not.toContain('Locked.pdf');
    expect(status.phase).toBe('ready');
  });

  it('works without embeddings', async () => {
    const { fs, indexFolder, events } = setup({ outcomes: { '/p/A.pdf': pdf('Concrete works') }, embeddings: null });
    fs.addFile('/p/A.pdf');
    await indexFolder.load('/p');
    expect((await indexFolder.idle()).phase).toBe('ready');
    expect(events.some((event) => event.type === 'progress' && event.phase === 'embedding')).toBe(false);
  });

  it('throws folder_not_found for a missing folder and leaves the status alone', async () => {
    const { indexFolder, workspace } = setup();
    const error = await rejection(indexFolder.load('/missing'));
    expect(error.code).toBe('folder_not_found');
    expect(workspace.status()).toMatchObject({ folder: null, phase: 'idle' });
  });

  it('throws folder_empty when no file is a PDF or workbook, listing the skipped files in the status', async () => {
    const { fs, indexFolder, workspace, activated } = setup();
    fs.addFile('/docs/Cover_Letter.docx');
    fs.addFile('/docs/photo.jpg');
    const error = await rejection(indexFolder.load('/docs'));
    expect(error.code).toBe('folder_empty');
    expect(error.message).toBe('No PDF or Excel files in /docs (2 other files skipped).');
    const status = workspace.status();
    expect(status).toMatchObject({ folder: '/docs', phase: 'error', error: { code: 'folder_empty' } });
    expect(statuses(status.documents)).toEqual({ 'Cover_Letter.docx': 'skipped', 'photo.jpg': 'skipped' });
    expect(activated).toEqual([]);
  });

  it('throws folder_empty for a folder with no files at all', async () => {
    const { fs, indexFolder } = setup();
    fs.addDir('/void');
    const error = await rejection(indexFolder.load('/void'));
    expect(error).toMatchObject({ code: 'folder_empty', message: 'The folder /void is empty.' });
  });

  it('cancels the pass in progress when another folder is loaded', async () => {
    const { fs, pdfReader, indexFolder, indexes, workspace } = setup({
      outcomes: { '/a/1.pdf': pdf('first'), '/a/2.pdf': pdf('second'), '/b/3.pdf': pdf('third') },
    });
    fs.addFile('/a/1.pdf');
    fs.addFile('/a/2.pdf');
    fs.addFile('/b/3.pdf');
    const release = pdfReader.hold('/a/1.pdf');

    await indexFolder.load('/a');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await indexFolder.load('/b');
    release();
    const status = await indexFolder.idle();

    expect(pdfReader.reads).toEqual(['/a/1.pdf', '/b/3.pdf']);
    expect(indexes.get('/a')?.documents()).toEqual([]);
    expect(status).toMatchObject({ folder: '/b', phase: 'ready' });
    expect(workspace.status().documents.map((document) => document.path)).toEqual(['3.pdf']);
  });
});

describe('IndexFolder steps', () => {
  it('runs each step after embedding with the changed paths, showing its phase', async () => {
    const step = new RecordingStep('classifying');
    const { fs, indexFolder, events } = setup({ outcomes: { '/p/A.pdf': pdf('Concrete works'), '/p/B.pdf': pdf('Steel') }, steps: [step] });
    fs.addFile('/p/A.pdf');
    fs.addFile('/p/B.pdf');
    await indexFolder.load('/p');
    await indexFolder.idle();

    expect(step.runs).toHaveLength(1);
    expect(step.runs[0]).toMatchObject({ folder: '/p', changedPaths: ['A.pdf', 'B.pdf'] });
    expect(step.runs[0]?.index.pendingEmbeddingCount()).toBe(0);
    const phases = events.flatMap((event) => (event.type === 'progress' ? [event.phase] : []));
    expect(phases.at(-1)).toBe('classifying');

    await indexFolder.load('/p');
    await indexFolder.idle();
    expect(step.runs[1]?.changedPaths).toEqual([]);
  });

  it('lets a step report its own progress and send changed documents', async () => {
    const step: IndexStep = {
      phase: 'classifying',
      async run({ index, report, documentChanged }) {
        report({ current: 1, total: 2, file: null, message: 'Classifying 1 of 2' });
        index.setClassification('A.pdf', { type: 'Contract', confidence: 0.9, metadata: { projectName: null, parties: [], contractValue: null, keyDates: [] } });
        documentChanged('A.pdf');
        documentChanged('Missing.pdf');
      },
    };
    const { fs, indexFolder, events } = setup({ outcomes: { '/p/A.pdf': pdf('Concrete works') }, steps: [step] });
    fs.addFile('/p/A.pdf');
    await indexFolder.load('/p');
    await indexFolder.idle();

    const afterSteps = events.slice(events.findIndex((event) => event.type === 'progress' && event.phase === 'classifying'));
    expect(afterSteps).toContainEqual({ type: 'progress', phase: 'classifying', progress: { current: 1, total: 2, file: null, message: 'Classifying 1 of 2' } });
    const documents = afterSteps.flatMap((event) => (event.type === 'document' ? [event.document] : []));
    expect(documents.map((document) => [document.path, document.classification?.type])).toEqual([['A.pdf', 'Contract']]);
    expect(afterSteps.at(-1)).toMatchObject({ type: 'ready' });
  });

  it('sets phase error with the error detail when a step fails', async () => {
    const step = new RecordingStep('classifying', new AppError('rate_limited', 'Slow down.', 20));
    const { fs, indexFolder, events } = setup({ outcomes: { '/p/A.pdf': pdf('Concrete works') }, steps: [step] });
    fs.addFile('/p/A.pdf');
    await indexFolder.load('/p');
    const status = await indexFolder.idle();

    expect(status).toMatchObject({ phase: 'error', progress: null, error: { code: 'rate_limited', message: 'Slow down.', retryAfterSeconds: 20 } });
    expect(events.at(-1)).toMatchObject({ type: 'error', error: { code: 'rate_limited' } });
  });

  it('hides the message of an unexpected error', async () => {
    const step = new RecordingStep('classifying', new Error('SQLITE_FULL'));
    const { fs, indexFolder, logger } = setup({ outcomes: { '/p/A.pdf': pdf('Concrete works') }, steps: [step] });
    fs.addFile('/p/A.pdf');
    await indexFolder.load('/p');
    const status = await indexFolder.idle();

    expect(status.error?.code).toBe('internal');
    expect(status.error?.message).not.toContain('SQLITE');
    expect(logger.indexed.find((entry) => entry.status === 'error')?.detail).toContain('SQLITE_FULL');
  });
});

describe('IndexFolder watcher updates', () => {
  it('indexes a new file, embeds it and runs the steps for it', async () => {
    const step = new RecordingStep();
    const { fs, indexFolder, events, workspace } = setup({
      outcomes: { '/p/A.pdf': pdf('Concrete works'), '/p/sub/B.pdf': pdf('Steel doors') },
      steps: [step],
    });
    fs.addFile('/p/A.pdf');
    await indexFolder.load('/p');
    await indexFolder.idle();
    events.length = 0;

    fs.addFile('/p/sub/B.pdf');
    await indexFolder.refreshFile('/p/sub/B.pdf');

    expect(events.map((event) => event.type)).toEqual(['progress', 'document', 'progress', 'progress', 'progress', 'ready']);
    expect(events[0]).toMatchObject({ phase: 'reading', progress: { message: 'Reading B.pdf, 1 of 1' } });
    expect(step.runs.at(-1)?.changedPaths).toEqual(['sub/B.pdf']);
    expect(workspace.status().documents.map((document) => document.path)).toEqual(['A.pdf', 'sub/B.pdf']);
  });

  it('ignores an unchanged file, a hidden file and a file outside the folder', async () => {
    const { fs, indexFolder, events, pdfReader } = setup({ outcomes: { '/p/A.pdf': pdf('Concrete works') } });
    fs.addFile('/p/A.pdf');
    fs.addFile('/p/.~lock.A.pdf');
    fs.addFile('/elsewhere/C.pdf');
    await indexFolder.load('/p');
    await indexFolder.idle();
    events.length = 0;

    await indexFolder.refreshFile('/p/A.pdf');
    await indexFolder.refreshFile('/p/.~lock.A.pdf');
    await indexFolder.refreshFile('/elsewhere/C.pdf');

    expect(events).toEqual([]);
    expect(pdfReader.reads).toEqual(['/p/A.pdf']);
  });

  it('removes a deleted file and reports it', async () => {
    const { fs, indexFolder, events, workspace } = setup({ outcomes: { '/p/A.pdf': pdf('a'), '/p/B.pdf': pdf('b') } });
    fs.addFile('/p/A.pdf');
    fs.addFile('/p/B.pdf');
    await indexFolder.load('/p');
    await indexFolder.idle();
    events.length = 0;

    fs.deleteFile('/p/B.pdf');
    await indexFolder.removeFile('/p/B.pdf');

    expect(events).toEqual([{ type: 'removed', path: 'B.pdf' }]);
    expect(workspace.status().documents.map((document) => document.path)).toEqual(['A.pdf']);
  });

  it('does nothing before a folder is loaded', async () => {
    const { indexFolder, events } = setup();
    await indexFolder.refreshFile('/p/A.pdf');
    await indexFolder.removeFile('/p/A.pdf');
    expect(events).toEqual([]);
  });
});

describe('IndexFolder removing files and folders', () => {
  const paths = (status: { documents: { path: string }[] }) => status.documents.map((document) => document.path);

  it('drops a file from a folder loaded by path, keeps it on disk and leaves it out of later scans', async () => {
    const { fs, indexFolder, events, pdfReader } = setup({ outcomes: { '/p/A.pdf': pdf('a'), '/p/B.pdf': pdf('b') } });
    fs.addFile('/p/A.pdf');
    fs.addFile('/p/B.pdf');
    await indexFolder.load('/p');
    await indexFolder.idle();
    events.length = 0;

    const status = await indexFolder.remove('B.pdf');

    expect(paths(status)).toEqual(['A.pdf']);
    expect(status).toMatchObject({ uploads: false, removed: ['B.pdf'] });
    expect(events).toEqual([{ type: 'removed', path: 'B.pdf' }]);
    expect(await fs.stat('/p', '/p/B.pdf')).not.toBeNull();

    await indexFolder.load('/p');
    await indexFolder.refreshFile('/p/B.pdf');
    expect(paths(await indexFolder.idle())).toEqual(['A.pdf']);
    expect(pdfReader.reads.filter((read) => read === '/p/B.pdf')).toHaveLength(1);
  });

  it('drops a subfolder with everything in it, and putting it back reads it again', async () => {
    const { fs, indexFolder } = setup({
      outcomes: { '/p/A.pdf': pdf('a'), '/p/Phase 2/B.pdf': pdf('b'), '/p/Phase 2/old/C.pdf': pdf('c') },
    });
    for (const path of ['/p/A.pdf', '/p/Phase 2/B.pdf', '/p/Phase 2/old/C.pdf']) fs.addFile(path);
    await indexFolder.load('/p');
    await indexFolder.idle();

    await indexFolder.remove('Phase 2/old/C.pdf');
    const status = await indexFolder.remove('Phase 2/');
    expect(paths(status)).toEqual(['A.pdf']);
    // The folder covers the file removed inside it earlier.
    expect(status.removed).toEqual(['Phase 2']);

    await indexFolder.restore('Phase 2');
    const restored = await indexFolder.idle();
    expect(paths(restored).sort()).toEqual(['A.pdf', 'Phase 2/B.pdf', 'Phase 2/old/C.pdf']);
    expect(restored.removed).toEqual([]);
  });

  it('deletes the uploaded copy when the folder is the uploads folder', async () => {
    const { fs, indexFolder } = setup({ outcomes: { '/up/A.pdf': pdf('a'), '/up/B.pdf': pdf('b') }, uploadsDir: '/up' });
    fs.addFile('/up/A.pdf');
    fs.addFile('/up/B.pdf');
    await indexFolder.load('/up');
    await indexFolder.idle();

    const status = await indexFolder.remove('B.pdf');

    expect(paths(status)).toEqual(['A.pdf']);
    expect(status).toMatchObject({ uploads: true, removed: [] });
    expect(await fs.stat('/up', '/up/B.pdf')).toBeNull();
  });

  it('does not save a file that was removed while the pass was reading it', async () => {
    for (const folder of ['/p', '/up']) {
      const { fs, indexFolder, pdfReader } = setup({
        outcomes: { [`${folder}/X/1.pdf`]: pdf('one'), [`${folder}/X/2.pdf`]: pdf('two') },
        uploadsDir: '/up',
      });
      fs.addFile(`${folder}/X/1.pdf`);
      fs.addFile(`${folder}/X/2.pdf`);
      const release = pdfReader.hold(`${folder}/X/2.pdf`);
      await indexFolder.load(folder);
      while (pdfReader.reads.length < 2) await new Promise((resolve) => setTimeout(resolve, 0));

      await indexFolder.remove('X');
      release();

      expect(paths(await indexFolder.idle())).toEqual([]);
    }
  });

  it('removes the whole folder: stops watching it, deletes its index and its uploaded files', async () => {
    const { fs, indexFolder, indexes, events, unloads } = setup({ outcomes: { '/up/A.pdf': pdf('a') }, uploadsDir: '/up' });
    fs.addFile('/up/A.pdf');
    await indexFolder.load('/up');
    await indexFolder.idle();

    const status = await indexFolder.unload();

    expect(status).toMatchObject({ folder: null, phase: 'idle', documents: [], removed: [] });
    expect(unloads).toEqual([1]);
    expect(indexes.has('/up')).toBe(false);
    expect(await fs.stat('/up', '/up/A.pdf')).toBeNull();
    expect(events.at(-1)).toEqual({ type: 'unloaded', folder: '/up' });
    expect((await rejection(indexFolder.remove('A.pdf'))).code).toBe('not_indexed');
  });

  it('keeps the files of a folder loaded by path when the folder is removed', async () => {
    const { fs, indexFolder, indexes } = setup({ outcomes: { '/p/A.pdf': pdf('a') }, uploadsDir: '/up' });
    fs.addFile('/p/A.pdf');
    await indexFolder.load('/p');
    await indexFolder.idle();

    await indexFolder.unload();

    expect(indexes.has('/p')).toBe(false);
    expect(await fs.stat('/p', '/p/A.pdf')).not.toBeNull();
  });

  it('refuses a path outside the folder, one that matches nothing, and work with no folder loaded', async () => {
    const { fs, indexFolder } = setup({ outcomes: { '/p/A.pdf': pdf('a') } });
    expect((await rejection(indexFolder.unload())).code).toBe('not_indexed');
    fs.addFile('/p/A.pdf');
    await indexFolder.load('/p');
    await indexFolder.idle();

    expect((await rejection(indexFolder.remove('../A.pdf'))).code).toBe('invalid_request');
    expect((await rejection(indexFolder.remove('C:/p/A.pdf'))).code).toBe('invalid_request');
    expect((await rejection(indexFolder.remove('Nope.pdf'))).code).toBe('document_not_found');
    expect((await rejection(indexFolder.restore('A.pdf'))).code).toBe('document_not_found');
  });
});
