import { crc32 } from 'node:zlib';

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const LOCAL_HEADER = 0x04034b50;
const DIRECTORY_ENTRY = 0x02014b50;
const END_OF_DIRECTORY = 0x06054b50;
const VERSION = 20;
const UTF8_NAMES = 0x0800;

/** An uncompressed (stored) zip with every entry dated `date`, so the bytes are the same on every run. */
export function storedZip(entries: readonly ZipEntry[], date: Date): Uint8Array {
  const dosDate = ((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, LOCAL_HEADER, true);
    local.setUint16(4, VERSION, true);
    local.setUint16(6, UTF8_NAMES, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, entry.data.length, true);
    local.setUint32(22, entry.data.length, true);
    local.setUint16(26, name.length, true);
    locals.push(new Uint8Array(local.buffer), name, entry.data);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, DIRECTORY_ENTRY, true);
    central.setUint16(4, VERSION, true);
    central.setUint16(6, VERSION, true);
    central.setUint16(8, UTF8_NAMES, true);
    central.setUint16(14, dosDate, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, entry.data.length, true);
    central.setUint32(24, entry.data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    directory.push(new Uint8Array(central.buffer), name);
    offset += 30 + name.length + entry.data.length;
  }
  const directorySize = directory.reduce((size, part) => size + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, END_OF_DIRECTORY, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return concat([...locals, ...directory, new Uint8Array(end.buffer)]);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
