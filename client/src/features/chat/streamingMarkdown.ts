/**
 * Tidies markdown that is still streaming so half-written bold does not flash as asterisks:
 * an unclosed "**" is closed, and a "*" or "**" with nothing after it yet is held back.
 */
export function tidyStreamingMarkdown(text: string): string {
  const tidy = /(^|[^*])\*$/.test(text) ? text.slice(0, -1) : text;
  if (countBoldMarks(tidy) % 2 === 0) return tidy;

  const open = tidy.lastIndexOf('**');
  if (tidy.slice(open + 2).trim() === '') return tidy.slice(0, open);
  const body = tidy.trimEnd();
  return `${body}**${tidy.slice(body.length)}`;
}

function countBoldMarks(text: string): number {
  return text.split('**').length - 1;
}
