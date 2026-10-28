import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileChange } from '../../src/application/ports/FileWatcher';
import { ChokidarWatcher, type ChokidarWatch } from '../../src/infrastructure/watch/ChokidarWatcher';

let root: string;
/** Inside a hidden folder on purpose, like `.atlas/uploads`: only names below the watched folder count. */
let folder: string;
let watch: ChokidarWatch | null;
const changes: FileChange[] = [];
const failures: Error[] = [];

async function start(): Promise<void> {
  watch = new ChokidarWatcher().watch(folder, (change) => changes.push(change), (error) => failures.push(error));
  await watch.ready;
}

function names(type: FileChange['type']): string[] {
  return changes.filter((change) => change.type === type).map((change) => change.absolutePath);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'atlas-watch-'));
  folder = join(root, '.atlas', 'uploads');
  mkdirSync(folder, { recursive: true });
  changes.length = 0;
  failures.length = 0;
  watch = null;
});

afterEach(async () => {
  await watch?.close();
  rmSync(root, { recursive: true, force: true });
});

describe('ChokidarWatcher', () => {
  it('reports a new file as added once its writing has settled, then changed, then removed', async () => {
    writeFileSync(join(folder, 'Existing.pdf'), 'before the watch');
    await start();

    const added = join(folder, 'BOQ.xlsx');
    writeFileSync(added, 'new workbook');
    await vi.waitFor(() => expect(names('added')).toEqual([added]), { timeout: 10_000, interval: 50 });

    writeFileSync(added, 'the workbook saved again with more rows');
    await vi.waitFor(() => expect(names('changed')).toEqual([added]), { timeout: 10_000, interval: 50 });

    unlinkSync(added);
    await vi.waitFor(() => expect(names('removed')).toEqual([added]), { timeout: 10_000, interval: 50 });
    expect(failures).toEqual([]);
  });

  it('reports files in subfolders and kinds Atlas does not read, but not hidden or lock files', async () => {
    await start();
    mkdirSync(join(folder, '.git'));
    writeFileSync(join(folder, '.git', 'index.pdf'), 'hidden folder');
    writeFileSync(join(folder, '.notes.pdf'), 'hidden file');
    writeFileSync(join(folder, '~$BOQ.xlsx'), 'lock file');
    mkdirSync(join(folder, 'Contracts'));
    const nested = join(folder, 'Contracts', 'Main.pdf');
    const letter = join(folder, 'Letter.docx');
    writeFileSync(nested, 'contract');
    writeFileSync(letter, 'word document');

    await vi.waitFor(() => expect(names('added').sort()).toEqual([nested, letter].sort()), { timeout: 10_000, interval: 50 });
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(changes.map((change) => change.absolutePath).sort()).toEqual([nested, letter].sort());
  });

  it('stops reporting once closed', async () => {
    await start();
    await watch?.close();
    writeFileSync(join(folder, 'Late.pdf'), 'after close');
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(changes).toEqual([]);
  });
});
