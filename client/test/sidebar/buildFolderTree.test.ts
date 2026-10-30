import type { DocumentSummary } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { buildFolderTree } from '../../src/features/sidebar/buildFolderTree';

function doc(path: string): DocumentSummary {
  const name = path.split('/').at(-1) ?? path;
  return {
    id: path,
    name,
    path,
    kind: 'pdf',
    status: 'ok',
    statusDetail: null,
    sizeBytes: 1,
    pageCount: 1,
    scannedPages: [],
  } as unknown as DocumentSummary;
}

describe('buildFolderTree', () => {
  it('keeps a flat folder as one level of files, in the order given', () => {
    const tree = buildFolderTree('riyadh-tower', [doc('b.pdf'), doc('a.pdf')]);
    expect(tree).toMatchObject({ name: 'riyadh-tower', path: '', fileCount: 2, folders: [] });
    expect(tree.files.map((file) => file.name)).toEqual(['b.pdf', 'a.pdf']);
  });

  it('nests files under their subfolders and counts every file below a folder', () => {
    const tree = buildFolderTree('project', [doc('Drawings/Arch/A-101.pdf'), doc('Drawings/S-01.pdf'), doc('Contract.pdf')]);
    expect(tree.fileCount).toBe(3);
    expect(tree.files.map((file) => file.name)).toEqual(['Contract.pdf']);
    const [drawings] = tree.folders;
    expect(drawings).toMatchObject({ name: 'Drawings', path: 'Drawings', fileCount: 2 });
    expect(drawings?.files.map((file) => file.name)).toEqual(['S-01.pdf']);
    expect(drawings?.folders[0]).toMatchObject({ name: 'Arch', path: 'Drawings/Arch', fileCount: 1 });
  });

  it('sorts subfolders by name with numbers in order', () => {
    const tree = buildFolderTree('project', [doc('Phase 10/a.pdf'), doc('phase 2/b.pdf'), doc('Phase 1/c.pdf')]);
    expect(tree.folders.map((folder) => folder.name)).toEqual(['Phase 1', 'phase 2', 'Phase 10']);
  });
});
