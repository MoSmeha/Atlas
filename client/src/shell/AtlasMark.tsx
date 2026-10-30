import { useId } from 'react';
import classes from './AtlasMark.module.css';
import {
  BACK_HAIR,
  BEARD,
  BROWS,
  FACE,
  FRINGE,
  LEFT_EYE,
  LIPS,
  MOUSTACHE,
  RIGHT_EYE,
  eyeTransform,
  lipsHeight,
  mouthPath,
} from '../features/voice/faceDrawing';

const bar = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}Z`;

// Each file is a 56 by 76 page in its own box, placed by its centre and turned, in a 120 by 120 drawing.
const SHEET_PAGE = 'M3 0H53Q56 0 56 3V73Q56 76 53 76H3Q0 76 0 73V3Q0 0 3 0Z';
/** The spreadsheet's rows and columns, cut out of it. */
const SHEET_GRID = [
  bar(0, 15, 56, 3.5),
  bar(0, 30, 56, 3.5),
  bar(0, 45, 56, 3.5),
  bar(0, 60, 56, 3.5),
  bar(18, 0, 3.5, 76),
  bar(37, 0, 3.5, 76),
].join('');
/** A PDF page with its top corner folded over, and its lines of text cut out. */
const PDF_PAGE = 'M3 0H40L56 16V73Q56 76 53 76H3Q0 76 0 73V3Q0 0 3 0Z';
const PDF_FOLD = 'M41.5 1.5V14.5H54.5Z';
const PDF_LINES = [bar(8, 26, 40, 4), bar(8, 36, 40, 4), bar(8, 46, 40, 4), bar(8, 56, 40, 4), bar(8, 66, 26, 4)].join('');
/** The spreadsheet leans left behind; the PDF leans right in front of it, its folded corner on the outside. */
const SHEET_AT = 'translate(36 64) rotate(-13) translate(-28 -38)';
const PDF_AT = 'translate(84 64) rotate(13) translate(-28 -38)';
/** The call face's head at 92 %, centred, its curls above the files. */
const HEAD = 'translate(4.8 -11.64) scale(0.92)';
const HEAD_OUTLINE = [BACK_HAIR, FACE, FRINGE, BEARD];

/**
 * Atlas's mark: a spreadsheet and a PDF fanned behind Atlas's face, the files it reads. The files take the current
 * colour and the PDF's fold the fold's shade; gaps keep the files apart and clear of the head. The face is the call
 * face's head, marble in both schemes as in a call, drawn as the small call face draws it (no curls, heavier lines,
 * larger eyes) so it reads at 20 px. Each mask sits on an untransformed group, so its shapes are in the drawing's own
 * coordinates.
 */
export function AtlasMark() {
  const id = useId();
  const headGap = (
    <g transform={HEAD} className={classes.headGap}>
      {HEAD_OUTLINE.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
  return (
    <svg width={20} height={20} viewBox="0 0 120 120" aria-hidden focusable="false">
      <defs>
        <mask id={`${id}sheet`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <rect width="120" height="120" fill="#fff" />
          <path transform={SHEET_AT} d={SHEET_GRID} fill="#000" />
          <path transform={PDF_AT} d={PDF_PAGE} className={classes.fileGap} />
          {headGap}
        </mask>
        <mask id={`${id}pdf`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <rect width="120" height="120" fill="#fff" />
          <path transform={PDF_AT} d={PDF_LINES + PDF_FOLD} fill="#000" />
          {headGap}
        </mask>
      </defs>
      <g mask={`url(#${id}sheet)`}>
        <path transform={SHEET_AT} d={SHEET_PAGE} fill="currentColor" />
      </g>
      <g mask={`url(#${id}pdf)`}>
        <path transform={PDF_AT} d={PDF_PAGE} fill="currentColor" />
      </g>
      <path transform={PDF_AT} d={PDF_FOLD} fill="currentColor" opacity={0.42} />
      <g transform={HEAD}>
        <path className={classes.hair} d={BACK_HAIR} />
        <path className={classes.skin} d={FACE} />
        <path className={classes.hair} d={FRINGE} />
        <g transform="translate(0 -0.48)">
          {BROWS.map((brow) => (
            <path key={brow} className={classes.line} d={brow} />
          ))}
        </g>
        {[LEFT_EYE, RIGHT_EYE].map((eye) => (
          <ellipse key={eye[0]} className={classes.eye} transform={eyeTransform(eye, 0, 0, 1)} rx="3.6" ry="4.3" />
        ))}
        <path className={classes.hair} d={BEARD} />
        <ellipse className={classes.lips} cx={LIPS[0]} cy={LIPS[1]} rx="6.6" ry={lipsHeight(0)} />
        <path className={classes.thin} d={MOUSTACHE} />
        <path className={classes.eye} d={mouthPath(0, 0.35)} />
      </g>
    </svg>
  );
}
