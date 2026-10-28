import { Tooltip, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import type { Source } from '@atlas/shared';
import { FileTypeIcon } from '../sidebar/FileTypeIcon';
import { fileNameOf, rowsText } from './sourcePlace';
import classes from './SourcesList.module.css';

interface SourceRowProps {
  /** The source's place in the answer's list, from 1. */
  number: number;
  source: Source;
  /** This source is the one open in the viewer. */
  active: boolean;
  onOpen: () => void;
}

/**
 * One numbered source: file icon and name, then the page or the sheet and rows, with the quoted
 * passage under it when there is one. The whole row opens the source.
 */
export function SourceRow({ number, source, active, onOpen }: SourceRowProps) {
  const name = fileNameOf(source.document);
  const quote = source.kind === 'pdf' ? source.quote?.trim() : null;

  return (
    <UnstyledButton
      className={classes.row}
      onClick={onOpen}
      data-active={active || undefined}
      aria-current={active || undefined}
    >
      <span className={classes.number}>{number}</span>
      <span className={classes.icon}>
        <FileTypeIcon kind={source.kind} size={16} />
      </span>
      <span className={classes.main}>
        <span className={classes.line}>
          <Tooltip label={source.document} disabled={name === source.document}>
            <span className={classes.name}>{name}</span>
          </Tooltip>
          <span className={classes.place}>
            {source.kind === 'pdf' ? (
              `page ${source.page}`
            ) : (
              <>
                sheet <bdi>{source.sheet}</bdi>, {rowsText(source)}
              </>
            )}
          </span>
        </span>
        {quote && (
          <span className={classes.quote} dir="auto">
            {quote}
          </span>
        )}
      </span>
      <span className={classes.open} aria-hidden>
        <IconChevronRight size={16} stroke={1.75} />
      </span>
    </UnstyledButton>
  );
}
