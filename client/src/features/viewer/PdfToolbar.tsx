import { useState } from 'react';
import { ActionIcon, Button, Group, NumberInput, Text, Tooltip, VisuallyHidden } from '@mantine/core';
import { IconArrowBackUp, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { formatNumber } from '../chat/formatNumber';

interface PdfToolbarProps {
  page: number;
  /** Null until the PDF has loaded. */
  pageCount: number | null;
  /** The page the source cites, offered as a way back once the reader moves away from it; null for a whole file. */
  citedPage: number | null;
  onGoTo: (page: number) => void;
}

/** Previous and next page, a page number to jump to, and a way back to the cited page. */
export function PdfToolbar({ page, pageCount, citedPage, onGoTo }: PdfToolbarProps) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm" mih={30}>
      <Group gap={4} wrap="nowrap">
        <Tooltip label="Previous page (Left arrow)">
          <ActionIcon size="md" aria-label="Previous page" disabled={page <= 1} onClick={() => onGoTo(page - 1)}>
            <IconChevronLeft size={18} stroke={1.75} />
          </ActionIcon>
        </Tooltip>
        <Group gap={6} wrap="nowrap" px={4}>
          <Text fz="sm" c="gray.8" aria-hidden>
            Page
          </Text>
          <PageField page={page} pageCount={pageCount} onGoTo={onGoTo} />
          {pageCount !== null && (
            <Text fz="sm" c="gray.8" className="tabular-nums" aria-hidden>
              of {formatNumber(pageCount)}
            </Text>
          )}
          <VisuallyHidden aria-live="polite">
            Page {formatNumber(page)}
            {pageCount !== null && ` of ${formatNumber(pageCount)}`}
          </VisuallyHidden>
        </Group>
        <Tooltip label="Next page (Right arrow)">
          <ActionIcon
            size="md"
            aria-label="Next page"
            disabled={pageCount === null || page >= pageCount}
            onClick={() => onGoTo(page + 1)}
          >
            <IconChevronRight size={18} stroke={1.75} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {citedPage !== null && page !== citedPage && (pageCount === null || citedPage <= pageCount) && (
        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={<IconArrowBackUp size={16} stroke={1.75} />}
          onClick={() => onGoTo(citedPage)}
        >
          Back to page {formatNumber(citedPage)}
        </Button>
      )}
    </Group>
  );
}

interface PageFieldProps {
  page: number;
  pageCount: number | null;
  onGoTo: (page: number) => void;
}

/** The page on screen as a small field: type a number and press Enter, or leave the field, to go there. */
function PageField({ page, pageCount, onGoTo }: PageFieldProps) {
  const [draft, setDraft] = useState<string | number>(page);
  // The field follows the page when the buttons or arrow keys change it.
  const [shownPage, setShownPage] = useState(page);
  if (page !== shownPage) {
    setShownPage(page);
    setDraft(page);
  }

  const commit = () => {
    const wanted = typeof draft === 'number' ? draft : Number.parseInt(draft, 10);
    if (Number.isFinite(wanted)) onGoTo(wanted);
    setDraft(page);
  };

  return (
    <NumberInput
      value={draft}
      onChange={setDraft}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
      }}
      onFocus={(event) => event.currentTarget.select()}
      min={1}
      max={pageCount ?? undefined}
      allowDecimal={false}
      allowNegative={false}
      hideControls
      disabled={pageCount === null}
      size="xs"
      w={52}
      aria-label={pageCount === null ? 'Page number' : `Page number, 1 to ${formatNumber(pageCount)}`}
      styles={{ input: { textAlign: 'center', fontVariantNumeric: 'tabular-nums' } }}
    />
  );
}
