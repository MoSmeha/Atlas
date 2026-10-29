import { describe, expect, it } from 'vitest';
import { AppError, errors } from '../../src/application/errors';
import { embedPending } from '../../src/application/indexing/embedPending';
import { FakeEmbeddingClient, embedText } from '../fakes/FakeEmbeddingClient';
import { FakeIndex } from '../fakes/FakeIndex';
import { pdfRecord } from '../fakes/records';

/** FakeEmbeddingClient that remembers the signal and can fail on a chosen call (1 = first). */
class ScriptedEmbeddings extends FakeEmbeddingClient {
  readonly signals: (AbortSignal | undefined)[] = [];
  private readonly failures: Map<number, Error>;

  constructor(failures: Record<number, Error> = {}) {
    super();
    this.failures = new Map(Object.entries(failures).map(([call, error]) => [Number(call), error]));
  }

  override async embed(texts: string[], signal?: AbortSignal): Promise<{ vectors: Float32Array[]; tokens: number }> {
    this.signals.push(signal);
    const failure = this.failures.get(this.signals.length);
    if (failure) throw failure;
    return super.embed(texts);
  }
}

function indexWith(...pages: string[][]): FakeIndex {
  const index = new FakeIndex();
  pages.forEach((texts, i) => index.save(pdfRecord(`doc${i + 1}.pdf`, texts)));
  return index;
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

describe('embedPending', () => {
  it('embeds every chunk exactly once and makes them findable by vector', async () => {
    const index = indexWith(['concrete works', 'electrical works'], ['steel doors']);
    const embeddings = new FakeEmbeddingClient();

    const result = await embedPending(index, embeddings);

    expect(result).toEqual({ embedded: 3, tokens: 6, stoppedBecause: null });
    expect(embeddings.calls.flat()).toEqual(['concrete works', 'electrical works', 'steel doors']);
    expect(index.pendingEmbeddingCount()).toBe(0);
    const [hit] = index.vectorSearch(embedText('electrical'), { document: null, limit: 1 });
    expect(hit).toMatchObject({ document: 'doc1.pdf', page: 2 });
  });

  it('sends batches of the given size and reports progress after each one', async () => {
    const index = indexWith(['a', 'b', 'c', 'd', 'e']);
    const embeddings = new FakeEmbeddingClient();
    const progress: [number, number][] = [];

    const result = await embedPending(index, embeddings, { batchSize: 2, onProgress: (done, total) => progress.push([done, total]) });

    expect(embeddings.calls).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
    expect(progress).toEqual([
      [2, 5],
      [4, 5],
      [5, 5],
    ]);
    expect(result.embedded).toBe(5);
  });

  it('uses batches of 256 by default', async () => {
    const index = indexWith(Array.from({ length: 300 }, (_, i) => `page ${i + 1}`));
    const embeddings = new FakeEmbeddingClient();
    await embedPending(index, embeddings);
    expect(embeddings.calls.map((call) => call.length)).toEqual([256, 44]);
  });

  it('leaves chunks that already have a vector alone', async () => {
    const index = indexWith(['scope of works', 'payment terms']);
    const embeddings = new FakeEmbeddingClient();
    await embedPending(index, embeddings);

    index.save(pdfRecord('Annex.pdf', ['retention']));
    const second = await embedPending(index, embeddings);
    expect(second).toEqual({ embedded: 1, tokens: 1, stoppedBecause: null });
    expect(embeddings.calls).toEqual([['scope of works', 'payment terms'], ['retention']]);

    expect(await embedPending(index, embeddings)).toEqual({ embedded: 0, tokens: 0, stoppedBecause: null });
    expect(embeddings.calls).toHaveLength(2);
  });

  it('makes no call when nothing is waiting', async () => {
    const embeddings = new FakeEmbeddingClient();
    const progress: number[] = [];
    const result = await embedPending(new FakeIndex(), embeddings, { onProgress: (done) => progress.push(done) });
    expect(result).toEqual({ embedded: 0, tokens: 0, stoppedBecause: null });
    expect(embeddings.calls).toEqual([]);
    expect(progress).toEqual([]);
  });

  it('stops quietly without an API key and keeps the batches already saved', async () => {
    const index = indexWith(['a', 'b', 'c', 'd', 'e']);
    const embeddings = new ScriptedEmbeddings({ 2: errors.missingApiKey() });

    const result = await embedPending(index, embeddings, { batchSize: 2 });

    expect(result).toEqual({ embedded: 2, tokens: 2, stoppedBecause: errors.missingApiKey().message });
    expect(index.pendingEmbeddings(10).map((chunk) => chunk.text)).toEqual(['c', 'd', 'e']);
  });

  it('stops quietly with the reason when the API is out of quota or rate limited', async () => {
    const index = indexWith(['a', 'b', 'c']);
    const embeddings = new ScriptedEmbeddings({ 2: errors.rateLimited(5) });

    const result = await embedPending(index, embeddings, { batchSize: 1 });

    expect(result).toEqual({ embedded: 1, tokens: 1, stoppedBecause: errors.rateLimited(5).message });
    expect(index.pendingEmbeddingCount()).toBe(2);
  });

  it('passes unexpected errors on, after saving the batches that worked', async () => {
    const index = indexWith(['a', 'b', 'c']);
    const embeddings = new ScriptedEmbeddings({ 2: new Error('socket closed') });

    await expect(embedPending(index, embeddings, { batchSize: 1 })).rejects.toThrow('socket closed');
    expect(index.pendingEmbeddingCount()).toBe(2);
  });

  it('passes the signal to the client and stops before a batch once it is aborted', async () => {
    const index = indexWith(['a', 'b', 'c']);
    const controller = new AbortController();
    const embeddings = new ScriptedEmbeddings();

    const error = await rejection(
      embedPending(index, embeddings, { batchSize: 1, signal: controller.signal, onProgress: () => controller.abort() }),
    );

    expect(error.code).toBe('stopped');
    expect(embeddings.signals).toEqual([controller.signal]);
    expect(index.pendingEmbeddingCount()).toBe(2);
  });

  it('refuses a reply with the wrong number of vectors', async () => {
    class ShortEmbeddings extends FakeEmbeddingClient {
      override async embed(texts: string[]) {
        const result = await super.embed(texts);
        return { ...result, vectors: result.vectors.slice(1) };
      }
    }
    const index = indexWith(['a', 'b']);
    const error = await rejection(embedPending(index, new ShortEmbeddings()));
    expect(error.code).toBe('model_error');
    expect(index.pendingEmbeddingCount()).toBe(2);
  });

  it('does not pay twice when the index keeps handing out the same chunks', async () => {
    class ForgetfulIndex extends FakeIndex {
      override saveEmbeddings(): void {}
    }
    const index = new ForgetfulIndex();
    index.save(pdfRecord('a.pdf', ['a', 'b']));
    const embeddings = new FakeEmbeddingClient();

    const result = await embedPending(index, embeddings);

    expect(result.embedded).toBe(2);
    expect(embeddings.calls).toEqual([['a', 'b']]);
  });
});
