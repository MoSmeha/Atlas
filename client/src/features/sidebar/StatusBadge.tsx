import type { FileStatus } from '@atlas/shared';
import { Badge, Tooltip, VisuallyHidden } from '@mantine/core';
import { statusLook } from './fileStatus';

interface StatusBadgeProps {
  status: FileStatus;
  /** The server's explanation, shown in the tooltip. */
  detail: string | null;
}

/** A coloured badge for a file Atlas could not fully read, with the reason on hover or focus. Nothing for "ok". */
export function StatusBadge({ status, detail }: StatusBadgeProps) {
  const look = statusLook(status);
  if (look === null) return null;
  const reason = detail ?? look.detail;
  const StatusIcon = look.icon;
  return (
    <Tooltip label={reason} events={{ hover: true, focus: true, touch: true }}>
      <Badge color={look.color} leftSection={<StatusIcon size={12} stroke={2} />} tabIndex={0} miw={0} style={{ flexShrink: 0 }}>
        {look.label}
        <VisuallyHidden>: {reason}</VisuallyHidden>
      </Badge>
    </Tooltip>
  );
}
