import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ReadOutcome } from '../../src/application/ports/DocumentReader';
import { scanFile, scanFolder } from '../../src/application/indexing/scanFolder';
import { ExcelJsReader } from '../../src/infrastructure/readers/ExcelJsReader';
import { MupdfReader } from '../../src/infrastructure/readers/MupdfReader';
import { NodeFileSystem } from '../../src/infrastructure/fs/NodeFileSystem';
import { buildExpected, type Expected } from '../../scripts/samples/expected';
import { EMPTY_FOLDER } from '../../scripts/samples/expectedEdge';
import { SAMPLE_FOLDER } from '../../scripts/samples/project';
import { buildSampleSet } from '../../scripts/samples/sampleSet';

interface FileResult {
  status: string;
  pages: number | null;
  sheets: string[] | null;
  text: string;
}

const root = fileURLToPath(new URL('../../../', import.meta.url));
const fs = new NodeFileSystem();
const options = { maxFileBytes: 50 * 1024 * 1024 };
const readers = [new MupdfReader(), new ExcelJsReader()];
let expected: Expected;
const results = new Map<string, FileResult>();

/** Opens every committed sample file the way Atlas does: scan first, then the reader for its extension. */
beforeAll(async () => {
  expected = buildExpected(await buildSampleSet());
  for (const entry of await fs.listFiles(`${root}${SAMPLE_FOLDER}`)) {
    const scanned = scanFile(entry, options);
    const reader = readers.find((candidate) => candidate.extensions.includes(entry.extension));
    if (scanned.status !== 'pending' || !reader) {
      results.set(entry.name, { status: scanned.status, pages: null, sheets: null, text: '' });
      continue;
    }
    results.set(entry.name, summarise(await reader.read(entry.absolutePath)));
  }
}, 120_000);

function summarise(outcome: ReadOutcome): FileResult {
  if (outcome.status !== 'ok' && outcome.status !== 'scanned') return { status: outcome.status, pages: null, sheets: null, text: '' };
  const document = outcome.document;
  if (document.kind === 'pdf') {
    return { status: outcome.status, pages: document.pages.length, sheets: null, text: document.pages.map((page) => page.text).join('\n') };
  }
  const text = document.sheets.flatMap((sheet) => sheet.rows.flat().map((cell) => String(cell ?? ''))).join(' ');
  return { status: outcome.status, pages: null, sheets: document.sheets.map((sheet) => sheet.name), text };
}

describe('the committed sample folder', () => {
  it('holds exactly the files expected.json describes', () => {
    expect([...results.keys()].sort()).toEqual(Object.keys(expected.filesStatus).sort());
    expect(results.size).toBe(16);
  });

  it('opens or fails each file exactly as expected.json says', () => {
    for (const [name, want] of Object.entries(expected.filesStatus)) {
      const got = results.get(name)!;
      expect({ name, status: got.status }).toEqual({ name, status: want.status });
      if ('pages' in want) expect({ name, pages: got.pages }).toEqual({ name, pages: want.pages });
      if (want.status === 'ok' && 'sheets' in want) expect({ name, sheets: got.sheets }).toEqual({ name, sheets: want.sheets });
    }
  });

  it('keeps the Arabic-only and vision-only facts out of every other document', () => {
    const others = [...results.entries()].filter(([name]) => name !== expected.meetingMinutes.file);
    for (const [, result] of others) {
      expect(result.text).not.toContain('VO-014');
      expect(result.text).not.toContain(expected.meetingMinutes.facadeStone.stone);
      expect(result.text.toLowerCase()).not.toContain('limestone');
      expect(result.text.toLowerCase()).not.toContain('water main');
    }
    expect(results.get(expected.siteSurvey.file)!.text.trim()).toBe('');
  });

  it('finds no documents in the empty folder, whose only file is a hidden .gitkeep', async () => {
    const { files } = await scanFolder(fs, `${root}${EMPTY_FOLDER}`, options);
    expect(files).toEqual([]);
    expect(expected.emptyFolder.documents).toBe(0);
  });
});
