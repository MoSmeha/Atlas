import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Group, Table, Text, VisuallyHidden } from '@mantine/core';
import { IconArrowsVertical } from '@tabler/icons-react';
import type { DocumentSummary } from '@atlas/shared';
import type { RowRange } from '../../api/endpoints';
import { useSheetRows } from '../../api/useSheetRows';
import type { Direction } from '../../i18n/language';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { ErrorNotice } from '../errors/ErrorNotice';
import { SheetBlock } from './SheetBlock';
import { ViewerLoading } from './ViewerLoading';
import { columnLetter, firstWindow, rowsAfter, rowsBefore, topWindow } from './sheetWindow';
import { scrollToMiddle } from './stageScroll';
import { useKeepInView } from './useKeepInView';
import { viewerCopy } from './viewerCopy';
import viewer from './SourceViewer.module.css';
import classes from './SheetView.module.css';

interface SheetViewProps {
  document: DocumentSummary;
  sheet: string;
  /** The rows a source cites; null shows the sheet from its top. */
  cited: RowRange | null;
}

/**
 * A sheet as Excel shows it: row numbers, column letters, raw cell values. Opened from a source, it
 * starts on a window around the cited rows, tinted and scrolled into view. It grows on request.
 */
export function SheetView({ document, sheet, cited }: SheetViewProps) {
  const copy = useCopy(viewerCopy);
  const { dir } = useLanguage();
  const [first] = useState(() => (cited ? firstWindow(cited.from, cited.to) : topWindow()));
  const [blocks, setBlocks] = useState<RowRange[]>([first]);
  const anchor = useSheetRows(document.id, sheet, first.from, first.to);
  const stage = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  const holdView = useKeepInView(stage);

  const showCited = useCallback(() => {
    const container = stage.current;
    const row = container?.querySelector('[data-first-cited]');
    const head = container?.querySelector('thead');
    if (container && row instanceof HTMLElement) {
      scrollToMiddle(container, row, head instanceof HTMLElement ? head.offsetHeight : 0);
    }
  }, []);

  useEffect(() => {
    if (!anchor.data || scrolled.current) return;
    scrolled.current = true;
    showCited();
  }, [anchor.data, showCited]);

  const totalRows = anchor.data?.totalRows ?? 0;
  const columnCount = anchor.data?.columnCount ?? 0;
  const top = blocks[0] ?? first;
  const bottom = blocks.at(-1) ?? first;
  const earlier = rowsBefore(top);
  const next = rowsAfter(bottom);
  const more = bottom.to < totalRows ? { from: next.from, to: Math.min(next.to, totalRows) } : null;
  const shownTo = Math.min(bottom.to, totalRows);
  const shownRows = anchor.data ? copy.shownRows(top.from, shownTo, totalRows) : null;
  const citedPastEnd = totalRows > 0 && cited !== null && cited.from > totalRows;

  return (
    <>
      <Group className={viewer.bar} justify="space-between" wrap="wrap" gap="xs" mih={47}>
        <Text fz="sm" c="gray.8" className="tabular-nums">
          {shownRows !== null && (citedPastEnd ? copy.citedPastEnd(shownRows) : shownRows)}
        </Text>
        {anchor.data && totalRows > 0 && cited && (
          <Button
            variant="subtle"
            size="compact-sm"
            rightSection={<IconArrowsVertical size={14} stroke={1.75} />}
            onClick={showCited}
          >
            {copy.citedRows(cited.from, cited.to)}
          </Button>
        )}
      </Group>

      {/* The grid runs left to right in both languages, column A first, as in Excel; so does its scroll. */}
      <div ref={stage} className={`${viewer.stage} ${classes.stage}`} dir="ltr">
        {anchor.isPending ? (
          <ViewerLoading label={copy.loadingSheet} />
        ) : anchor.isError ? (
          <Box p="md" dir={dir}>
            <Box maw={560}>
              <ErrorNotice error={anchor.error} onRetry={() => void anchor.refetch()} retryLabel={copy.tryAgain} />
            </Box>
          </Box>
        ) : (
          totalRows > 0 && (
            <>
              {earlier && (
                <MoreRowsButton
                  label={copy.showRows(earlier.from, earlier.to)}
                  dir={dir}
                  onClick={() => {
                    const firstRow = stage.current?.querySelector('tbody tr');
                    if (firstRow instanceof HTMLElement) holdView(firstRow);
                    setBlocks((current) => [earlier, ...current]);
                  }}
                />
              )}
              <Table
                stickyHeader
                withColumnBorders
                withRowBorders
                highlightOnHover={false}
                verticalSpacing={4}
                horizontalSpacing="xs"
                borderColor="gray.2"
                className={classes.table}
              >
                <Table.Thead className={classes.head}>
                  <Table.Tr>
                    <Table.Th className={classes.corner}>
                      <VisuallyHidden>{copy.rowHeader}</VisuallyHidden>
                    </Table.Th>
                    {Array.from({ length: columnCount }, (_, index) => (
                      <Table.Th key={index} className={classes.letter}>
                        {columnLetter(index)}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                {blocks.map((range) => (
                  <SheetBlock
                    key={range.from}
                    documentId={document.id}
                    sheet={sheet}
                    range={range}
                    columnCount={columnCount}
                    cited={cited}
                  />
                ))}
              </Table>
              {more && (
                <MoreRowsButton
                  label={copy.showRows(more.from, more.to)}
                  dir={dir}
                  onClick={() => setBlocks((current) => [...current, more])}
                />
              )}
            </>
          )
        )}
      </div>
    </>
  );
}

interface MoreRowsButtonProps {
  label: string;
  /** The interface's direction, for the button's words; the button itself keeps to the grid's left edge. */
  dir: Direction;
  onClick: () => void;
}

function MoreRowsButton({ label, dir, onClick }: MoreRowsButtonProps) {
  return (
    <Box className={classes.more}>
      <Button variant="default" size="compact-sm" dir={dir} onClick={onClick}>
        {label}
      </Button>
    </Box>
  );
}
