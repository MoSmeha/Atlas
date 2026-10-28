/** A file name that ends in a revision marker, such as "BOQ_Phase1_Rev1.xlsx". */
export interface RevisionName {
  /** The name without its extension and marker, in lower case, so revisions of one document share it: "boq_phase1". */
  stem: string;
  /** Orders revisions: letters (Rev A, Rev B) come before numbers (Rev 0, Rev 1), numbers by value. */
  rank: number;
}

const EXTENSION = /\.[A-Za-z0-9]{1,10}$/;
/** "_Rev1", " Revision 2", "-RevB", " (Rev 3)", "_R2", "_v2": a separator, a marker word, then a number or one letter. */
const MARKER =
  /^(.+?)[\s_.\-(]+(?:(?:rev(?:ision)?)\.?[\s_.\-]*(?<revision>\d{1,3}|[a-z])|(?:r|v|ver(?:sion)?)\.?[\s_.\-]*(?<number>\d{1,3}))\)?$/i;
/** Ranks letter revisions below every number. */
const LETTER_BASE = -100;

/** The stem and rank of a file name ending in a revision marker; null when the name has none. */
export function revisionName(fileName: string): RevisionName | null {
  const match = MARKER.exec(fileName.trim().replace(EXTENSION, ''));
  const stem = match?.[1]?.trim().toLowerCase();
  const marker = match?.groups?.['revision'] ?? match?.groups?.['number'];
  if (!stem || marker === undefined) return null;
  const rank = /^\d+$/.test(marker) ? Number(marker) : LETTER_BASE + marker.toLowerCase().charCodeAt(0) - 97;
  return { stem, rank };
}
