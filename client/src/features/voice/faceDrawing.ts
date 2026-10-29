/** The geometry of Atlas's face, in a 120 by 120 drawing. AtlasFace draws it and moves its parts. */

export type Point = readonly [number, number];

export const LEFT_EYE: Point = [50.5, 54];
export const RIGHT_EYE: Point = [69.5, 54];
/** The head tilts around the base of the neck. */
export const NECK: Point = [60, 92];
/** The beard grows down from its top edge when the jaw opens. */
export const BEARD_TOP = 63;
/** The bare skin round the lips, inside the beard, which keeps the mouth readable. */
export const LIPS: Point = [60, 77.6];

/**
 * A path through the points where every step is a round lobe bulging outward, as curls do. The points run clockwise on
 * screen, so a clockwise arc between two of them bulges away from the shape.
 */
function lobes(points: readonly Point[], bulge = 0.62): string {
  return points
    .slice(1)
    .map(([x, y], i) => {
      const [px, py] = points[i] ?? [x, y];
      const r = (Math.hypot(x - px, y - py) * bulge).toFixed(2);
      return `A${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

/** Points on an ellipse, clockwise on screen from `fromDeg` (0 is to the right, 90 is down). */
function ellipsePoints(cx: number, cy: number, rx: number, ry: number, fromDeg: number, toDeg: number, count: number): Point[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const angle = ((fromDeg + ((toDeg - fromDeg) * i) / count) * Math.PI) / 180;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)] as const;
  });
}

/** Curls all round the back of the head; the face covers their middle. */
export const BACK_HAIR = (() => {
  const points = ellipsePoints(60, 46, 28.5, 25.5, 180, 540, 16);
  const [x, y] = points[0] ?? [0, 0];
  return `M${x.toFixed(2)} ${y.toFixed(2)} ${lobes(points, 0.6)} Z`;
})();

/** A curly fringe across the forehead. */
export const FRINGE = (() => {
  const hairline: Point[] = [
    [82.5, 47],
    [79, 42],
    [74, 38.6],
    [67.5, 37],
    [60.5, 36.6],
    [53.5, 37],
    [47, 38.6],
    [42, 42],
    [37.5, 47],
  ];
  return `M37.5 47 C37.5 33 47 25 60 25 C73 25 82.5 33 82.5 47 ${lobes(hairline)} Z`;
})();

/** A full curly beard from below the cheekbones; its top edge runs over the upper lip, where the moustache is. */
export const BEARD = (() => {
  const jaw: Point[] = [
    [81.4, 63],
    [82.6, 71],
    [81, 79.5],
    [77.5, 87.5],
    [72.5, 94.5],
    [66.5, 99.5],
    [60, 101.5],
    [53.5, 99.5],
    [47.5, 94.5],
    [42.5, 87.5],
    [39, 79.5],
    [37.4, 71],
    [38.6, 63],
  ];
  return `M38.6 63 Q42 71.5 50 72.6 Q60 70.4 70 72.6 Q78 71.5 81.4 63 ${lobes(jaw)} Z`;
})();

export const FACE = 'M38.5 52 C38.5 35 48 26.5 60 26.5 C72 26.5 81.5 35 81.5 52 L81.5 64 C81.5 79 72 89 60 89 C48 89 38.5 79 38.5 64 Z';
export const SHOULDERS = 'M10 124 C12 106 28 97 45 94 C52 98 68 98 75 94 C92 97 108 106 110 124 Z';
/** The fold of the cloak across the chest, and a fainter one beside it. */
export const FOLD = 'M22 106 C40 99 58 104 72 122';
export const SOFT_FOLD = 'M34 100.5 C46 97.5 58 100.5 66 108';
export const BROWS = ['M45.5 47.2 Q50.5 45 55 46.6', 'M65 46.6 Q69.5 45 74.5 47.2'] as const;
export const MOUSTACHE = 'M51.5 73.2 Q55.8 71.2 60 72.8 Q64.2 71.2 68.5 73.2';

/** Short "c" strokes that read as curls in the hair and the beard. */
export const CURLS = [
  'M45 31.5 a2.4 2.4 0 1 1 3.2 2',
  'M55 28.8 a2.4 2.4 0 1 1 3.2 2',
  'M65 29.2 a2.4 2.4 0 1 1 3.2 2',
  'M73 33.6 a2.4 2.4 0 1 1 3.2 2',
  'M33.5 44 a2.2 2.2 0 1 1 2.8 2.2',
  'M84 44 a2.2 2.2 0 1 0 -2.8 2.2',
  'M43.5 81 a2.4 2.4 0 1 1 3 2.2',
  'M52 89 a2.4 2.4 0 1 1 3 2.2',
  'M65 89 a2.4 2.4 0 1 1 3 2.2',
  'M73.5 81 a2.4 2.4 0 1 1 3 2.2',
  'M58.5 95.5 a2.2 2.2 0 1 1 2.8 2',
] as const;

/** The lip window's height: it opens with the mouth, so the dark of the mouth always sits on skin. */
export function lipsHeight(open: number): number {
  return 2.6 + open * 2.4;
}

/** The mouth: a closed smile when `open` is 0, opening from the middle as Atlas speaks. */
export function mouthPath(open: number, smile: number): string {
  const y = 77.2 + open * 0.6;
  const half = 4.4 - open * 0.6;
  const top = y + smile * 0.7 - open * 1.2;
  const bottom = y + 0.8 + smile * 1 + open * 4.6;
  const left = (60 - half).toFixed(2);
  const right = (60 + half).toFixed(2);
  return `M${left} ${y.toFixed(2)} Q60 ${top.toFixed(2)} ${right} ${y.toFixed(2)} Q60 ${bottom.toFixed(2)} ${left} ${y.toFixed(2)} Z`;
}

/** Where an eye sits and how open it is, as an SVG transform. */
export function eyeTransform([x, y]: Point, lookX: number, lookY: number, open: number): string {
  return `translate(${(x + lookX * 1.5).toFixed(2)} ${(y + lookY * 1.3).toFixed(2)}) scale(1 ${Math.max(0.06, open).toFixed(3)})`;
}

/** The beard stretching down from its top edge as the jaw opens. */
export function beardTransform(mouth: number): string {
  return `translate(0 ${BEARD_TOP}) scale(1 ${(1 + mouth * 0.035).toFixed(3)}) translate(0 ${-BEARD_TOP})`;
}
