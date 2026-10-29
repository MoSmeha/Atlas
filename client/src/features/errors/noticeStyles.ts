import type { AlertProps } from '@mantine/core';

export type NoticeColor = 'red' | 'yellow' | 'gray';

/** A notice's look: a shade-0 wash with a shade-2 hairline, a shade-9 title and a shade-7 icon. */
export function noticeStyles(color: NoticeColor): AlertProps['styles'] {
  return {
    root: {
      backgroundColor: `var(--mantine-color-${color}-0)`,
      border: `1px solid var(--mantine-color-${color}-2)`,
    },
    title: { color: `var(--mantine-color-${color}-9)`, fontWeight: 600, fontSize: 'var(--mantine-font-size-sm)' },
    icon: { color: `var(--mantine-color-${color}-7)` },
  };
}
