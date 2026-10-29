import type { Dirent } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import type { FileEntry, FileSystem } from '../../application/ports/FileSystem';
import { isIgnoredName } from '../../domain/fileTypes';

/** Errors that mean the path is gone, for example a file deleted while the folder is listed. */
const MISSING = new Set(['ENOENT', 'ENOTDIR']);
/** Errors that skip one entry during a listing instead of failing the whole folder. */
const SKIPPABLE = new Set([...MISSING, 'EACCES', 'EPERM', 'EBUSY']);

/** The FileSystem port on the local disk with node:fs/promises. */
export class NodeFileSystem implements FileSystem {
  async isDirectory(path: string): Promise<boolean> {
    try {
      return (await stat(path)).isDirectory();
    } catch {
      return false;
    }
  }

  async listFiles(root: string): Promise<FileEntry[]> {
    const base = resolve(root);
    const files = await this.walk(base, base);
    return files.sort((a, b) => compare(a.relativePath, b.relativePath));
  }

  async stat(root: string, absolutePath: string): Promise<FileEntry | null> {
    const path = resolve(absolutePath);
    try {
      const stats = await stat(path);
      if (!stats.isFile()) return null;
      const name = basename(path);
      return {
        absolutePath: path,
        relativePath: relative(resolve(root), path).split(sep).join('/'),
        name,
        extension: extname(name).toLowerCase(),
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      };
    } catch (error) {
      if (MISSING.has(errorCode(error))) return null;
      throw error;
    }
  }

  async readFile(path: string): Promise<Uint8Array> {
    return readFile(path);
  }

  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async ensureDir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  /** Retries briefly, since Windows can hold a file that a reader or the watcher has only just let go of. */
  async remove(root: string, relativePath: string): Promise<void> {
    const base = resolve(root);
    const path = resolve(base, ...relativePath.split('/'));
    if (path !== base && !path.startsWith(base + sep)) throw new Error(`${relativePath} is not inside ${root}.`);
    await rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }

  private async walk(root: string, dir: string): Promise<FileEntry[]> {
    const dirents = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
      dirents.filter((dirent) => !isIgnoredName(dirent.name)).map((dirent) => this.visit(root, join(dir, dirent.name), dirent)),
    );
    return nested.flat();
  }

  /** One entry of a listing. Symlinked files are followed; symlinked folders are not, so links cannot loop. */
  private async visit(root: string, path: string, dirent: Dirent): Promise<FileEntry[]> {
    try {
      if (dirent.isDirectory()) return await this.walk(root, path);
      if (!dirent.isFile() && !dirent.isSymbolicLink()) return [];
      const entry = await this.stat(root, path);
      return entry ? [entry] : [];
    } catch (error) {
      if (SKIPPABLE.has(errorCode(error))) return [];
      throw error;
    }
  }
}

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : '';
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
