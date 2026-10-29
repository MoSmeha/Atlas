import type { FileStatus } from '@atlas/shared';
import { Badge, Tooltip, VisuallyHidden } from '@mantine/core';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { statusLook } from './fileStatus';
import { sidebarCopy } from './sidebarCopy';

interface StatusBadgeProps {
  status: FileStatus;
  /** The server's explanation, shown in the tooltip. It is English, so Arabic shows the plain reason instead. */
  detail: string | null;
  className?: string;
}

/** A coloured badge for a file Atlas could not fully read, with the reason on hover or focus. Nothing for "ok". */
export function StatusBadge({ status, detail, className }: StatusBadgeProps) {
  const { language } = useLanguage();
  const look = statusLook(status, useCopy(sidebarCopy));
  if (look === null) return null;
  const reason = language === 'en' && detail !== null ? detail : look.detail;
  const StatusIcon = look.icon;
  return (
    <Tooltip label={reason} events={{ hover: true, focus: true, touch: true }}>
      <Badge
        color={look.color}
        leftSection={<StatusIcon size={12} stroke={2} />}
        tabIndex={0}
        miw={0}
        className={className}
        style={{ flexShrink: 0 }}
      >
        {look.label}
        <VisuallyHidden>: {reason}</VisuallyHidden>
      </Badge>
    </Tooltip>
  );
}
