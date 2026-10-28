import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeFileSystem } from '../../src/infrastructure/fs/NodeFileSystem';

let root: string;
const fs = new NodeFileSystem();

function put(relativePath: string, content = 'data'): string {
  const path = join(root, ...relativePath.split('/'));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return path;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'atlas-fs-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('NodeFileSystem.listFiles', () => {
  it('lists nested files with forward-slash relative paths, sorted', async () => {
    put('Contracts/2024/Annex B.pdf');
    put('Contracts/Main.pdf');
    put('BOQ.xlsx');
    const files = await fs.listFiles(root);
    expect(files.map((file) => file.relativePath)).toEqual(['BOQ.xlsx', 'Contracts/2024/Annex B.pdf', 'Contracts/Main.pdf']);
    expect(files[1]?.absolutePath).toBe(join(root, 'Contracts', '2024', 'Annex B.pdf'));
    expect(files[1]?.name).toBe('Annex B.pdf');
  });

  it('skips hidden files and folders and Office lock files', async () => {
    put('Main.pdf');
    put('.hidden.pdf');
    put('.git/objects/pack.pdf');
    put('~$BOQ.xlsx');
    put('Sub/.DS_Store');
    expect((await fs.listFiles(root)).map((file) => file.relativePath)).toEqual(['Main.pdf']);
  });

  it('reports a lower-case extension, the size and the modified time', async () => {
    const path = put('Schedule.XLSX', '12345');
    put('README');
    const [readme, schedule] = await fs.listFiles(root);
    expect(schedule).toMatchObject({ name: 'Schedule.XLSX', extension: '.xlsx', size: 5, mtimeMs: statSync(path).mtimeMs });
    expect(readme?.extension).toBe('');
  });

  it('keeps Arabic file names as they are', async () => {
    put('العقود/عقد المشروع.pdf');
    const [file] = await fs.listFiles(root);
    expect(file?.relativePath).toBe('العقود/عقد المشروع.pdf');
    expect(file?.extension).toBe('.pdf');
  });

  it('returns nothing for an empty folder', async () => {
    mkdirSync(join(root, 'empty'));
    expect(await fs.listFiles(join(root, 'empty'))).toEqual([]);
  });
});

describe('NodeFileSystem.stat and isDirectory', () => {
  it('describes one file relative to the root', async () => {
    const path = put('Bills/Bill 3.pdf', 'pdf');
    expect(await fs.stat(root, path)).toMatchObject({ relativePath: 'Bills/Bill 3.pdf', extension: '.pdf', size: 3 });
  });

  it('returns null for a missing path or a folder', async () => {
    put('Bills/Bill 3.pdf');
    expect(await fs.stat(root, join(root, 'missing.pdf'))).toBeNull();
    expect(await fs.stat(root, join(root, 'missing', 'deeper.pdf'))).toBeNull();
    expect(await fs.stat(root, join(root, 'Bills'))).toBeNull();
  });

  it('tells folders from files and missing paths', async () => {
    const file = put('a.pdf');
    expect(await fs.isDirectory(root)).toBe(true);
    expect(await fs.isDirectory(file)).toBe(false);
    expect(await fs.isDirectory(join(root, 'missing'))).toBe(false);
  });
});

describe('NodeFileSystem writing', () => {
  it('creates parent folders when writing and reads the bytes back', async () => {
    const path = join(root, 'exports', 'nested', 'result.csv');
    await fs.writeFile(path, 'code,amount\nA1,100\n');
    expect(readFileSync(path, 'utf8')).toBe('code,amount\nA1,100\n');
    await fs.writeFile(path, new Uint8Array([1, 2, 3]));
    expect([...(await fs.readFile(path))]).toEqual([1, 2, 3]);
  });

  it('creates nested folders and accepts one that already exists', async () => {
    const dir = join(root, 'a', 'b', 'c');
    await fs.ensureDir(dir);
    await fs.ensureDir(dir);
    expect(await fs.isDirectory(dir)).toBe(true);
  });
});
