import type { TextRange } from './findQuote';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Text safe to put inside HTML. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/** One text item as HTML for the PDF text layer, with each range wrapped in `<mark class="…">`. */
export function markedHtml(text: string, ranges: TextRange[], className?: string): string {
  const open = className ? `<mark class="${escapeHtml(className)}">` : '<mark>';
  let html = '';
  let at = 0;
  for (const { start, end } of ranges) {
    if (start < at || end <= start) continue;
    html += escapeHtml(text.slice(at, start));
    html += `${open}${escapeHtml(text.slice(start, end))}</mark>`;
    at = end;
  }
  return html + escapeHtml(text.slice(at));
}
