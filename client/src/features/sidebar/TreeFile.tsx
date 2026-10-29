import type { DocumentSummary } from '@atlas/shared';
import { Tooltip } from '@mantine/core';
import { useCopy } from '../../i18n/useCopy';
import arrive from './arrive.module.css';
import { documentMeta } from './documentMeta';
import { FileTypeIcon } from './FileTypeIcon';
import classes from './FolderTree.module.css';
import { sidebarCopy } from './sidebarCopy';
import { StatusBadge } from './StatusBadge';

/**
 * One file in the tree: kind icon and name, with a badge when Atlas could not fully read it; under the
 * name, its pages or sheets and its document type. The full path shows on hover.
 */
export function TreeFile({ document }: { document: DocumentSummary }) {
  const copy = useCopy(sidebarCopy);
  return (
    <li className={`${classes.file} ${arrive.arrive}`}>
      <FileTypeIcon kind={document.kind} size={16} />
      <div className={classes.fileText}>
        <div className={classes.fileLine}>
          <Tooltip label={<span dir="ltr">{document.path}</span>}>
            <span className={classes.fileName} dir="auto">
              {document.name}
            </span>
          </Tooltip>
          <StatusBadge status={document.status} detail={document.statusDetail} />
        </div>
        <span className={classes.meta}>{documentMeta(document, copy)}</span>
      </div>
    </li>
  );
}
