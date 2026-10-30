import type { DocumentSummary } from '@atlas/shared';

/** A folder in the documents tree: its subfolders, then its files. */
export interface FolderNode {
  name: string;
  /** Path relative to the loaded folder, with forward slashes; empty for the loaded folder itself. */
  path: string;
  folders: FolderNode[];
  files: DocumentSummary[];
  /** Files in this folder and in every folder under it. */
  fileCount: number;
}

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * The loaded folder as a tree, built from each document's relative path. Subfolders sort by name with
 * numbers in order ("Phase 2" before "Phase 10"), the way Explorer lists them; files keep the server's order.
 */
export function buildFolderTree(rootName: string, documents: readonly DocumentSummary[]): FolderNode {
  const root: FolderNode = { name: rootName, path: '', folders: [], files: [], fileCount: 0 };
  for (const document of documents) {
    const folders = document.path.split('/').filter((part) => part !== '').slice(0, -1);
    let folder = root;
    folder.fileCount++;
    for (const name of folders) {
      const path = folder.path === '' ? name : `${folder.path}/${name}`;
      let child = folder.folders.find((candidate) => candidate.path === path);
      if (child === undefined) {
        child = { name, path, folders: [], files: [], fileCount: 0 };
        folder.folders.push(child);
      }
      child.fileCount++;
      folder = child;
    }
    folder.files.push(document);
  }
  sortFolders(root);
  return root;
}

function sortFolders(folder: FolderNode): void {
  folder.folders.sort((a, b) => byName.compare(a.name, b.name));
  folder.folders.forEach(sortFolders);
}
