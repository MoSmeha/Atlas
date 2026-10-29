import { Tooltip, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import type { Source } from '@atlas/shared';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { FileTypeIcon } from '../sidebar/FileTypeIcon';
import { chatCopy } from './chatCopy';
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
 * passage under it when there is one. The whole row opens the source. The file name and the quote
 * keep their own direction; the chevron points along the reading direction.
 */
export function SourceRow({ number, source, active, onOpen }: SourceRowProps) {
  const { language } = useLanguage();
  const copy = useCopy(chatCopy).sources;
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
          <Tooltip label={<span dir="auto">{source.document}</span>} disabled={name === source.document}>
            <span className={classes.name} dir="auto">
              {name}
            </span>
          </Tooltip>
          <span className={classes.place}>
            {source.kind === 'pdf'
              ? copy.page(source.page)
              : copy.sheet(source.sheet, rowsText(source, language))}
          </span>
        </span>
        {quote && (
          <span className={classes.quote} dir="auto">
            {quote}
          </span>
        )}
      </span>
      <span className={classes.open} aria-hidden>
        <IconChevronRight size={16} stroke={1.75} className="flip-rtl" />
      </span>
    </UnstyledButton>
  );
}
