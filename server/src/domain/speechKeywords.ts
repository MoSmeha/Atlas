import type { DocumentSummary } from '@atlas/shared';

/** Keywords a dictation sends; enough for a folder's names without drowning the hint. */
export const MAX_KEYWORDS = 40;
const MAX_KEYWORD_CHARS = 60;
/** The transcription service rejects a keyword with angle brackets or a line break. */
const FORBIDDEN = /[<>\r\n]/g;

/**
 * Terms a dictated question about these documents may contain, as hints for the transcription: each readable file's
 * name without its extension, its sheet names, and the project names and parties the classifier found. Each appears
 * once, ignoring case; numbers alone and very short or long terms are left out.
 */
export function speechKeywords(documents: readonly DocumentSummary[], max = MAX_KEYWORDS): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  const add = (raw: string) => {
    const term = raw.replace(FORBIDDEN, ' ').replace(/\s+/g, ' ').trim();
    if (term.length < 2 || term.length > MAX_KEYWORD_CHARS || /^[\d\s.,-]+$/.test(term)) return;
    const key = term.toLowerCase();
    if (seen.has(key) || keywords.length >= max) return;
    seen.add(key);
    keywords.push(term);
  };
  const readable = documents.filter((doc) => doc.status === 'ok' || doc.status === 'scanned');
  for (const doc of readable) add(baseName(doc.path));
  for (const doc of readable) {
    const metadata = doc.classification?.metadata;
    if (metadata?.projectName) add(metadata.projectName);
    for (const party of metadata?.parties ?? []) add(party);
  }
  for (const doc of readable) for (const sheet of doc.sheets) add(sheet);
  return keywords;
}

/** "Bills/BOQ-Phase1.xlsx" reads "BOQ-Phase1". */
function baseName(path: string): string {
  const name = path.split(/[\\/]/).at(-1) ?? path;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}
