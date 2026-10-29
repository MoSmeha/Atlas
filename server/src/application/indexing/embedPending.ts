import { AppError, errors } from '../errors';
import type { DocumentIndex } from '../ports/DocumentIndex';
import type { EmbeddingClient } from '../ports/EmbeddingClient';

export interface EmbedPendingOptions {
  /** Chunks read from the index and sent per embed call. */
  batchSize?: number;
  signal?: AbortSignal;
  /** Called after each saved batch with the chunks embedded so far and the number that were waiting. */
  onProgress?: (done: number, total: number) => void;
}

export interface EmbedPendingResult {
  embedded: number;
  tokens: number;
  /**
   * Why it stopped early, when the embeddings API could not be used (no key, a rejected key, no quota, a rate limit,
   * no connection); search then works by keyword only. Null when every chunk was embedded.
   */
  stoppedBecause: string | null;
}

/**
 * Embeds every chunk that has no vector yet, batch by batch, saving each batch as soon as it arrives so a stop
 * keeps the work already paid for. When the API cannot be used it ends quietly with the reason, so the folder still
 * loads and search falls back to keywords; a stop by the user and unexpected errors propagate.
 */
export async function embedPending(
  index: DocumentIndex,
  embeddings: EmbeddingClient,
  { batchSize = 256, signal, onProgress }: EmbedPendingOptions = {},
): Promise<EmbedPendingResult> {
  const limit = Math.max(1, Math.floor(batchSize));
  const total = index.pendingEmbeddingCount();
  // Chunks embedded in this run. If the index hands one out again, stop rather than pay for it in a loop.
  const done = new Set<number>();
  let tokens = 0;
  for (;;) {
    if (signal?.aborted) throw errors.stopped();
    const batch = index.pendingEmbeddings(limit).filter((chunk) => !done.has(chunk.chunkId));
    if (batch.length === 0) break;

    const result = await embedOrReason(embeddings, batch.map((chunk) => chunk.text), signal);
    if (typeof result === 'string') return { embedded: done.size, tokens, stoppedBecause: result };
    const { vectors } = result;
    if (vectors.length !== batch.length) {
      throw errors.modelError(`asked for ${batch.length} embeddings but got ${vectors.length}.`);
    }

    index.saveEmbeddings(batch.map((chunk, i) => ({ chunkId: chunk.chunkId, vector: vectors[i] as Float32Array })));
    for (const chunk of batch) done.add(chunk.chunkId);
    tokens += result.tokens;
    onProgress?.(done.size, Math.max(total, done.size));
  }
  return { embedded: done.size, tokens, stoppedBecause: null };
}

/** The embed result, or the reason the embeddings API cannot be used right now. */
async function embedOrReason(
  embeddings: EmbeddingClient,
  texts: string[],
  signal: AbortSignal | undefined,
): Promise<{ vectors: Float32Array[]; tokens: number } | string> {
  try {
    return await embeddings.embed(texts, signal);
  } catch (error) {
    if (error instanceof AppError && error.code !== 'stopped') return error.message;
    throw error;
  }
}
