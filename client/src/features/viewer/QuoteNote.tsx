import { Stack, Text } from '@mantine/core';
import { formatNumber } from '../chat/formatNumber';
import type { HighlightState } from './useQuoteHighlight';
import classes from './SourceViewer.module.css';

interface QuoteNoteProps {
  quote: string;
  /** Null while the reader is on another page than the cited one. */
  state: HighlightState | null;
  citedPage: number;
}

const stateText: Partial<Record<HighlightState, string>> = {
  not_found: 'These words are not in the page text exactly as quoted, so nothing is highlighted. Check the page by eye.',
  no_text: 'This page is a scanned image with no text to search, so the passage cannot be highlighted. Check the page by eye.',
};

/** The quoted passage above the page, and a plain line when it cannot be highlighted on it. */
export function QuoteNote({ quote, state, citedPage }: QuoteNoteProps) {
  const note = state === null ? `The quoted passage is on page ${formatNumber(citedPage)}.` : stateText[state];

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
