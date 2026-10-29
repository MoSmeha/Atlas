import { useId, useState } from 'react';
import { Collapse, UnstyledButton, VisuallyHidden } from '@mantine/core';
import { IconChevronDown, IconFolder, IconFolderOpen } from '@tabler/icons-react';
import { figure } from '../../i18n/count';
import { useCopy } from '../../i18n/useCopy';
import { motion } from '../../theme';
import type { FolderNode } from './buildFolderTree';
import classes from './FolderTree.module.css';
import { sidebarCopy } from './sidebarCopy';
import { TreeFile } from './TreeFile';

/**
 * The loaded folder as a tree, like File Explorer: the folder itself at the top, then its subfolders
 * and files on a hairline rail. Each folder opens and closes; all start open.
 */
export function FolderTree({ root }: { root: FolderNode }) {
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
      <Branch folder={root} root closed={closed} onToggle={toggle} />
    </ul>
  );
}

interface BranchProps {
  folder: FolderNode;
  root?: boolean;
  closed: ReadonlySet<string>;
  onToggle: (path: string) => void;
}

/** One folder: its row, which opens and closes it, and what it holds. */
function Branch({ folder, root = false, closed, onToggle }: BranchProps) {
  const copy = useCopy(sidebarCopy);
  const contentsId = useId();
  const open = !closed.has(folder.path);
  const FolderIcon = open ? IconFolderOpen : IconFolder;

  return (
    <li>
      <UnstyledButton
        className={classes.row}
        data-root={root || undefined}
        aria-expanded={open}
        aria-controls={contentsId}
        onClick={() => onToggle(folder.path)}
      >
        <IconChevronDown size={14} stroke={2} className={classes.chevron} aria-hidden />
        <FolderIcon size={18} stroke={1.5} className={classes.folderIcon} aria-hidden />
        <span className={classes.name} dir="auto">
          {folder.name}
        </span>
        <span className={classes.count} aria-hidden>
          {figure(folder.fileCount)}
        </span>
        <VisuallyHidden>{copy.files(folder.fileCount)}</VisuallyHidden>
      </UnstyledButton>
      <Collapse expanded={open} transitionDuration={motion.durationMs} transitionTimingFunction={motion.easing}>
        <ul id={contentsId} className={classes.children}>
          {folder.folders.map((child) => (
            <Branch key={child.path} folder={child} closed={closed} onToggle={onToggle} />
          ))}
          {folder.files.map((document) => (
            <TreeFile key={document.id} document={document} />
          ))}
        </ul>
      </Collapse>
    </li>
  );
}
