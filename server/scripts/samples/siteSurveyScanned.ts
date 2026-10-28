import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { day, longDate } from './lib/dates';
import { Random } from './lib/random';
import { imageOnlyPdf, scanToPng } from './lib/scan';
import { FOOTER_TEXT, parties, project } from './project';

export interface SurveyObservation {
  key: string;
  text: string;
}

/** Site_Survey_Scanned.pdf: a one-page survey note that exists only as a scanned image, with no text layer. */
export const siteSurvey = {
  fileName: 'Site_Survey_Scanned.pdf',
  reference: 'SS-03',
  surveyDate: '2026-02-18',
  firm: 'AL RASD LAND SURVEYING OFFICE',
  surveyedBy: 'Eng. Hamad Al-Subaie',
  dpi: 150,
  skew: 0.6,
  /** The fact a question can only answer by looking at the page image. */
  visionFact: 'Existing water main at 2.4 m depth along the northern boundary',
  observations: [
    {
      key: 'waterMain',
      text: 'Existing water main at 2.4 m depth along the northern boundary. 600 mm ductile iron pipe, located by trial pits TP-1 and TP-2. Keep shoring and ground anchors at least 3 m clear of it.',
    },
    {
      key: 'benchmark',
      text: 'Temporary benchmark TBM-02 set on the north-east boundary wall: level 612.450 m above mean sea level.',
    },
    {
      key: 'overheadLine',
      text: 'Overhead 13.8 kV power line along the eastern boundary, 9.5 m above ground. To be diverted before piling starts.',
    },
    { key: 'palms', text: 'Two existing date palms near the south-west corner, to be relocated by the Employer.' },
    { key: 'groundFall', text: 'Ground level falls about 1.2 m from south to north across the plot.' },
  ] satisfies SurveyObservation[],
};

const INK = rgb(0.13, 0.14, 0.18);
const PEN = rgb(0.12, 0.2, 0.45);
const PAPER = rgb(0.965, 0.958, 0.94);
const LEFT = 56;
const RIGHT = 539;

/** Draws the note, scans it to an image and wraps the image in a new PDF, so no text survives. */
export async function buildSiteSurveyScanned(): Promise<Uint8Array> {
  const issued = day(siteSurvey.surveyDate);
  const png = scanToPng(await drawSurveyNote(), { dpi: siteSurvey.dpi, skew: siteSurvey.skew });
  return imageOnlyPdf(png, {
    title: `${project.name} - Site Survey Note ${siteSurvey.reference} (scanned)`,
    subject: 'Scanned site survey note',
    issued,
  });
}

/** The survey note as a vector page, before scanning. */
export async function drawSurveyNote(): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const hand = await doc.embedFont(StandardFonts.Courier);
  const page = doc.addPage([595.28, 841.89]);
  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: PAPER });

  page.drawText(siteSurvey.firm, { x: LEFT, y: 780, size: 13, font: bold, color: INK });
  page.drawText('Licensed land surveyors, Riyadh (fictional)', { x: LEFT, y: 766, size: 8.5, font: regular, color: INK });
  page.drawRectangle({ x: 372, y: 756, width: 167, height: 40, borderColor: INK, borderWidth: 1 });
  page.drawText('SITE SURVEY NOTE', { x: 384, y: 778, size: 13, font: bold, color: INK });
  page.drawText(`Ref. ${siteSurvey.reference}`, { x: 384, y: 763, size: 10, font: regular, color: INK });
  page.drawLine({ start: { x: LEFT, y: 744 }, end: { x: RIGHT, y: 744 }, thickness: 1, color: INK });

  const fields: [string, string][] = [
    ['Project', project.name],
    ['Location', 'Plot 7, Al Malqa District, Riyadh'],
    ['Prepared for', `${parties.engineer.name} (the Engineer)`],
    ['Date of survey', longDate(day(siteSurvey.surveyDate))],
    ['Surveyed by', siteSurvey.surveyedBy],
  ];
  let y = 722;
  for (const [label, value] of fields) {
    page.drawText(`${label}:`, { x: LEFT, y, size: 10, font: bold, color: INK });
    page.drawText(value, { x: LEFT + 92, y, size: 10.5, font: hand, color: PEN });
    y -= 17;
  }

  y -= 10;
  page.drawText('OBSERVATIONS', { x: LEFT, y, size: 11, font: bold, color: INK });
  y -= 18;
  siteSurvey.observations.forEach((observation, index) => {
    page.drawText(`${index + 1}.`, { x: LEFT, y, size: 10.5, font: bold, color: INK });
    for (const line of wrapLines(observation.text, regular, 10.5, RIGHT - LEFT - 20)) {
      page.drawText(line, { x: LEFT + 20, y, size: 10.5, font: regular, color: INK });
      y -= 14.5;
    }
    y -= 6;
  });

  const sketchBottom = drawSketch(page, regular, bold, y - 14);
  page.drawText('REMARKS', { x: LEFT, y: sketchBottom - 28, size: 11, font: bold, color: INK });
  const remarks = ['Confirm the water main position with the water authority', 'records before any excavation near the north side.'];
  remarks.forEach((line, index) => {
    page.drawText(line, { x: LEFT, y: sketchBottom - 46 - index * 15, size: 10.5, font: hand, color: PEN });
  });
  drawSignature(page, regular, bold, hand);
  page.drawText(FOOTER_TEXT, { x: LEFT, y: 40, size: 8, font: italic, color: INK });
  page.drawText('Page 1 of 1', { x: RIGHT - regular.widthOfTextAtSize('Page 1 of 1', 8), y: 40, size: 8, font: regular, color: INK });
  drawSpeckles(page, new Random(31));
  return doc.save();
}

/** The plot sketch below `top`; returns the bottom of its frame. */
function drawSketch(page: PDFPage, regular: PDFFont, bold: PDFFont, top: number): number {
  const height = 210;
  const bottom = top - height;
  page.drawText('SKETCH (NOT TO SCALE)', { x: LEFT, y: top + 4, size: 9, font: bold, color: INK });
  page.drawRectangle({ x: LEFT, y: bottom, width: RIGHT - LEFT, height, borderColor: INK, borderWidth: 0.8 });
  const plot = { x: 150, y: bottom + 40, width: 300, height: 120 };
  page.drawRectangle({ ...plot, borderColor: INK, borderWidth: 1.6 });
  page.drawText('PLOT 7', { x: plot.x + 128, y: plot.y + 56, size: 11, font: bold, color: INK });
  page.drawText('NORTHERN BOUNDARY', { x: plot.x + 98, y: plot.y + plot.height + 6, size: 8, font: regular, color: INK });
  page.drawLine({
    start: { x: plot.x - 40, y: plot.y + plot.height + 26 },
    end: { x: plot.x + plot.width + 40, y: plot.y + plot.height + 26 },
    thickness: 1.4,
    color: PEN,
    dashArray: [7, 4],
  });
  page.drawText('EXISTING WATER MAIN, 600 mm, 2.4 m DEEP', { x: plot.x + 50, y: plot.y + plot.height + 31, size: 8, font: bold, color: PEN });
  page.drawLine({
    start: { x: plot.x + plot.width + 18, y: plot.y - 10 },
    end: { x: plot.x + plot.width + 18, y: plot.y + plot.height + 10 },
    thickness: 0.9,
    color: INK,
    dashArray: [10, 3, 2, 3],
  });
  page.drawText('13.8 kV OHL', { x: plot.x + plot.width + 24, y: plot.y + 52, size: 7.5, font: regular, color: INK });
  const tbm = { x: plot.x + plot.width - 6, y: plot.y + plot.height - 14 };
  page.drawSvgPath('M 0 0 L 8 0 L 4 -8 Z', { x: tbm.x, y: tbm.y + 8, color: INK });
  page.drawText('TBM-02', { x: tbm.x - 34, y: tbm.y - 2, size: 7.5, font: regular, color: INK });
  for (const dx of [16, 34]) page.drawCircle({ x: plot.x + dx, y: plot.y + 16, size: 6, borderColor: INK, borderWidth: 0.8 });
  page.drawText('PALMS', { x: plot.x + 46, y: plot.y + 13, size: 7.5, font: regular, color: INK });
  const arrow = { x: LEFT + 34, y: bottom + 150 };
  page.drawLine({ start: { x: arrow.x, y: arrow.y - 30 }, end: { x: arrow.x, y: arrow.y + 8 }, thickness: 1.2, color: INK });
  page.drawSvgPath('M 0 0 L 6 12 L -6 12 Z', { x: arrow.x, y: arrow.y + 20, color: INK });
  page.drawText('N', { x: arrow.x - 4, y: arrow.y + 24, size: 11, font: bold, color: INK });
  page.drawText('Fall approx. 1.2 m to north', { x: plot.x + 80, y: bottom + 18, size: 7.5, font: regular, color: INK });
  return bottom;
}

function drawSignature(page: PDFPage, regular: PDFFont, bold: PDFFont, hand: PDFFont): void {
  page.drawText('Surveyed by:', { x: LEFT, y: 112, size: 10, font: bold, color: INK });
  page.drawSvgPath('M 0 0 C 12 18, 22 -14, 34 4 S 58 12, 66 -2 C 74 -10, 86 10, 104 2', {
    x: LEFT + 82,
    y: 116,
    borderColor: PEN,
    borderWidth: 1.2,
  });
  page.drawLine({ start: { x: LEFT + 76, y: 104 }, end: { x: LEFT + 230, y: 104 }, thickness: 0.6, color: INK });
  page.drawText(siteSurvey.surveyedBy, { x: LEFT + 82, y: 92, size: 9, font: hand, color: PEN });
  page.drawCircle({ x: 470, y: 108, size: 34, borderColor: PEN, borderWidth: 1.5, opacity: 0, borderOpacity: 0.7 });
  page.drawText('CHECKED', { x: 446, y: 104, size: 10, font: bold, color: PEN, opacity: 0.7 });
  page.drawText('AL RASD', { x: 451, y: 118, size: 7, font: regular, color: PEN, opacity: 0.7 });
}

/** Specks of dust and toner, as on a photocopied page. */
function drawSpeckles(page: PDFPage, random: Random): void {
  for (let i = 0; i < 160; i += 1) {
    const shade = 0.45 + random.next() * 0.35;
    page.drawCircle({
      x: random.int(10, 585),
      y: random.int(10, 832),
      size: 0.3 + random.next() * 0.7,
      color: rgb(shade, shade, shade),
    });
  }
}

function wrapLines(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (current !== '' && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  lines.push(current);
  return lines;
}
