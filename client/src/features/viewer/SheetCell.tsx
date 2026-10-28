import { Table } from '@mantine/core';
import type { CellValue } from '@atlas/shared';
import { formatNumber } from '../chat/formatNumber';
import { SHORT_TEXT } from './cellSpans';
import classes from './SheetView.module.css';

interface SheetCellProps {
  value: CellValue;
  /** Columns covered; long text runs on over empty neighbours on one line. */
  span?: number;
}

/** One raw cell: numbers right-aligned exactly as stored, text in its own direction, blanks left blank. */
export function SheetCell({ value, span = 1 }: SheetCellProps) {
  if (value === null) return <Table.Td />;
  if (typeof value === 'number') {
    return <Table.Td className={classes.number}>{formatNumber(value)}</Table.Td>;
  }
  const layout = span > 1 ? classes.runOn : value.length <= SHORT_TEXT ? classes.short : classes.text;
  return (
    <Table.Td dir="auto" colSpan={span > 1 ? span : undefined} className={layout}>
      {value}
    </Table.Td>
  );
}
