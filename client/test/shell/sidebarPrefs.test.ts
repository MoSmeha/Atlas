import { describe, expect, it } from 'vitest';
import { parseSidebarPrefs, sidebarBounds } from '../../src/shell/sidebarPrefs';

describe('parseSidebarPrefs', () => {
  it('opens at the default width on a first visit', () => {
    expect(parseSidebarPrefs(null)).toEqual({ open: true, width: null });
  });

  it('keeps a closed sidebar closed and a dragged width, rounded to a whole pixel', () => {
    expect(parseSidebarPrefs(JSON.stringify({ open: false, width: 351.6 }))).toEqual({ open: false, width: 352 });
  });

  it('drops a width outside the bounds, so a stale value never opens it too narrow or too wide', () => {
    expect(parseSidebarPrefs(JSON.stringify({ open: true, width: sidebarBounds.min - 1 })).width).toBeNull();
    expect(parseSidebarPrefs(JSON.stringify({ open: true, width: sidebarBounds.max + 1 })).width).toBeNull();
    expect(parseSidebarPrefs(JSON.stringify({ open: true, width: '320' })).width).toBeNull();
  });

  it('falls back to the default for anything that is not its own record', () => {
    expect(parseSidebarPrefs('not json')).toEqual({ open: true, width: null });
    expect(parseSidebarPrefs('null')).toEqual({ open: true, width: null });
    expect(parseSidebarPrefs(JSON.stringify({ open: 'yes' }))).toEqual({ open: true, width: null });
  });
});
