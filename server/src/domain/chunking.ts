export interface ChunkOptions {
  maxChars?: number;
  /** Characters of the previous chunk repeated at the start of the next, so a sentence cut in two is still found. */
  overlapChars?: number;
}

interface Piece {
  text: string;
  /** What goes between this piece and the one before it. */
  joiner: string;
}

/** Finer and finer places to cut: paragraphs, sentences (English and Arabic marks), lines, words. */
const SPLITTERS: { pattern: RegExp; joiner: string }[] = [
  { pattern: /\n[ \t]*\n\s*/, joiner: '\n\n' },
  { pattern: /(?<=[.!?؟۔])\s+/, joiner: ' ' },
  { pattern: /\n/, joiner: '\n' },
  { pattern: /\s+/, joiner: ' ' },
];

/** Splits one page of text into search chunks of at most `maxChars`, cutting at paragraphs, then sentences. Never returns empty chunks. */
export function chunkPage(text: string, { maxChars = 1200, overlapChars = 150 }: ChunkOptions = {}): string[] {
  const limit = Math.max(1, Math.floor(maxChars));
  const overlap = Math.max(0, Math.min(Math.floor(overlapChars), Math.floor(limit / 2)));
  const normalized = text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim();
  if (normalized === '') return [];

  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces(normalized, limit, 0, '')) {
    const joined = current === '' ? piece.text : current + piece.joiner + piece.text;
    if (joined.length <= limit) {
      current = joined;
      continue;
    }
    chunks.push(current);
    const lead = tail(current, overlap);
    current = lead !== '' && lead.length + piece.joiner.length + piece.text.length <= limit ? lead + piece.joiner + piece.text : piece.text;
  }
  if (current !== '') chunks.push(current);
  return chunks;
}

function pieces(text: string, limit: number, level: number, joiner: string): Piece[] {
  if (text.length <= limit) return [{ text, joiner }];
  const splitter = SPLITTERS[level];
  if (!splitter) return hardCut(text, limit).map((part, i) => ({ text: part, joiner: i === 0 ? joiner : '' }));
  const parts = text
    .split(splitter.pattern)
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (parts.length <= 1) return pieces(text, limit, level + 1, joiner);
  return parts.flatMap((part, i) => pieces(part, limit, level + 1, i === 0 ? joiner : splitter.joiner));
}

function hardCut(text: string, limit: number): string[] {
  const parts: string[] = [];
  for (let start = 0; start < text.length; start += limit) parts.push(text.slice(start, start + limit));
  return parts;
}

/** The last `size` characters of a chunk, starting at a word boundary when there is one. */
function tail(text: string, size: number): string {
  if (size === 0) return '';
  const end = text.slice(-size);
  if (end.length === text.length) return '';
  const space = end.search(/\s/);
  return (space >= 0 ? end.slice(space) : end).trim();
}
