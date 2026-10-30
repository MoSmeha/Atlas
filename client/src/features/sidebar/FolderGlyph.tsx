import classes from './FolderTree.module.css';

/** The back panel with its tab, the same closed or open. */
const BACK = 'M2.5 5a1.5 1.5 0 0 1 1.5-1.5h3.38a1.5 1.5 0 0 1 1.06.44L9.9 5.4H16a1.5 1.5 0 0 1 1.5 1.5V15a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 15z';
/** Closed, the front panel covers the back below the tab. */
const FRONT_CLOSED = 'M2.5 8.4a1.2 1.2 0 0 1 1.2-1.2h12.6a1.2 1.2 0 0 1 1.2 1.2V15a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 15z';
/** Open, the front panel drops and leans forward, so the back shows above it. */
const FRONT_OPEN = 'M3.4 16.5a1 1 0 0 1-.97-1.24l1.36-5.4a1 1 0 0 1 .97-.76h13.3a.8.8 0 0 1 .78 1l-1.48 5.64a1 1 0 0 1-.97.76z';

/**
 * A manila folder, as File Explorer draws one: a deeper back panel with its tab and a lighter front,
 * with a thin edge so it holds its shape on the light chrome. Decorative; the row names the folder.
 */
export function FolderGlyph({ open, size = 18 }: { open: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={classes.folderGlyph} aria-hidden focusable="false">
      <path className={classes.folderBack} d={BACK} />
      <path className={classes.folderFront} d={open ? FRONT_OPEN : FRONT_CLOSED} />
    </svg>
  );
}
