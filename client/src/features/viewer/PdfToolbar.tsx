import { ActionIcon, Button, Group, Text, Tooltip } from '@mantine/core';
import { IconArrowBackUp, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { formatNumber } from '../chat/formatNumber';

interface PdfToolbarProps {
  page: number;
  /** Null until the PDF has loaded. */
  pageCount: number | null;
  /** The page the source cites, offered as a way back once the reader moves away from it. */
  citedPage: number;
  onGoTo: (page: number) => void;
}

/** Previous and next page, where the reader is, and a way back to the cited page. */
export function PdfToolbar({ page, pageCount, citedPage, onGoTo }: PdfToolbarProps) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm" mih={30}>
      <Group gap={4} wrap="nowrap">
        <Tooltip label="Previous page (Left arrow)">
          <ActionIcon size="md" aria-label="Previous page" disabled={page <= 1} onClick={() => onGoTo(page - 1)}>
            <IconChevronLeft size={18} stroke={1.75} />
          </ActionIcon>
        </Tooltip>
        <Text fz="sm" c="gray.8" miw={96} ta="center" className="tabular-nums" aria-live="polite">
          Page {formatNumber(page)}
          {pageCount !== null && ` of ${formatNumber(pageCount)}`}
        </Text>
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
      {page !== citedPage && (pageCount === null || citedPage <= pageCount) && (
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
