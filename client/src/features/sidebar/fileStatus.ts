import type { FileStatus } from '@atlas/shared';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleMinus,
  IconFileOff,
  IconLock,
  type Icon,
} from '@tabler/icons-react';
import { type SidebarCopy, sidebarCopy } from './sidebarCopy';

export interface StatusLook {
  label: string;
  /** Yellow when Atlas read part of it, red when it could not open it, gray when there was nothing to read. */
  color: 'yellow' | 'red' | 'gray';
  icon: Icon;
  /** Shown when the server sent no detail of its own. */
  detail: string;
}

const looks: Record<Exclude<FileStatus, 'ok'>, Pick<StatusLook, 'color' | 'icon'>> = {
  scanned: { color: 'yellow', icon: IconAlertTriangle },
  too_large: { color: 'yellow', icon: IconAlertTriangle },
  corrupt: { color: 'red', icon: IconAlertCircle },
  encrypted: { color: 'red', icon: IconLock },
  empty: { color: 'gray', icon: IconCircleMinus },
  skipped: { color: 'gray', icon: IconFileOff },
};

/** How a file status is shown in the interface language, or null for "ok", which gets no badge. */
export function statusLook(status: FileStatus, copy: SidebarCopy = sidebarCopy.en): StatusLook | null {
  return status === 'ok' ? null : { ...looks[status], ...copy.statuses[status] };
}
