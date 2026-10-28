import type { FileKind } from '@atlas/shared';
import { IconFile, IconFileSpreadsheet, IconFileTypePdf, type Icon } from '@tabler/icons-react';

const icons: Record<FileKind, Icon> = {
  pdf: IconFileTypePdf,
  excel: IconFileSpreadsheet,
  other: IconFile,
};

const labels: Record<FileKind, string> = {
  pdf: 'PDF',
  excel: 'Excel workbook',
  other: 'Other file',
};

/** The file's kind as a dimmed outline icon, with its name for screen readers. */
export function FileTypeIcon({ kind, size = 18 }: { kind: FileKind; size?: number }) {
  const KindIcon = icons[kind];
  return (
    <KindIcon
      size={size}
      stroke={1.5}
      color="var(--mantine-color-dimmed)"
      role="img"
      aria-label={labels[kind]}
      style={{ flexShrink: 0 }}
    />
  );
}
