/** True for the first half of a UTF-16 surrogate pair, such as the start of an emoji. */
export function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/** The first `max` UTF-16 units of the text, one fewer when the cut would split a surrogate pair. */
export function sliceText(text: string, max: number): string {
  if (text.length <= max) return text;
  const end = max > 0 && isHighSurrogate(text.charCodeAt(max - 1)) ? max - 1 : max;
  return text.slice(0, Math.max(0, end));
}
