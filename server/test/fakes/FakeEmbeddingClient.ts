import type { EmbeddingClient } from '../../src/application/ports/EmbeddingClient';

const DIMENSIONS = 64;

/** Hashes words into a small vector, so texts that share words get similar vectors. No network. */
export class FakeEmbeddingClient implements EmbeddingClient {
  readonly model = 'fake-embedding';
  readonly calls: string[][] = [];

  async embed(texts: string[]): Promise<{ vectors: Float32Array[]; tokens: number }> {
    this.calls.push(texts);
    return { vectors: texts.map(embedText), tokens: texts.join(' ').split(/\s+/).length };
  }
}

export function embedText(text: string): Float32Array {
  const vector = new Float32Array(DIMENSIONS);
  for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    let hash = 0;
    for (const char of word) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
    vector[hash % DIMENSIONS] = (vector[hash % DIMENSIONS] ?? 0) + 1;
  }
  return vector;
}
