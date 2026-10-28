import type { DocumentSummary, Source } from '@atlas/shared';

/** A path compared loosely: forward slashes, no leading "./" or slash, one Unicode form, any case. */
function pathKey(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^(\.\/|\/)+/, '').normalize('NFC').toLowerCase();
}

function nameKey(path: string): string {
  return pathKey(path).split('/').at(-1) ?? '';
}

/**
 * The loaded document a source names. Sources carry the folder-relative path, but a file name or
 * the tail of a path also finds it, as long as only one loaded file fits. Null when none does.
 */
export function findSourceDocument(documents: DocumentSummary[], source: Pick<Source, 'kind' | 'document'>): DocumentSummary | null {
  const wanted = pathKey(source.document);
  if (wanted === '') return null;
  const candidates = documents.filter((document) => document.kind === source.kind);
  const exact = candidates.find((document) => pathKey(document.path) === wanted);
  if (exact) return exact;
  const tail = candidates.filter((document) => pathKey(document.path).endsWith(`/${wanted}`));
  if (tail.length === 1) return tail[0] ?? null;
  const named = candidates.filter((document) => nameKey(document.path) === nameKey(wanted));
  return named.length === 1 ? (named[0] ?? null) : null;
}
