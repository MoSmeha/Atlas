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
  /** True when it stopped early because the API key is missing or was rejected; search then works by keyword only. */
  missingApiKey: boolean;
}

/**
 * Embeds every chunk that has no vector yet, batch by batch, saving each batch as soon as it arrives so a stop
 * keeps the work already paid for. A missing or rejected API key ends it quietly; other errors propagate.
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

    const result = await embedUnlessNoKey(embeddings, batch.map((chunk) => chunk.text), signal);
    if (result === null) return { embedded: done.size, tokens, missingApiKey: true };
    const { vectors } = result;
    if (vectors.length !== batch.length) {
      throw errors.modelError(`asked for ${batch.length} embeddings but got ${vectors.length}.`);
    }

    index.saveEmbeddings(batch.map((chunk, i) => ({ chunkId: chunk.chunkId, vector: vectors[i] as Float32Array })));
    for (const chunk of batch) done.add(chunk.chunkId);
    tokens += result.tokens;
    onProgress?.(done.size, Math.max(total, done.size));
  }
  return { embedded: done.size, tokens, missingApiKey: false };
}

/** The embed result, or null when the API key is missing or was rejected. */
async function embedUnlessNoKey(
  embeddings: EmbeddingClient,
  texts: string[],
  signal: AbortSignal | undefined,
): Promise<{ vectors: Float32Array[]; tokens: number } | null> {
  try {
    return await embeddings.embed(texts, signal);
  } catch (error) {
    if (error instanceof AppError && error.code === 'missing_api_key') return null;
    throw error;
  }
}
