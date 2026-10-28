import type { FileKind } from '@atlas/shared';

const KINDS: Record<string, FileKind> = { '.pdf': 'pdf', '.xlsx': 'excel', '.xlsm': 'excel' };

/** Extensions Atlas can read, lower case with the dot. */
export const READABLE_EXTENSIONS: readonly string[] = Object.keys(KINDS);

/** Which reader handles a file, by its extension (for example '.xlsx'). Legacy '.xls' is 'other'. */
export function kindForExtension(extension: string): FileKind {
  return KINDS[extension.toLowerCase()] ?? 'other';
}

const ONLY_PDF_AND_EXCEL = 'only PDF and Excel files are.';

const SAVE_AS_XLSX: Record<string, string> = {
  '.xls': 'Old .xls format is not supported; save it as .xlsx.',
  '.xlsb': 'Binary Excel workbooks (.xlsb) are not supported; save it as .xlsx.',
  '.ods': 'OpenDocument spreadsheets (.ods) are not supported; save it as .xlsx.',
  '.csv': 'CSV files are not read; save it as .xlsx to include it.',
};

const FAMILIES: [label: string, extensions: string[]][] = [
  ['Word documents', ['.docx', '.doc', '.docm', '.rtf', '.odt']],
  ['PowerPoint files', ['.pptx', '.ppt']],
  ['Images', ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.gif', '.bmp', '.webp', '.heic']],
  ['CAD drawings', ['.dwg', '.dxf', '.rvt', '.ifc']],
  ['Text files', ['.txt', '.md']],
  ['Emails', ['.msg', '.eml']],
];

/**
 * Why Atlas does not read a file, in plain language, or null when it can read it.
 * For example "Word documents (.docx) are not read; only PDF and Excel files are."
 */
export function skipReason(extension: string): string | null {
  const ext = extension.toLowerCase();
  if (kindForExtension(ext) !== 'other') return null;
  const saveAs = SAVE_AS_XLSX[ext];
  if (saveAs) return saveAs;
  if (ext === '') return `Files without an extension are not read; ${ONLY_PDF_AND_EXCEL}`;
  if (['.zip', '.rar', '.7z'].includes(ext)) return `Archives (${ext}) are not opened; extract the files into the folder first.`;
  const family = FAMILIES.find(([, extensions]) => extensions.includes(ext));
  return family ? `${family[0]} (${ext}) are not read; ${ONLY_PDF_AND_EXCEL}` : `${ext} files are not read; ${ONLY_PDF_AND_EXCEL}`;
}
