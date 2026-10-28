import type OpenAI from 'openai';
import type { Embedding } from 'openai/resources/embeddings';
import { errors } from '../../application/errors';
import type { EmbeddingClient } from '../../application/ports/EmbeddingClient';
import { planEmbeddingRequests } from './embeddingRequests';
import { mapOpenAiError } from './mapOpenAiError';

/** EmbeddingClient on the OpenAI embeddings endpoint. Many texts go out as several requests; vectors come back in input order. */
export class OpenAiEmbeddingClient implements EmbeddingClient {
  readonly model: string;
  private readonly client: OpenAI;
  private readonly dimensions: number;

  constructor(client: OpenAI, model: { id: string; dimensions: number }) {
    this.client = client;
    this.model = model.id;
    this.dimensions = model.dimensions;
  }

  async embed(texts: string[], signal?: AbortSignal): Promise<{ vectors: Float32Array[]; tokens: number }> {
    const vectors: Float32Array[] = [];
    let tokens = 0;
    try {
      for (const input of planEmbeddingRequests(texts)) {
        const response = await this.client.embeddings.create(
          { model: this.model, input, dimensions: this.dimensions },
          { signal },
        );
        vectors.push(...inInputOrder(response.data, input.length));
        tokens += response.usage.prompt_tokens;
      }
    } catch (error) {
      throw signal?.aborted ? errors.stopped() : mapOpenAiError(error);
    }
    return { vectors, tokens };
  }
}

/** The API numbers each embedding with its input position; a missing one would shift every vector after it. */
function inInputOrder(data: Embedding[], expected: number): Float32Array[] {
  if (data.length !== expected) throw errors.modelError(`asked for ${expected} embeddings but got ${data.length}.`);
  return [...data].sort((a, b) => a.index - b.index).map((item) => Float32Array.from(item.embedding));
}
