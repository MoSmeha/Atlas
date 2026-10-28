/** Euclidean length of a vector. */
export function magnitude(vector: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    const value = vector[i] ?? 0;
    sum += value * value;
  }
  return Math.sqrt(sum);
}

/** Cosine similarity in [-1, 1]; 0 when either vector is all zeros or the lengths differ. Pass known magnitudes to skip recomputing them. */
export function cosine(a: Float32Array, b: Float32Array, magnitudeA = magnitude(a), magnitudeB = magnitude(b)): number {
  if (a.length !== b.length || magnitudeA === 0 || magnitudeB === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot / (magnitudeA * magnitudeB);
}

/** The vector's bytes for a BLOB column. */
export function vectorToBuffer(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

/** Reads a BLOB written by vectorToBuffer. Copies, because SQLite buffers need not be 4-byte aligned. */
export function bufferToVector(buffer: Uint8Array): Float32Array {
  const copy = new Uint8Array(buffer);
  return new Float32Array(copy.buffer, 0, Math.floor(copy.byteLength / 4));
}
