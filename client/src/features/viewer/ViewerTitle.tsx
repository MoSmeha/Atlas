import { Text } from '@mantine/core';
import type { Source } from '@atlas/shared';
import { formatNumber } from '../chat/formatNumber';
import { fileNameOf, rowsText } from '../chat/sourcePlace';
import { FileTypeIcon } from '../sidebar/FileTypeIcon';
import classes from './SourceViewer.module.css';

/**
 * The file's name and where in it the source points, with its folder under it when it has one.
 * Spans only, since the modal sets it inside its heading.
 */
export function ViewerTitle({ source }: { source: Source }) {
  const name = fileNameOf(source.document);
  const folder = source.document.slice(0, Math.max(0, source.document.length - name.length)).replace(/[\\/]$/, '');

  return (
    <span className={classes.titleRow}>
      <FileTypeIcon kind={source.kind} size={22} />
      <span className={classes.titleText}>
        <span className={classes.titleLine}>
          <Text component="span" fz="md" fw={600} c="gray.9" truncate miw={0}>
            {name}
          </Text>
          <Text component="span" fz="sm" fw={400} c="dimmed" className="tabular-nums">
            {source.kind === 'pdf' ? (
              `page ${formatNumber(source.page)}`
            ) : (
              <>
                sheet <bdi>{source.sheet}</bdi>, {rowsText(source)}
              </>
            )}
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
