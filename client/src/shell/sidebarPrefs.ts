/** The sidebar's width bounds in px, and the width below which a drag closes it instead. */
export const sidebarBounds = { min: 240, max: 480, closeBelow: 160 } as const;

/** Where the sidebar's state is kept between visits. */
const STORAGE_KEY = 'atlas-sidebar';

export interface SidebarPrefs {
  /** Open on a wide screen. A phone always starts with it folded away. */
  open: boolean;
  /** The width it was dragged to; null keeps the default. */
  width: number | null;
}

const defaults: SidebarPrefs = { open: true, width: null };

/** The stored state, or the default for anything missing, malformed or out of bounds. */
export function parseSidebarPrefs(raw: string | null): SidebarPrefs {
  if (raw === null) return defaults;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (typeof value !== 'object' || value === null) return defaults;
  const { open, width } = value as Record<string, unknown>;
  return {
    open: typeof open === 'boolean' ? open : defaults.open,
    width:
      typeof width === 'number' && Number.isFinite(width) && width >= sidebarBounds.min && width <= sidebarBounds.max
        ? Math.round(width)
        : null,
  };
}

/** The state from the last visit. Storage can be off, as in a private window; then it starts open at the default width. */
export function readSidebarPrefs(): SidebarPrefs {
  try {
    return parseSidebarPrefs(localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaults;
  }
}

export function saveSidebarPrefs(prefs: SidebarPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Not saved: the next visit opens the sidebar at the default width.
  }
}
