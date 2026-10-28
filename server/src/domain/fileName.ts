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

/** Local date and time as yyyymmdd-hhmmss, so exported files sort by when they were made. */
export function fileTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${day}-${time}`;
}
