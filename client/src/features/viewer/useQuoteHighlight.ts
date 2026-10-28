import { useCallback, useMemo, useState } from 'react';
import type { PageProps, TextContent } from 'react-pdf';
import { type TextRange, findQuote } from './findQuote';
import { markedHtml } from './markedHtml';

/** Where the quote stands on the page: text still loading, marked, missing, or a page with no text at all. */
export type HighlightState = 'reading' | 'found' | 'not_found' | 'no_text';

interface PageText {
  page: number;
  ranges: Map<number, TextRange[]>;
  hasText: boolean;
}

export interface QuoteHighlight {
  /** For the Page's onGetTextSuccess: finds the quote once pdf.js has read the page text. */
  onGetTextSuccess: NonNullable<PageProps['onGetTextSuccess']>;
  /** Wraps the quote's characters in marks; undefined while there is nothing to mark. */
  customTextRenderer: PageProps['customTextRenderer'];
  /** Null when there is no quote to look for on this page. */
  state: HighlightState | null;
}

/**
 * Marks `quote` on the text layer of the PDF page on screen. Pass null as the quote on pages
 * that do not cite it; what was found on one page never carries over to another.
 */
export function useQuoteHighlight(quote: string | null, page: number, markClass?: string): QuoteHighlight {
  const [found, setFound] = useState<PageText | null>(null);
  const text = found?.page === page ? found : null;

  const onGetTextSuccess = useCallback(
    (content: TextContent) => {
      // Item indexes must stay as pdf.js numbers them, so marked-content entries stay in as empty text.
      const items = content.items.map((item) => ('str' in item ? item : { str: '' }));
      setFound({
        page,
        ranges: quote ? findQuote(items, quote) : new Map(),
        hasText: items.some((item) => item.str.trim() !== ''),
      });
    },
    [quote, page],
  );

  const ranges = quote && text && text.ranges.size > 0 ? text.ranges : null;
  const customTextRenderer = useMemo<PageProps['customTextRenderer']>(
    () => (ranges ? ({ str, itemIndex }) => markedHtml(str, ranges.get(itemIndex) ?? [], markClass) : undefined),
    [ranges, markClass],
  );

  let state: HighlightState | null = null;
  if (quote) state = text === null ? 'reading' : !text.hasText ? 'no_text' : text.ranges.size > 0 ? 'found' : 'not_found';

  return { onGetTextSuccess, customTextRenderer, state };
}
