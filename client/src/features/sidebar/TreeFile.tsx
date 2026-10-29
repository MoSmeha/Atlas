import type { DocumentSummary } from '@atlas/shared';
import { Tooltip, UnstyledButton } from '@mantine/core';
import { useRemoveFromFolder } from '../../api/useRemoveFromFolder';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { notifyError } from '../errors/notifyError';
import { useDocumentViewer } from '../viewer/useDocumentViewer';
import arrive from './arrive.module.css';
import { documentMeta } from './documentMeta';
import { FileTypeIcon } from './FileTypeIcon';
import classes from './FolderTree.module.css';
import { RemoveButton } from './RemoveButton';
import { sidebarCopy } from './sidebarCopy';
import { StatusBadge } from './StatusBadge';

interface TreeFileProps {
  document: DocumentSummary;
  /** The folder is Atlas's uploads folder, so removing the file deletes it and asks first. */
  uploads: boolean;
}

/**
 * One file in the tree: kind icon and name, with a badge when Atlas could not fully read it; under the
 * name, its pages or sheets and its document type. The full path shows on hover, and the whole row
 * opens the file in the viewer. Its × removes the file from Atlas.
 */
export function TreeFile({ document, uploads }: TreeFileProps) {
  const copy = useCopy(sidebarCopy);
  const { language } = useLanguage();
  const viewer = useDocumentViewer();
  const remove = useRemoveFromFolder();
  const active = viewer.openedId === document.id;

  return (
    <li className={`${classes.file} ${arrive.arrive}`} data-active={active || undefined}>
      <FileTypeIcon kind={document.kind} size={16} />
      <div className={classes.fileText}>
        <div className={classes.fileLine}>
          <Tooltip label={<span dir="ltr">{document.path}</span>}>
            <UnstyledButton
              className={classes.open}
              onClick={() => viewer.open(document.id)}
              aria-haspopup="dialog"
              aria-current={active || undefined}
            >
              <span className={classes.fileName} dir="auto">
                {document.name}
              </span>
            </UnstyledButton>
          </Tooltip>
          <StatusBadge status={document.status} detail={document.statusDetail} className={classes.status} />
        </div>
        <span className={classes.meta}>{documentMeta(document, copy)}</span>
      </div>
      <RemoveButton
        label={copy.removeItem(document.name)}
        question={uploads ? { ...copy.deleteUploaded, title: copy.deleteUploaded.title(document.name), action: copy.delete } : null}
        pending={remove.isPending}
        onRemove={() => remove.mutate(document.path, { onError: (error) => notifyError(error, copy.removeFailed, language) })}
      />
    </li>
  );
}
