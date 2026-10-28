import { describe, expect, it } from 'vitest';
import { scanFile, scanFolder } from '../../src/application/indexing/scanFolder';
import type { FileEntry } from '../../src/application/ports/FileSystem';
import { FakeFileSystem } from '../fakes/FakeFileSystem';

const MB = 1024 * 1024;
const options = { maxFileBytes: 2 * MB };

async function statuses(fs: FakeFileSystem, folder = '/f') {
  const { files } = await scanFolder(fs, folder, options);
  return Object.fromEntries(files.map((file) => [file.entry.relativePath, [file.kind, file.status, file.detail]]));
}

describe('scanFolder', () => {
  it('marks PDF and Excel files pending and explains the rest', async () => {
    const fs = new FakeFileSystem();
    fs.addFile('/f/Contract.pdf');
    fs.addFile('/f/BOQ.xlsx');
    fs.addFile('/f/Rates.xlsm');
    fs.addFile('/f/Old BOQ.xls');
    fs.addFile('/f/Letter.docx');
    expect(await statuses(fs)).toEqual({
      'BOQ.xlsx': ['excel', 'pending', null],
      'Contract.pdf': ['pdf', 'pending', null],
      'Letter.docx': ['other', 'skipped', 'Word documents (.docx) are not read; only PDF and Excel files are.'],
      'Old BOQ.xls': ['other', 'skipped', 'Old .xls format is not supported; save it as .xlsx.'],
      'Rates.xlsm': ['excel', 'pending', null],
    });
  });

  it('flags empty files and files above the size limit', async () => {
    const fs = new FakeFileSystem();
    fs.addFile('/f/Blank.pdf', '');
    fs.addFile('/f/Huge.pdf', new Uint8Array(Math.round(2.5 * MB)));
    fs.addFile('/f/Edge.xlsx', new Uint8Array(2 * MB));
    fs.addFile('/f/Just over.pdf', new Uint8Array(2 * MB + 1));
    expect(await statuses(fs)).toEqual({
      'Blank.pdf': ['pdf', 'empty', 'The file is empty (0 bytes).'],
      'Edge.xlsx': ['excel', 'pending', null],
      'Huge.pdf': ['pdf', 'too_large', 'The file is 2.5 MB, larger than the 2 MB limit.'],
      'Just over.pdf': ['pdf', 'too_large', 'The file is 2.1 MB, larger than the 2 MB limit.'],
    });
  });

  it('reports an unsupported empty file as skipped, not empty', async () => {
    const fs = new FakeFileSystem();
    fs.addFile('/f/notes.txt', '');
    expect(await statuses(fs)).toEqual({
      'notes.txt': ['other', 'skipped', 'Text files (.txt) are not read; only PDF and Excel files are.'],
    });
  });

  it('ignores hidden files, hidden folders and Office lock files', async () => {
    const fs = new FakeFileSystem();
    fs.addFile('/f/BOQ.xlsx');
    fs.addFile('/f/.DS_Store');
    fs.addFile('/f/.git/index.pdf');
    fs.addFile('/f/~$BOQ.xlsx');
    fs.addFile('/f/Sub/~$Rates.xlsx');
    expect(Object.keys(await statuses(fs))).toEqual(['BOQ.xlsx']);
  });

  it('includes nested folders with forward-slash paths, sorted', async () => {
    const fs = new FakeFileSystem();
    fs.addFile('/f/Contracts/2024/Annex.pdf');
    fs.addFile('/f/BOQ/Phase 2.xlsx');
    fs.addFile('/f/Contracts/Main.pdf');
    fs.addFile('/f/Cover.pdf');
    const { files } = await scanFolder(fs, '/f', options);
    expect(files.map((file) => file.entry.relativePath)).toEqual([
      'BOQ/Phase 2.xlsx',
      'Contracts/2024/Annex.pdf',
      'Contracts/Main.pdf',
      'Cover.pdf',
    ]);
  });

  it('sorts even when the file system lists out of order', async () => {
    class ReversedFileSystem extends FakeFileSystem {
      override async listFiles(root: string): Promise<FileEntry[]> {
        return (await super.listFiles(root)).reverse();
      }
    }
    const fs = new ReversedFileSystem();
    fs.addFile('/f/a.pdf');
    fs.addFile('/f/b/c.pdf');
    fs.addFile('/f/d.xlsx');
    const { files } = await scanFolder(fs, '/f', options);
    expect(files.map((file) => file.entry.relativePath)).toEqual(['a.pdf', 'b/c.pdf', 'd.xlsx']);
  });

  it('returns no files for an empty folder and leaves folder_empty to the caller', async () => {
    const fs = new FakeFileSystem();
    fs.addDir('/empty');
    expect(await scanFolder(fs, '/empty', options)).toEqual({ files: [] });
  });

  it('throws folder_not_found for a missing folder or a file path', async () => {
    const fs = new FakeFileSystem();
    fs.addFile('/f/a.pdf');
    await expect(scanFolder(fs, '/missing', options)).rejects.toMatchObject({
      code: 'folder_not_found',
      message: 'Folder not found: /missing',
    });
    await expect(scanFolder(fs, '/f/a.pdf', options)).rejects.toMatchObject({ code: 'folder_not_found' });
  });
});

describe('scanFile', () => {
  it('decides one file the same way the folder scan does', async () => {
    const fs = new FakeFileSystem();
    fs.addFile('/f/Sub/BOQ.xlsx');
    const entry = (await fs.stat('/f', '/f/Sub/BOQ.xlsx')) as FileEntry;
    expect(scanFile(entry, options)).toEqual({ entry, kind: 'excel', status: 'pending', detail: null });
  });
});
