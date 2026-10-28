import type { DocumentSummary } from '@atlas/shared';
import { READABLE_EXTENSIONS } from '../../domain/fileTypes';
import type { DocumentIndex } from '../ports/DocumentIndex';
import { ToolError } from './Tool';

/** How many loaded paths an unknown-name error lists before pointing at list_documents. */
const MAX_LISTED = 30;

/**
 * The loaded document a tool argument names: a file name or relative path, ignoring case, with or without
 * its extension. When nothing matches, throws a ToolError that lists the loaded documents and ends with `hint`.
 */
export function findDocument(index: DocumentIndex, name: string, hint: string): DocumentSummary {
  const wanted = name.trim();
  const found = index.find(wanted) ?? matchWithoutExtension(index.documents(), wanted);
  if (found) return found;

  const loaded = index
    .documents()
    .map((doc) => doc.path)
    .toSorted((a, b) => a.localeCompare(b));
  if (loaded.length === 0) throw new ToolError(`No loaded document matches "${name}": no documents are loaded.`);
  const listed =
    loaded.length <= MAX_LISTED
      ? `Loaded documents: ${loaded.join(', ')}.`
      : `Loaded documents (first ${MAX_LISTED} of ${loaded.length}; list_documents has them all): ` +
        `${loaded.slice(0, MAX_LISTED).join(', ')}.`;
  throw new ToolError(`No loaded document matches "${name}". ${listed} ${hint}`);
}

/** The one document whose name or path, minus its extension, equals `wanted`; null when none or several do. */
function matchWithoutExtension(documents: DocumentSummary[], wanted: string): DocumentSummary | null {
  const key = stripExtension(wanted).toLowerCase();
  if (key === '') return null;
  const matches = documents.filter(
    (doc) => stripExtension(doc.name).toLowerCase() === key || stripExtension(doc.path).toLowerCase() === key,
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

function stripExtension(name: string): string {
  const lower = name.toLowerCase();
  const extension = READABLE_EXTENSIONS.find((ext) => lower.endsWith(ext));
  return extension ? name.slice(0, -extension.length) : name;
}
