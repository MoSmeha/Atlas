import { Button, Group, Loader, Table, Text } from '@mantine/core';
import type { RowRange } from '../../api/endpoints';
import { useSheetRows } from '../../api/useSheetRows';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { errorMessage } from '../errors/errorCopy';
import { SheetCell } from './SheetCell';
import { cellSpans } from './cellSpans';
import { viewerCopy } from './viewerCopy';
import classes from './SheetView.module.css';

interface SheetBlockProps {
  documentId: string;
  sheet: string;
  range: RowRange;
  columnCount: number;
  /** The rows the source cites, tinted; null when nothing is cited. */
  cited: RowRange | null;
}

/** One stretch of sheet rows, fetched on its own so the sheet can grow up and down. */
export function SheetBlock({ documentId, sheet, range, columnCount, cited }: SheetBlockProps) {
  const copy = useCopy(viewerCopy);
  const { language, dir } = useLanguage();
  const rows = useSheetRows(documentId, sheet, range.from, range.to);
  const span = columnCount + 1;

  if (rows.isPending || rows.isError) {
    return (
      <Table.Tbody>
        <Table.Tr>
          <Table.Td colSpan={span} className={classes.blockCell}>
            {/* The note keeps to the grid's left edge; its words read in the interface's direction. */}
            <div className={classes.blockNote}>
              <Group gap="xs" dir={dir} role={rows.isError ? 'alert' : 'status'}>
                {rows.isError ? (
                  <>
                    <Text fz="sm" c="red.8">
                      {errorMessage(rows.error, language)}
                    </Text>
                    <Button variant="default" size="compact-xs" onClick={() => void rows.refetch()}>
                      {copy.tryAgain}
                    </Button>
                  </>
                ) : (
                  <>
                    <Loader size="xs" type="dots" />
                    <Text fz="sm" c="dimmed">
                      {copy.loadingRows(range.from, range.to)}
                    </Text>
                  </>
                )}
              </Group>
            </div>
          </Table.Td>
        </Table.Tr>
      </Table.Tbody>
    );
  }

  return (
    <Table.Tbody>
      {rows.data.rows.map(({ rowNumber, cells }) => {
        const isCited = cited !== null && rowNumber >= cited.from && rowNumber <= cited.to;
        return (
          <Table.Tr
            key={rowNumber}
            data-cited={isCited || undefined}
            data-first-cited={rowNumber === cited?.from || undefined}
          >
            <Table.Th scope="row" className={classes.rowNumber}>
              {rowNumber}
            </Table.Th>
            {cellSpans(cells, columnCount).map(({ value, span }, index) => (
              <SheetCell key={index} value={value} span={span} />
            ))}
          </Table.Tr>
        );
      })}
    </Table.Tbody>
  );
}
