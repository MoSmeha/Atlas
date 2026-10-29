import { createHash } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { DocumentIndexFactory } from '../../application/ports/DocumentIndex';
import { SqliteIndex } from './SqliteIndex';

/** SQLite codes for a file that is not, or no longer, a readable database. */
const DAMAGED = new Set(['SQLITE_NOTADB', 'SQLITE_CORRUPT']);

/** Keeps one index file per folder at `<dataDir>/indexes/<hash of the folder's absolute path>.sqlite`. */
export class SqliteIndexFactory implements DocumentIndexFactory {
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  /** Opens the folder's index. A damaged file is only a cache, so it is deleted and started again. */
  open(folder: string): SqliteIndex {
    const file = this.fileFor(folder);
    mkdirSync(join(this.dataDir, 'indexes'), { recursive: true });
    try {
      return new SqliteIndex(file);
    } catch (error) {
      if (!DAMAGED.has((error as { code?: string }).code ?? '')) throw error;
      for (const suffix of ['', '-wal', '-shm']) rmSync(`${file}${suffix}`, { force: true });
      return new SqliteIndex(file);
    }
  }

  /** Deletes the folder's index file. On Windows a just-closed file can stay locked for a moment, so removal retries. */
  async discard(folder: string): Promise<void> {
    const file = this.fileFor(folder);
    for (const suffix of ['', '-wal', '-shm']) await rm(`${file}${suffix}`, { force: true, maxRetries: 5, retryDelay: 100 });
  }

  /** The index file for a folder; the same folder spelt with different case maps to one file on Windows. */
  fileFor(folder: string): string {
    const absolute = resolve(folder);
    const key = process.platform === 'win32' ? absolute.toLowerCase() : absolute;
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 16);
    return join(this.dataDir, 'indexes', `${hash}.sqlite`);
  }
}
