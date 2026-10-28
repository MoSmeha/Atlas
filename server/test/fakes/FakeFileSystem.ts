import { posix } from 'node:path';
import type { FileEntry, FileSystem } from '../../src/application/ports/FileSystem';
import { isIgnoredName } from '../../src/domain/fileTypes';

interface FakeFile {
  data: Uint8Array;
  mtimeMs: number;
}

/** In-memory files keyed by absolute POSIX-style path, for example '/folder/BOQ.xlsx'. */
export class FakeFileSystem implements FileSystem {
  private readonly files = new Map<string, FakeFile>();
  private readonly dirs = new Set<string>();

  addFile(path: string, data: Uint8Array | string = 'x', mtimeMs = 1): void {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.files.set(path, { data: bytes, mtimeMs });
    for (let dir = posix.dirname(path); dir !== posix.dirname(dir); dir = posix.dirname(dir)) this.dirs.add(dir);
    this.dirs.add('/');
  }

  addDir(path: string): void {
    this.dirs.add(path);
  }

  deleteFile(path: string): void {
    this.files.delete(path);
  }

  async isDirectory(path: string): Promise<boolean> {
    return this.dirs.has(path);
  }

  async listFiles(root: string): Promise<FileEntry[]> {
    return [...this.files.keys()]
      .filter((path) => path.startsWith(`${root}/`))
      .filter((path) => !posix.relative(root, path).split('/').some(isIgnoredName))
      .sort()
      .map((path) => this.entry(root, path));
  }

  async stat(root: string, absolutePath: string): Promise<FileEntry | null> {
    return this.files.has(absolutePath) ? this.entry(root, absolutePath) : null;
  }

  async readFile(path: string): Promise<Uint8Array> {
    const file = this.files.get(path);
    if (!file) throw new Error(`ENOENT: ${path}`);
    return file.data;
  }

  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    this.addFile(path, data);
  }

  async ensureDir(path: string): Promise<void> {
    this.dirs.add(path);
  }

  private entry(root: string, path: string): FileEntry {
    const file = this.files.get(path) as FakeFile;
    const name = posix.basename(path);
    return {
      absolutePath: path,
      relativePath: posix.relative(root, path),
      name,
      extension: posix.extname(name).toLowerCase(),
      size: file.data.byteLength,
      mtimeMs: file.mtimeMs,
    };
  }
}
