import type { FileKind } from '@atlas/shared';
import { IconFile, IconFileSpreadsheet, IconFileTypePdf, type Icon } from '@tabler/icons-react';
import { useCopy } from '../../i18n/useCopy';
import { sidebarCopy } from './sidebarCopy';

const icons: Record<FileKind, Icon> = {
  pdf: IconFileTypePdf,
  excel: IconFileSpreadsheet,
  other: IconFile,
};

/** Each kind in the colour it is known by: PDF red, Excel green. Files Atlas does not read stay dimmed. */
const colors: Record<FileKind, string> = {
  pdf: 'var(--atlas-kind-pdf)',
  excel: 'var(--atlas-kind-excel)',
  other: 'var(--mantine-color-dimmed)',
};

/** The file's kind as an outline icon in its kind's colour, with its name for screen readers. */
export function FileTypeIcon({ kind, size = 18 }: { kind: FileKind; size?: number }) {
  const KindIcon = icons[kind];
  const label = useCopy(sidebarCopy).kinds[kind];
  return (
    <KindIcon
      size={size}
      stroke={1.5}
      color={colors[kind]}
      role="img"
      aria-label={label}
      style={{ flexShrink: 0 }}
    />
  );
}
