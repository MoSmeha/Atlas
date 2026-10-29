import { Stack, Text } from '@mantine/core';
import { useCopy } from '../../i18n/useCopy';
import type { HighlightState } from './useQuoteHighlight';
import { type ViewerCopy, viewerCopy } from './viewerCopy';
import classes from './SourceViewer.module.css';

interface QuoteNoteProps {
  quote: string;
  /** Null while the reader is on another page than the cited one. */
  state: HighlightState | null;
  citedPage: number;
}

/** The plain line under the quote: where it is, or why it is not highlighted; null when it is marked or still being looked for. */
function noteText(copy: ViewerCopy, state: HighlightState | null, citedPage: number): string | null {
  if (state === null) return copy.quoteOnPage(citedPage);
  if (state === 'not_found') return copy.quoteNotFound;
  if (state === 'no_text') return copy.quoteNoText;
  return null;
}

/** The quoted passage above the page, and a plain line when it cannot be highlighted on it. */
export function QuoteNote({ quote, state, citedPage }: QuoteNoteProps) {
  const note = noteText(useCopy(viewerCopy), state, citedPage);

  return (
    <Stack gap={4}>
      <Text fz="sm" c="gray.7" dir="auto" className={classes.quote}>
        {quote}
      </Text>
      {note && (
        <Text fz="xs" c="dimmed">
          {note}
        </Text>
      )}
    </Stack>
  );
}
