import type { ReactNode } from 'react';
import { Text } from '@mantine/core';
import type { FileKind } from '@atlas/shared';
import { fileNameOf } from '../chat/sourcePlace';
import { FileTypeIcon } from '../sidebar/FileTypeIcon';
import classes from './SourceViewer.module.css';

interface ViewerTitleProps {
  kind: FileKind;
  /** The folder-relative path of the file. */
  path: string;
  /** Where in the file the viewer opens ("page 37"), or what the file holds ("4 sheets"). */
  place: ReactNode;
}

/**
 * The file's name and its place, with its folder under it when it has one.
 * Spans only, since the modal sets it inside its heading.
 */
export function ViewerTitle({ kind, path, place }: ViewerTitleProps) {
  const name = fileNameOf(path);
  const folder = path.slice(0, Math.max(0, path.length - name.length)).replace(/[\\/]$/, '');

  return (
    <span className={classes.titleRow}>
      <FileTypeIcon kind={kind} size={22} />
      <span className={classes.titleText}>
        <span className={classes.titleLine}>
          <Text component="span" fz="md" fw={600} c="gray.9" truncate miw={0}>
            {name}
          </Text>
          <Text component="span" fz="sm" fw={400} c="dimmed" className="tabular-nums">
            {place}
          </Text>
        </span>
        {folder !== '' && (
          <Text component="span" fz="xs" fw={400} c="dimmed" truncate>
            {folder}
          </Text>
        )}
      </span>
    </span>
  );
}
