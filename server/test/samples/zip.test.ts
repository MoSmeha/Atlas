import { crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { writeCoverLetter } from '../../scripts/samples/coverLetter';
import { day } from '../../scripts/samples/lib/dates';
import { storedZip } from '../../scripts/samples/lib/zip';

interface ReadEntry {
  name: string;
  data: Uint8Array;
  crcMatches: boolean;
  dosDate: number;
}

/** Reads a stored zip through its central directory, as an unzip tool does. */
function readZip(bytes: Uint8Array): ReadEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const entries: ReadEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    expect(view.getUint32(offset, true)).toBe(0x02014b50);
    const crc = view.getUint32(offset + 16, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const local = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    entries.push({ name, data, crcMatches: crc32(data) === crc, dosDate: view.getUint16(offset + 14, true) });
    offset += 46 + nameLength;
  }
  return entries;
}

describe('storedZip', () => {
  it('writes entries that read back with matching CRCs and the fixed date', () => {
    const date = day('2026-10-07');
    const bytes = storedZip([{ name: 'a.txt', data: new TextEncoder().encode('hello') }, { name: 'b/c.xml', data: new Uint8Array(0) }], date);
    const entries = readZip(bytes);
    expect(entries.map((entry) => entry.name)).toEqual(['a.txt', 'b/c.xml']);
    expect(new TextDecoder().decode(entries[0]!.data)).toBe('hello');
    expect(entries.every((entry) => entry.crcMatches)).toBe(true);
    expect(entries[0]!.dosDate).toBe(((2026 - 1980) << 9) | (10 << 5) | 7);
  });
});

describe('Cover_Letter.docx', () => {
  it('is a Word package with content types, relationships and a document part', () => {
    const entries = readZip(writeCoverLetter());
    expect(entries.map((entry) => entry.name)).toEqual(['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'word/document.xml']);
    const document = new TextDecoder().decode(entries.find((entry) => entry.name === 'word/document.xml')!.data);
    expect(document).toContain('Monthly Progress Report No. 8');
    expect(document).toContain('Fictional sample document generated for testing Atlas.');
    expect(writeCoverLetter()).toEqual(writeCoverLetter());
  });
});
