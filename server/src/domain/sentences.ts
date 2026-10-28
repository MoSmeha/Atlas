/** Zero-width and direction marks that PDF text often carries around Arabic words and numbers. */
const INVISIBLE = /[​-‏‪-‮⁦-⁩؜﻿]/g;
/** A blank line, or a line break before a bullet, "1.", "14.3", "a)" or "(iv)": list items are sentences of their own. */
const HARD_BREAK =
  /\n\s*\n|\n(?=[ \t]*(?:[•▪●◦·*–-]\s|\d{1,2}[.)]\s|\d{1,2}(?:\.\d{1,2})+\s|\(?[a-z]\)\s|\(?(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)\)\s))/i;
/** A short line with no closing punctuation before a capitalised line or a digit: a heading or a table row. */
const SHORT_LINE_BREAK = /(?<=^[^\n]{1,40})(?<![.,;:!?؟،])\n(?=[ \t]*[A-Z0-9])/m;
/** Sentence-ending punctuation followed by a space or the end of the text. */
const END = /[.!?؟]+(?=\s|$)/g;
/** "1.", "14.3." or "a." at the start of a sentence numbers it; it does not end it. */
const LIST_NUMBER = /^\s*(?:\d{1,2}(?:\.\d{1,2})*|[a-z]|[ivx]+)$/i;
/** Words whose period does not end a sentence ("Cl. 8.1", "No. 5", "e.g. drawings"). */
const ABBREVIATIONS = new Set([
  'no', 'nos', 'cl', 'e.g', 'i.e', 'eg', 'ie', 'etc', 'approx', 'mr', 'mrs', 'ms', 'dr', 'st', 'ltd', 'co', 'inc',
  'vs', 'fig', 'ref', 'rev', 'sec', 'art', 'para', 'incl', 'excl', 'dwg', 'vol', 'pp', 'jan', 'feb', 'mar', 'apr',
  'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
]);

/** Single spaces, no invisible marks, trimmed. */
export function cleanSentence(text: string): string {
  return text.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
}

/**
 * Splits page text into sentences, in English or Arabic. Blank lines, list items and short heading-like lines
 * always start a new sentence; inside a paragraph a sentence ends at ".", "!", "?" or "؟" unless an abbreviation or a lower-case word follows.
 * Line breaks inside a sentence become spaces.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(HARD_BREAK)
    .flatMap((paragraph) => paragraph.split(SHORT_LINE_BREAK))
    .flatMap(splitParagraph)
    .map(cleanSentence)
    .filter((sentence) => sentence !== '');
}

function splitParagraph(paragraph: string): string[] {
  const sentences: string[] = [];
  let from = 0;
  for (const end of paragraph.matchAll(END)) {
    const stop = end.index + end[0].length;
    if (LIST_NUMBER.test(paragraph.slice(from, end.index)) || !endsSentence(paragraph, end.index, stop)) continue;
    sentences.push(paragraph.slice(from, stop));
    from = stop;
  }
  sentences.push(paragraph.slice(from));
  return sentences;
}

function endsSentence(text: string, at: number, stop: number): boolean {
  const word = /([\p{L}.]+)$/u.exec(text.slice(Math.max(0, at - 12), at))?.[1] ?? '';
  if (text[at] === '.' && (ABBREVIATIONS.has(word.toLowerCase()) || /^\p{L}$/u.test(word))) return false;
  const next = /\S/.exec(text.slice(stop));
  return next === null || !/[a-z]/.test(next[0]);
}
