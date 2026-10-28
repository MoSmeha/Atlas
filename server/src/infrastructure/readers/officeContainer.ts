import type { ReadOutcome } from '../../application/ports/DocumentReader';

/** The first bytes of the older Office container (OLE compound file); .xlsx files are zip files instead. */
const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
/** Excel stores a password-protected workbook in that container, as a stream with this name. */
const ENCRYPTED_PACKAGE = Buffer.from('EncryptedPackage', 'utf16le');

/**
 * The status for an Excel file kept in the older Office container: password-protected, or an old .xls workbook
 * under an .xlsx name. Null for any other file, which is then opened as a zip.
 */
export function officeContainerOutcome(bytes: Buffer): ReadOutcome | null {
  if (!bytes.subarray(0, OLE_SIGNATURE.length).equals(OLE_SIGNATURE)) return null;
  if (bytes.includes(ENCRYPTED_PACKAGE)) return { status: 'encrypted', detail: 'The workbook is password-protected.' };
  return {
    status: 'corrupt',
    detail: 'The file is in the old Excel 97-2003 format despite its name; open it in Excel and save it as .xlsx.',
  };
}
