import type { FileKind } from '@atlas/shared';
import { IconFile, IconFileSpreadsheet, IconFileTypePdf, type Icon } from '@tabler/icons-react';
import { useCopy } from '../../i18n/useCopy';
import { sidebarCopy } from './sidebarCopy';

const icons: Record<FileKind, Icon> = {
  pdf: IconFileTypePdf,
  excel: IconFileSpreadsheet,
  other: IconFile,
};

/** The file's kind as a dimmed outline icon, with its name for screen readers. */
export function FileTypeIcon({ kind, size = 18 }: { kind: FileKind; size?: number }) {
  const KindIcon = icons[kind];
  const label = useCopy(sidebarCopy).kinds[kind];
  return (
    <KindIcon
      size={size}
      stroke={1.5}
      color="var(--mantine-color-dimmed)"
      role="img"
      aria-label={label}
      style={{ flexShrink: 0 }}
    />
  );
}
