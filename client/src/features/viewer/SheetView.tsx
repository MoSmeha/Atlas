import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Group, Table, Text, VisuallyHidden } from '@mantine/core';
import { IconArrowsVertical } from '@tabler/icons-react';
import type { DocumentSummary } from '@atlas/shared';
import type { RowRange } from '../../api/endpoints';
import { useSheetRows } from '../../api/useSheetRows';
import { formatNumber } from '../chat/formatNumber';
import { rowsText } from '../chat/sourcePlace';
import { ErrorNotice } from '../errors/ErrorNotice';
import { SheetBlock } from './SheetBlock';
import { ViewerLoading } from './ViewerLoading';
import { columnLetter, firstWindow, rowsAfter, rowsBefore, shownRowsText, topWindow } from './sheetWindow';
import { scrollToMiddle } from './stageScroll';
import { useKeepInView } from './useKeepInView';
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

  return (
    <>
      <Group className={viewer.bar} justify="space-between" wrap="wrap" gap="xs" mih={47}>
        <Text fz="sm" c="gray.8" className="tabular-nums">
          {anchor.data && shownRowsText(top.from, shownTo, totalRows)}
          {anchor.data && totalRows > 0 && cited && cited.from > totalRows && '. The cited rows are past its last row.'}
        </Text>
        {anchor.data && totalRows > 0 && cited && (
          <Button
            variant="subtle"
            size="compact-sm"
            rightSection={<IconArrowsVertical size={14} stroke={1.75} />}
            onClick={showCited}
          >
            Cited {rowsText({ rowFrom: cited.from, rowTo: cited.to })}
          </Button>
        )}
      </Group>

      <div ref={stage} className={`${viewer.stage} ${classes.stage}`}>
        {anchor.isPending ? (
          <ViewerLoading label="Loading the sheet" />
        ) : anchor.isError ? (
          <Box p="md" maw={560}>
            <ErrorNotice error={anchor.error} onRetry={() => void anchor.refetch()} retryLabel="Try again" />
          </Box>
        ) : (
          totalRows > 0 && (
            <>
              {earlier && (
                <MoreRowsButton
                  range={earlier}
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
                      <VisuallyHidden>Row</VisuallyHidden>
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
              {more && <MoreRowsButton range={more} onClick={() => setBlocks((current) => [...current, more])} />}
            </>
          )
        )}
      </div>
    </>
  );
}

function MoreRowsButton({ range, onClick }: { range: RowRange; onClick: () => void }) {
  return (
    <Box className={classes.more}>
      <Button variant="default" size="compact-sm" onClick={onClick}>
        Show rows {formatNumber(range.from)}–{formatNumber(range.to)}
      </Button>
    </Box>
  );
}
