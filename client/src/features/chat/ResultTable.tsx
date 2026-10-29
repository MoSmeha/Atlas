import { useId, useMemo, useState } from 'react';
import { Box, Button, DirectionProvider, Group, ScrollArea, Stack, Table, Text, VisuallyHidden } from '@mantine/core';
import type { CellValue, ResultTable as ResultTableData } from '@atlas/shared';
import { useCopy } from '../../i18n/useCopy';
import { ExportMenu } from './ExportMenu';
import { isArabicText } from './arabicText';
import { chatCopy } from './chatCopy';
import { formatNumber } from './formatNumber';
import { type ResultColumn, resultColumns } from './resultColumns';
import classes from './ResultTable.module.css';

/** Rows on screen at first; the rest of what the server sent is one click away. */
const FIRST_ROWS = 50;

/** Text up to this many characters never wraps, so codes and short labels keep to one line. */
const SHORT_TEXT = 24;

/** Header cells may wrap; the theme keeps them on one line elsewhere. */
const headerStyles = { th: { whiteSpace: 'normal' } } as const;

/**
 * The rows a tool computed for the answer, exactly as the server sent them: numbers right-aligned
 * with thousands separators and never rounded, text in its own direction, SQL column names as
 * plain words, a header that stays in view while the rows scroll, and an Export menu for every
 * row and column of the result. The columns run in the direction of their own labels, not the
 * interface's, so a table reads the way its document does in either language.
 */
export function ResultTable({ table }: { table: ResultTableData }) {
  const copy = useCopy(chatCopy).table;
  const [limit, setLimit] = useState(FIRST_ROWS);
  const titleId = useId();
  const countId = useId();
  const columns = useMemo(() => resultColumns(table), [table]);
  const dir = useMemo(() => (isArabicText(columns.map((column) => column.label).join(' ')) ? 'rtl' : 'ltr'), [columns]);
  const rows = table.rows.slice(0, limit);
  const hidden = table.rows.length - rows.length;
  const onlySomeSent = hidden === 0 && table.rows.length < table.totalRows;
  const count = copy.rowCount(rows.length, table.totalRows);

  return (
    <Stack component="section" gap="xs" aria-labelledby={titleId}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text id={titleId} fz="sm" fw={600} c="gray.9" dir="auto" miw={0} className={classes.text}>
          {table.title ?? copy.untitled}
        </Text>
        <ExportMenu resultId={table.resultId} />
      </Group>

      <Box className={classes.frame} dir={dir}>
        {/* The scrollbar reads the direction from Mantine, so it follows the table's rather than the page's. */}
        <DirectionProvider key={dir} initialDirection={dir} detectDirection={false}>
          <ScrollArea.Autosize
            mah="min(28rem, 60dvh)"
            type="auto"
            viewportProps={{ tabIndex: 0, role: 'region', 'aria-labelledby': titleId }}
          >
            <Table stickyHeader borderColor="gray.2" styles={headerStyles} aria-describedby={countId}>
              <Table.Thead className={classes.head}>
                <Table.Tr>
                  {columns.map((column) => (
                    <Table.Th key={column.index} dir="auto" className={column.numeric ? classes.number : undefined}>
                      {column.label}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row, rowIndex) => (
                  <Table.Tr key={rowIndex}>
                    {columns.map((column) => (
                      <Cell key={column.index} value={row[column.index] ?? null} column={column} noValue={copy.noValue} />
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        </DirectionProvider>
      </Box>

      <Group gap="xs" justify="space-between" wrap="wrap" mih={22}>
        <Text id={countId} fz="xs" c="dimmed">
          {onlySomeSent ? copy.someSent(count) : count}
        </Text>
        {hidden > 0 && (
          <Button variant="subtle" size="compact-xs" onClick={() => setLimit(table.rows.length)}>
            {copy.showMore(hidden)}
          </Button>
        )}
      </Group>
    </Stack>
  );
}

function Cell({ value, column, noValue }: { value: CellValue; column: ResultColumn; noValue: string }) {
  if (value === null) {
    return (
      <Table.Td className={column.numeric ? classes.number : undefined}>
        <span className={classes.empty} aria-hidden>
          –
        </span>
        <VisuallyHidden>{noValue}</VisuallyHidden>
      </Table.Td>
    );
  }
  if (typeof value === 'number') {
    return <Table.Td className={classes.number}>{formatNumber(value, column.numbers)}</Table.Td>;
  }
  return (
    <Table.Td dir="auto" className={value.length <= SHORT_TEXT ? classes.short : classes.text}>
      {value}
    </Table.Td>
  );
}
