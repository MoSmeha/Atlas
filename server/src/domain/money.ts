/** Zero-width and direction marks that PDF and Excel text often carries around Arabic numbers. */
const INVISIBLE = /[​-‏‪-‮⁦-⁩؜]/g;
/** A leading minus (also the Unicode minus and the en dash PDFs use for it) or plus. */
const SIGN = /^([-+−–])\s*/;
/** Thousands groups with one separator used throughout: "1,250,000", "1.250.000", "1 250 000", "1'250'000". */
const GROUPED = /^\d{1,3}([,. '])\d{3}(?:\1\d{3})*$/;

export interface NumberOptions {
  /** Read "12%" as 0.12. Without it a percentage is not a number. */
  percent?: boolean;
}

/** Turns Arabic-Indic and Extended Arabic-Indic digits into ASCII, "٫" into "." and "٬" into ",". */
export function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩٫٬۰-۹]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code === 0x066b) return '.';
    if (code === 0x066c) return ',';
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
}

/** ASCII digits, no invisible marks, single spaces, trimmed. */
function cleanNumberText(text: string): string {
  return normalizeDigits(text).replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
}

/** Strips one layer of accounting parentheses or a leading sign. */
function unwrapSign(text: string): { body: string; negative: boolean } {
  if (text.startsWith('(') && text.endsWith(')')) return { body: text.slice(1, -1).trim(), negative: true };
  const sign = SIGN.exec(text);
  if (sign === null) return { body: text, negative: false };
  return { body: text.slice(sign[0].length), negative: sign[1] !== '+' };
}

/**
 * Which character is the decimal separator. With both "." and "," the last one is ("3.400,50").
 * A single "." is decimal; a single "," is decimal only before one or two digits ("3,5"), since "1,250" groups thousands.
 */
function decimalSeparator(text: string): '.' | ',' | null {
  const dot = text.lastIndexOf('.');
  const comma = text.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) return dot > comma ? '.' : ',';
  if (dot >= 0) return text.indexOf('.') === dot ? '.' : null;
  if (comma >= 0) return text.indexOf(',') === comma && /,\d{1,2}$/.test(text) ? ',' : null;
  return null;
}

/** An unsigned number with optional thousands groups, as a plain decimal string ("1250000.00"); null when the grouping is not valid. */
function readDecimal(text: string): string | null {
  if (!/^[\d.,' ]*\d[\d.,' ]*$/.test(text)) return null;
  const separator = decimalSeparator(text);
  const parts = separator === null ? [text] : text.split(separator);
  if (parts.length > 2) return null;
  const [whole = '', fraction] = parts;
  if (fraction !== undefined && !/^\d+$/.test(fraction)) return null;
  if (!/^\d*$/.test(whole) && !GROUPED.test(whole)) return null;
  const digits = whole.replace(/\D/g, '');
  return fraction === undefined ? digits : `${digits || '0'}.${fraction}`;
}

/** The double closest to decimal × 10^power, built from the digits so 1.2 million is exactly 1200000. */
function decimalToNumber(decimal: string, power: number, negative: boolean): number {
  const value = Number(`${decimal}e${power}`);
  return negative && value !== 0 ? -value : value;
}

/**
 * A plain number such as "1,250,000.00", "-3.5", "(1,000)" (-1000), "3.400,50" or "١٬٢٥٠٫٥".
 * Null for anything else, including "12%" unless `percent` is set.
 */
export function parseNumber(text: string, options: NumberOptions = {}): number | null {
  let rest = cleanNumberText(text);
  let power = 0;
  if (options.percent === true && /[%٪]$/.test(rest)) {
    rest = rest.slice(0, -1).trimEnd();
    power = -2;
  }
  const { body, negative } = unwrapSign(rest);
  const decimal = readDecimal(body);
  return decimal === null ? null : decimalToNumber(decimal, power, negative);
}
