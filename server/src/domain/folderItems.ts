/** True when `path` is `item` itself or lies inside it, as a file inside a removed subfolder does. Both are relative, with forward slashes. */
export function isWithin(path: string, item: string): boolean {
  return path === item || path.startsWith(`${item}/`);
}

/** True when `path` is, or lies inside, any of `items`. */
export function isWithinAny(path: string, items: readonly string[]): boolean {
  return items.some((item) => isWithin(path, item));
}

/**
 * A file or subfolder path as a client sent it, in the form the index stores: forward slashes, no leading "./" and
 * no trailing "/". Null when nothing is left, or when it is absolute or climbs out of the folder with "..".
 */
export function cleanItemPath(typed: string): string | null {
  const parts = typed
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .filter((part, i) => part !== '' && !(part === '.' && i === 0));
  if (parts.length === 0 || /^[A-Za-z]:/.test(typed.trim()) || typed.trim().startsWith('/')) return null;
  if (parts.some((part) => part === '..' || part === '.')) return null;
  return parts.join('/');
}
