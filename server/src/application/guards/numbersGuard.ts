import type { Source } from '@atlas/shared';
import { numberPool, poolHas } from '../../domain/numberMatch';
import { extractNumbers, numbersFromValue, type NumberMention } from '../../domain/numbers';
import type { SavedResult } from '../session/Session';

/** Whole numbers up to this are counts and ordinals ("3 items", "Bill 2"), never checked. */
const SMALL_INTEGER = 10;
const FIRST_YEAR = 1900;
const LAST_YEAR = 2100;
/** A file name written without spaces, as in BOQ_Phase1.xlsx or Rev 2 of "contract-v3.pdf". */
const FILE_LIKE = /[^\s`*"'()[\]<>|]+\.(?:pdf|xlsx|xlsm|xls|csv|docx?|txt)\b/giu;
/** Link targets: bare URLs and the "(...)" part of a Markdown link. */
const LINK = /https?:\/\/\S+|\]\([^)]*\)/giu;
const EXTENSION = /\.(?:pdf|xlsx|xlsm|xls|csv|docx?|txt)$/i;

export interface NumbersEvidence {
  /** The answer text to check. */
  markdown: string;
  question: string;
  /** What the tools returned while this question was answered. */
  toolOutputs: readonly unknown[];
  /** Saved results the answer attaches. */
  results: readonly SavedResult[];
  /** The answer's checked sources; the text may name their pages and rows. */
  sources: readonly Source[];
  /** Names and paths of the loaded documents; numbers inside them are not claims. */
  fileNames: readonly string[];
  /** Numbers known from earlier in the chat, such as an earlier question's saved results. */
  known?: (value: number) => boolean;
}

/**
 * The numbers in the answer that appear in none of the evidence: the tool outputs, the question, the attached
 * results (their values and row counts) and the cited page and row numbers. Formatting does not matter, so
 * 1250000 supports "1,250,000.00" and "SAR 1.25M". Each unsupported number is listed once, in text order.
 */
export function unsupportedNumbers(evidence: NumbersEvidence): NumberMention[] {
  const claims = claimedNumbers(evidence.markdown, evidence.fileNames);
  if (claims.length === 0) return [];
  const pool = numberPool(evidenceValues(evidence));
  const known = evidence.known ?? (() => false);
  const listed = new Set<string>();
  return claims.filter((claim) => {
    if (poolHas(pool, claim) || isKnown(claim, known) || listed.has(claim.text)) return false;
    listed.add(claim.text);
    return true;
  });
}

/**
 * The numbers a text states as facts. Years 1900 to 2100, list numbering, whole numbers up to 10 and numbers
 * inside file names and links are left out.
 */
export function claimedNumbers(markdown: string, fileNames: readonly string[]): NumberMention[] {
  const masked = maskedSpans(markdown, fileNames);
  return extractNumbers(markdown).filter(
    (mention) => !isExempt(mention, markdown) && !masked.some(([start, end]) => mention.index >= start && mention.index < end),
  );
}

function isExempt(mention: NumberMention, text: string): boolean {
  const plainInteger = mention.decimals === 0 && mention.scale === 0 && !mention.percent && !mention.grouped;
  if (!plainInteger) return false;
  if (Math.abs(mention.value) <= SMALL_INTEGER) return true;
  if (mention.value >= FIRST_YEAR && mention.value <= LAST_YEAR) return true;
  return mention.value > 0 && isListMarker(mention, text);
}

/** "12. Item" or "12) Item" at the start of a line, after any indent, quote mark or heading mark. */
function isListMarker(mention: NumberMention, text: string): boolean {
  const lineStart = text.lastIndexOf('\n', mention.index - 1) + 1;
  if (!/^[ \t>#]*$/.test(text.slice(lineStart, mention.index))) return false;
  const end = mention.index + mention.text.length;
  return /^[.)](?:\s|$)/.test(text.slice(end, end + 2));
}

function isKnown(mention: NumberMention, known: (value: number) => boolean): boolean {
  const value = Math.abs(mention.value);
  return known(value) || (mention.percent && known(value / 100));
}

/** Where file names and links are in the text, as [start, end) offsets. */
function maskedSpans(text: string, fileNames: readonly string[]): [number, number][] {
  const patterns = [FILE_LIKE, LINK];
  const names = new Set<string>();
  for (const name of fileNames) {
    names.add(name);
    const stem = name.replace(EXTENSION, '');
    if (stem !== name && stem.length >= 4 && /\p{L}/u.test(stem)) names.add(stem);
  }
  for (const name of [...names].filter((candidate) => candidate.trim() !== '')) {
    patterns.push(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu'));
  }
  return patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match): [number, number] => [match.index, match.index + match[0].length]));
}

function* evidenceValues(evidence: NumbersEvidence): Iterable<number> {
  yield* numbersFromValue(evidence.question);
  for (const output of evidence.toolOutputs) {
    yield* numbersFromValue(output);
    yield* arrayLengths(output);
  }
  for (const result of evidence.results) {
    yield* numbersFromValue([result.title, result.rows]);
    yield result.rows.length;
  }
  for (const source of evidence.sources) {
    if (source.kind === 'pdf') {
      yield source.page;
    } else {
      yield* numbersFromValue(source.sheet);
      yield source.rowFrom;
      yield source.rowTo;
    }
  }
}

/** How many items each array in a tool output holds, so "12 documents" can be traced to a list of 12. */
function* arrayLengths(value: unknown): Iterable<number> {
  if (Array.isArray(value)) {
    yield value.length;
    for (const item of value) yield* arrayLengths(item);
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) yield* arrayLengths(item);
  }
}
