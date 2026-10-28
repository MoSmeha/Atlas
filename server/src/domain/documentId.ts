/** A short stable id for a document path (FNV-1a), safe to put in a URL. */
export function documentId(relativePath: string): string {
  let hash = 0x811c9dc5;
  for (const char of relativePath.toLowerCase()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `d${hash.toString(36)}`;
}
