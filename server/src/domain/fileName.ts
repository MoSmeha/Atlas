const MAX_SLUG_LENGTH = 60;

/**
 * Lower-case ASCII words joined by dashes, safe in any file system and URL.
 * Falls back when nothing usable is left, for example for an Arabic title.
 */
export function fileSlug(text: string, fallback: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug === '') return fallback;
  if (slug.length <= MAX_SLUG_LENGTH) return slug;
  const cut = slug.slice(0, MAX_SLUG_LENGTH);
  const lastDash = cut.lastIndexOf('-');
  return lastDash > MAX_SLUG_LENGTH / 2 ? cut.slice(0, lastDash) : cut.replace(/-+$/, '');
}

const MAX_STEM_LENGTH = 120;
/** Characters Windows or the shell refuse in a file name, and control characters. */
const UNSAFE_CHARS = /[<>:"/\\|?*\u0000-\u001f\u007f]/g;
/** Device names Windows reserves, whatever the extension. */
const RESERVED_NAMES = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
const EXTENSION = /\.[A-Za-z0-9]{1,10}$/;

/**
 * A file name from a browser upload that is safe to write in one folder: no path, no characters Windows refuses,
 * no leading dot or "~$" (which would hide the file from a scan), and not a reserved device name. Arabic and other
 * letters are kept, as is the extension. Falls back when nothing usable is left of the name itself.
 */
export function safeFileName(name: string, fallback = 'upload'): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const cleaned = base.normalize('NFC').replace(UNSAFE_CHARS, ' ').replace(/\s+/g, ' ').trim();
  const extension = EXTENSION.exec(cleaned)?.[0] ?? '';
  let stem = cleaned
    .slice(0, cleaned.length - extension.length)
    .replace(/^[\s.~$]+/, '')
    .replace(/[\s.]+$/, '');
  stem = Array.from(stem).slice(0, MAX_STEM_LENGTH).join('').trimEnd();
  if (stem === '') stem = fallback;
  if (RESERVED_NAMES.test(stem.split('.')[0] ?? '')) stem = `_${stem}`;
  return `${stem}${extension}`;
}

/** Local date and time as yyyymmdd-hhmmss, so exported files sort by when they were made. */
export function fileTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${day}-${time}`;
}
