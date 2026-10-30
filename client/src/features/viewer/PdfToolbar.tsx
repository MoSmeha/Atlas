import { useState } from 'react';
import { ActionIcon, Button, Group, NumberInput, Text, Tooltip, VisuallyHidden } from '@mantine/core';
import { IconArrowBackUp, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useCopy } from '../../i18n/useCopy';
import { type ViewerCopy, viewerCopy } from './viewerCopy';

interface PdfToolbarProps {
  page: number;
  /** Null until the PDF has loaded. */
  pageCount: number | null;
  /** The page the source cites, offered as a way back once the reader moves away from it; null for a whole file. */
  citedPage: number | null;
  onGoTo: (page: number) => void;
}

/**
 * Previous and next page, a page number to jump to, and a way back to the cited page.
 * In Arabic the row mirrors, so the chevrons and the back arrow turn round with it.
 */
export function PdfToolbar({ page, pageCount, citedPage, onGoTo }: PdfToolbarProps) {
  const copy = useCopy(viewerCopy);

  return (
    <Group justify="space-between" wrap="nowrap" gap="sm" mih={30}>
      <Group gap={4} wrap="nowrap">
        <Tooltip label={copy.previousPageHint}>
          <ActionIcon size="md" aria-label={copy.previousPage} disabled={page <= 1} onClick={() => onGoTo(page - 1)}>
            <IconChevronLeft size={18} stroke={1.75} className="flip-rtl" />
          </ActionIcon>
        </Tooltip>
        <Group gap={6} wrap="nowrap" px={4}>
          <Text fz="sm" c="gray.8" aria-hidden>
            {copy.pageLabel}
          </Text>
          <PageField page={page} pageCount={pageCount} onGoTo={onGoTo} copy={copy} />
          {pageCount !== null && (
            <Text fz="sm" c="gray.8" className="tabular-nums" aria-hidden>
              {copy.ofPages(pageCount)}
            </Text>
          )}
          <VisuallyHidden aria-live="polite">{copy.pageOf(page, pageCount)}</VisuallyHidden>
        </Group>
        <Tooltip label={copy.nextPageHint}>
          <ActionIcon
            size="md"
            aria-label={copy.nextPage}
            disabled={pageCount === null || page >= pageCount}
            onClick={() => onGoTo(page + 1)}
          >
            <IconChevronRight size={18} stroke={1.75} className="flip-rtl" />
          </ActionIcon>
        </Tooltip>
      </Group>
      {citedPage !== null && page !== citedPage && (pageCount === null || citedPage <= pageCount) && (
        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={<IconArrowBackUp size={16} stroke={1.75} className="flip-rtl" />}
          onClick={() => onGoTo(citedPage)}
        >
          {copy.backToPage(citedPage)}
        </Button>
      )}
    </Group>
  );
}

interface PageFieldProps {
  page: number;
  pageCount: number | null;
  onGoTo: (page: number) => void;
  copy: ViewerCopy;
}

/** The page on screen as a small field: type a number and press Enter, or leave the field, to go there. */
function PageField({ page, pageCount, onGoTo, copy }: PageFieldProps) {
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
      aria-label={copy.pageField(pageCount)}
      styles={{ input: { textAlign: 'center', fontVariantNumeric: 'tabular-nums' } }}
    />
  );
}
