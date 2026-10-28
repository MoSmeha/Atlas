/** One page's text as the index stores it. */
export interface PageText {
  number: number;
  text: string;
}

export interface FittedPage extends PageText {
  /** True when the page alone was longer than the budget, so its text stops early. */
  cut: boolean;
}

/** How far back a cut may move to land on a line break or a space instead of inside a word. */
const SNAP = 200;

/**
 * Takes pages in order while their text fits in `maxChars` together. The first page is always taken;
 * when it alone is longer than `maxChars`, its text is cut and no later page is taken.
 */
export function fitPages(pages: readonly PageText[], maxChars: number): FittedPage[] {
  const fitted: FittedPage[] = [];
  let used = 0;
  for (const page of pages) {
    if (fitted.length > 0 && used + page.text.length > maxChars) break;
    if (page.text.length > maxChars) {
      fitted.push({ number: page.number, text: cutText(page.text, maxChars), cut: true });
      break;
    }
    fitted.push({ number: page.number, text: page.text, cut: false });
    used += page.text.length;
  }
  return fitted;
}

/** The start of `text`, at most `maxChars` long, ending before a nearby line break or space when there is one. */
export function cutText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const start = Math.max(0, maxChars - SNAP);
  const reach = text.slice(start, maxChars + 1);
  const lineBreak = reach.lastIndexOf('\n');
  const at = lineBreak >= 0 ? lineBreak : lastSpace(reach);
  let end = at >= 0 ? start + at : maxChars;
  if (at < 0 && isHighSurrogate(text.charCodeAt(end - 1))) end -= 1;
  return text.slice(0, end).trimEnd();
}

function lastSpace(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) if (/\s/u.test(text[i] ?? '')) return i;
  return -1;
}

/** The first half of a character outside the basic plane; cutting after it would leave half a character. */
function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}
