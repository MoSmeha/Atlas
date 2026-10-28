import type { FileStatus } from '@atlas/shared';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleDashed,
  IconLock,
  type Icon,
} from '@tabler/icons-react';

export interface StatusLook {
  label: string;
  /** Yellow when Atlas read part of it, red when it could not open it, gray when there was nothing to read. */
  color: 'yellow' | 'red' | 'gray';
  icon: Icon;
  /** Shown when the server sent no detail of its own. */
  detail: string;
}

const looks: Record<Exclude<FileStatus, 'ok'>, StatusLook> = {
  scanned: {
    label: 'Scanned',
    color: 'yellow',
    icon: IconAlertTriangle,
    detail: 'Some pages are scanned images with no text, so Atlas cannot search them.',
  },
  too_large: {
    label: 'Too large',
    color: 'yellow',
    icon: IconAlertTriangle,
    detail: 'The file is over the size limit, so Atlas did not read it.',
  },
  corrupt: {
    label: 'Damaged',
    color: 'red',
    icon: IconAlertCircle,
    detail: 'The file is damaged and could not be opened.',
  },
  encrypted: {
    label: 'Password protected',
    color: 'red',
    icon: IconLock,
    detail: 'The file is password protected, so Atlas cannot read it.',
  },
  empty: {
    label: 'Empty',
    color: 'gray',
    icon: IconCircleDashed,
    detail: 'The file has no text or data to read.',
  },
  skipped: {
    label: 'Not read',
    color: 'gray',
    icon: IconCircleDashed,
    detail: 'Atlas reads only PDF and Excel files.',
  },
};

/** How a file status is shown, or null for "ok", which gets no badge. */
export function statusLook(status: FileStatus): StatusLook | null {
  return status === 'ok' ? null : looks[status];
}
