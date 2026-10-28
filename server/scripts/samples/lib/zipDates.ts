const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;

/**
 * Sets every entry's modified date in a zip (an .xlsx) to one fixed day, so regenerating a workbook
 * gives the same bytes. JSZip, used by exceljs, otherwise stamps each entry with the current time.
 */
export function setZipDates(bytes: Uint8Array, date: Date): Uint8Array {
  const out = bytes.slice();
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const dosDate = ((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  const end = findEndOfDirectory(view);
  const entries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  for (let i = 0; i < entries; i++) {
    if (view.getUint32(offset, true) !== DIRECTORY_ENTRY) throw new Error('Unexpected zip directory layout');
    view.setUint16(offset + 12, 0, true);
    view.setUint16(offset + 14, dosDate, true);
    const local = view.getUint32(offset + 42, true);
    if (view.getUint32(local, true) !== LOCAL_HEADER) throw new Error('Unexpected zip entry layout');
    view.setUint16(local + 10, 0, true);
    view.setUint16(local + 12, dosDate, true);
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  return out;
}

function findEndOfDirectory(view: DataView): number {
  for (let offset = view.byteLength - 22; offset >= 0; offset--) {
    if (view.getUint32(offset, true) === END_OF_DIRECTORY) return offset;
  }
  throw new Error('Not a zip file');
}
