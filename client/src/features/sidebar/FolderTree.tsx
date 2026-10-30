import { useId, useState } from 'react';
import { Collapse, UnstyledButton, VisuallyHidden } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { useRemoveFromFolder } from '../../api/useRemoveFromFolder';
import { useUnloadFolder } from '../../api/useUnloadFolder';
import { figure } from '../../i18n/count';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { motion } from '../../theme';
import { notifyError } from '../errors/notifyError';
import type { FolderNode } from './buildFolderTree';
import { FolderGlyph } from './FolderGlyph';
import classes from './FolderTree.module.css';
import { RemoveButton, type RemoveQuestion } from './RemoveButton';
import { sidebarCopy } from './sidebarCopy';
import { TreeFile } from './TreeFile';

interface FolderTreeProps {
  root: FolderNode;
  /** The loaded folder is Atlas's uploads folder: removing deletes, so each removal asks first. */
  uploads: boolean;
}

/**
 * The loaded folder as a tree, like File Explorer: the folder itself at the top, then its subfolders
 * and files on a hairline rail. Each folder opens and closes; all start open. Every row has a × that
 * removes it from Atlas; on the top folder it removes the whole folder.
 */
export function FolderTree({ root, uploads }: FolderTreeProps) {
  const copy = useCopy(sidebarCopy);
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (path: string) =>
    setClosed((previous) => {
      const next = new Set(previous);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  return (
    <ul className={classes.tree} aria-label={copy.documents}>
      <Branch folder={root} root uploads={uploads} closed={closed} onToggle={toggle} />
    </ul>
  );
}

interface BranchProps {
  folder: FolderNode;
  root?: boolean;
  uploads: boolean;
  closed: ReadonlySet<string>;
  onToggle: (path: string) => void;
}

/** One folder: its row, which opens and closes it, and what it holds. */
function Branch({ folder, root = false, uploads, closed, onToggle }: BranchProps) {
  const copy = useCopy(sidebarCopy);
  const contentsId = useId();
  const open = !closed.has(folder.path);

  return (
    <li>
      <div className={classes.folderLine}>
        <UnstyledButton
          className={classes.row}
          data-root={root || undefined}
          aria-expanded={open}
          aria-controls={contentsId}
          onClick={() => onToggle(folder.path)}
        >
          <IconChevronDown size={14} stroke={2} className={classes.chevron} aria-hidden />
          <FolderGlyph open={open} />
          <span className={classes.name} dir="auto">
            {folder.name}
          </span>
          <span className={classes.count} aria-hidden>
            {figure(folder.fileCount)}
          </span>
          <VisuallyHidden>{copy.files(folder.fileCount)}</VisuallyHidden>
        </UnstyledButton>
        {root ? <RemoveLoadedFolder folder={folder} uploads={uploads} /> : <RemoveSubfolder folder={folder} uploads={uploads} />}
      </div>
      <Collapse expanded={open} transitionDuration={motion.durationMs} transitionTimingFunction={motion.easing}>
        <ul id={contentsId} className={classes.children}>
          {folder.folders.map((child) => (
            <Branch key={child.path} folder={child} uploads={uploads} closed={closed} onToggle={onToggle} />
          ))}
          {folder.files.map((document) => (
            <TreeFile key={document.id} document={document} uploads={uploads} />
          ))}
        </ul>
      </Collapse>
    </li>
  );
}

/** Removes a subfolder and everything in it; in the uploads folder that deletes it, so it asks first. */
function RemoveSubfolder({ folder, uploads }: { folder: FolderNode; uploads: boolean }) {
  const copy = useCopy(sidebarCopy);
  const { language } = useLanguage();
  const remove = useRemoveFromFolder();
  const question: RemoveQuestion | null = uploads
    ? { title: copy.deleteUploaded.title(folder.name), body: copy.deleteUploaded.body, action: copy.delete }
    : null;

  return (
    <RemoveButton
      label={copy.removeItem(folder.name)}
      question={question}
      pending={remove.isPending}
      onRemove={() => remove.mutate(folder.path, { onError: (error) => notifyError(error, copy.removeFailed, language) })}
    />
  );
}

/** Removes the whole loaded folder from Atlas, which always asks first. */
function RemoveLoadedFolder({ folder, uploads }: { folder: FolderNode; uploads: boolean }) {
  const copy = useCopy(sidebarCopy);
  const { language } = useLanguage();
  const unload = useUnloadFolder();
  const question: RemoveQuestion = uploads
    ? { title: copy.removeUploads.title, body: copy.removeUploads.body(folder.fileCount), action: copy.delete }
    : { title: copy.removeFolder.title(folder.name), body: copy.removeFolder.body, action: copy.remove };

  return (
    <RemoveButton
      label={copy.removeItem(folder.name)}
      question={question}
      pending={unload.isPending}
      onRemove={() => unload.mutate(undefined, { onError: (error) => notifyError(error, copy.removeFailed, language) })}
    />
  );
}
