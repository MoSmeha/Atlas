import type OpenAI from 'openai';
import type { Embedding } from 'openai/resources/embeddings';
import { errors } from '../../application/errors';
import type { EmbeddingClient } from '../../application/ports/EmbeddingClient';
import { EMBEDDING_LIMITS, planEmbeddingRequests, type EmbeddingLimits } from './embeddingRequests';
import { mapOpenAiError, OPENAI, type Vendor } from './mapOpenAiError';

export interface EmbeddingOptions {
  /** Who serves the endpoint, for error messages. OpenAI when left out. */
  vendor?: Vendor;
  /** How texts are grouped into requests. OpenAI's when left out. */
  limits?: EmbeddingLimits;
}

/**
 * EmbeddingClient on the OpenAI embeddings endpoint, or on a server that speaks it, such as Gemini or Ollama.
 * Many texts go out as several requests; vectors come back in input order.
 */
export class OpenAiEmbeddingClient implements EmbeddingClient {
  readonly model: string;
  private readonly client: OpenAI;
  /** Null keeps the model's default size. */
  private readonly dimensions: number | null;
  private readonly vendor: Vendor;
  private readonly limits: EmbeddingLimits;

  constructor(client: OpenAI, model: { id: string; dimensions: number | null }, options: EmbeddingOptions = {}) {
    this.client = client;
    this.model = model.id;
    this.dimensions = model.dimensions;
    this.vendor = options.vendor ?? OPENAI;
    this.limits = options.limits ?? EMBEDDING_LIMITS;
  }

  async embed(texts: string[], signal?: AbortSignal): Promise<{ vectors: Float32Array[]; tokens: number }> {
    const vectors: Float32Array[] = [];
    let tokens = 0;
    try {
      for (const input of planEmbeddingRequests(texts, this.limits)) {
        const response = await this.client.embeddings.create(
          { model: this.model, input, ...(this.dimensions === null ? {} : { dimensions: this.dimensions }) },
          { signal },
        );
        vectors.push(...inInputOrder(response.data, input.length));
        // Some compatible servers leave usage out.
        tokens += response.usage?.prompt_tokens ?? 0;
      }
    } catch (error) {
      throw signal?.aborted ? errors.stopped() : mapOpenAiError(error, this.vendor);
    }
    return { vectors, tokens };
  }
}

/** The API numbers each embedding with its input position; a missing one would shift every vector after it. */
function inInputOrder(data: Embedding[], expected: number): Float32Array[] {
  if (data.length !== expected) throw errors.modelError(`asked for ${expected} embeddings but got ${data.length}.`);
  return [...data].sort((a, b) => a.index - b.index).map((item) => Float32Array.from(item.embedding));
}
