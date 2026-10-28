export interface EmbeddingClient {
  readonly model: string;
  /** One vector per input text, in input order. Callers batch; adapters may split further. */
  embed(texts: string[], signal?: AbortSignal): Promise<{ vectors: Float32Array[]; tokens: number }>;
}
