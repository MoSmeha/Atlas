import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { day, longDate } from '../samples/lib/dates';
import { Random } from '../samples/lib/random';
import { imageOnlyPdf, scanToPng } from '../samples/lib/scan';
import { FOOTER_TEXT } from '../samples/project';
import { parties, project } from './project';

/** Delivery Note DN-0455 (scanned).pdf: a supplier's delivery note that exists only as a scanned image, no text layer. */
export const deliveryNote = {
  fileName: 'Delivery Note DN-0455 (scanned).pdf',
  number: 'DN-0455',
  date: '2026-09-03',
  supplier: 'GULF REBAR MILLS CO.',
  supplierAddress: 'Dammam Second Industrial City, Kingdom of Saudi Arabia (fictional)',
  deliveredTo: `${parties.contractor.name}, Warehouse W2 laydown area`,
  orderNumber: 'PO-KLP-P2-0192',
  truck: '7841 TKA',
  item: { description: 'Deformed reinforcing bars, grade B500B, 16 mm diameter, 12 m lengths', bundles: 62, tonnes: 48.2, heat: 'GRM-26-7741' },
  receivedBy: 'Ahmed Nasser, Storekeeper',
  dpi: 150,
  skew: -0.8,
  /** The fact a question can only answer by looking at the page image. */
  visionFact: '48.2 tonnes of 16 mm B500B reinforcing bars',
};

const INK = rgb(0.12, 0.13, 0.17);
const PEN = rgb(0.1, 0.18, 0.42);
const PAPER = rgb(0.962, 0.955, 0.935);
const LEFT = 56;
const RIGHT = 539;

/** Draws the note, scans it to an image and wraps the image in a new PDF, so no text survives. */
export async function buildDeliveryNote(): Promise<Uint8Array> {
  const png = scanToPng(await drawDeliveryNote(), { dpi: deliveryNote.dpi, skew: deliveryNote.skew });
  return imageOnlyPdf(png, {
    title: `${project.name} - Delivery Note ${deliveryNote.number} (scanned)`,
    subject: 'Scanned delivery note',
    issued: day(deliveryNote.date),
  });
}

/** The note as a vector page, before scanning. */
export async function drawDeliveryNote(): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const hand = await doc.embedFont(StandardFonts.Courier);
  const page = doc.addPage([595.28, 841.89]);
  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: PAPER });

  page.drawText(deliveryNote.supplier, { x: LEFT, y: 782, size: 14, font: bold, color: INK });
  page.drawText(deliveryNote.supplierAddress, { x: LEFT, y: 767, size: 8.5, font: regular, color: INK });
  page.drawText('Reinforcing steel to SASO and BS 4449', { x: LEFT, y: 756, size: 8.5, font: regular, color: INK });
  page.drawRectangle({ x: 372, y: 752, width: 167, height: 44, borderColor: INK, borderWidth: 1 });
  page.drawText('DELIVERY NOTE', { x: 386, y: 778, size: 13, font: bold, color: INK });
  page.drawText(`No. ${deliveryNote.number}`, { x: 386, y: 761, size: 11, font: bold, color: PEN });
  page.drawLine({ start: { x: LEFT, y: 742 }, end: { x: RIGHT, y: 742 }, thickness: 1, color: INK });

  const fields: [string, string][] = [
    ['Date', longDate(day(deliveryNote.date))],
    ['Customer', parties.contractor.name],
    ['Project', project.name],
    ['Delivered to', deliveryNote.deliveredTo],
    ['Order No.', deliveryNote.orderNumber],
    ['Vehicle', `Truck ${deliveryNote.truck}`],
  ];
  let y = 718;
  for (const [label, value] of fields) {
    page.drawText(`${label}:`, { x: LEFT, y, size: 10, font: bold, color: INK });
    page.drawText(value, { x: LEFT + 92, y, size: 10.5, font: hand, color: PEN });
    y -= 18;
  }

  y -= 10;
  drawItemsTable(page, regular, bold, hand, y);
  y -= 118;
  page.drawText('REMARKS', { x: LEFT, y, size: 11, font: bold, color: INK });
  const remarks = [
    'Mill certificate for heat GRM-26-7741 attached (3 pages).',
    'Bundles tagged and weighed on the mill weighbridge; site check weigh 2 bundles.',
    'Store off the ground on timber bearers; keep the tags on until fixing.',
  ];
  remarks.forEach((line, index) => page.drawText(line, { x: LEFT, y: y - 18 - index * 15, size: 10, font: regular, color: INK }));

  drawSignatures(page, regular, bold, hand);
  page.drawText(FOOTER_TEXT, { x: LEFT, y: 40, size: 8, font: italic, color: INK });
  page.drawText('Page 1 of 1', { x: RIGHT - regular.widthOfTextAtSize('Page 1 of 1', 8), y: 40, size: 8, font: regular, color: INK });
  drawSpeckles(page, new Random(455));
  return doc.save();
}

function drawItemsTable(page: PDFPage, regular: PDFFont, bold: PDFFont, hand: PDFFont, top: number): void {
  const columns = [LEFT, LEFT + 280, LEFT + 345, LEFT + 410, RIGHT];
  const headers = ['Description', 'Bundles', 'Tonnes', 'Heat No.'];
  const rowHeight = 22;
  page.drawRectangle({ x: LEFT, y: top - rowHeight, width: RIGHT - LEFT, height: rowHeight, color: rgb(0.88, 0.88, 0.86) });
  headers.forEach((header, index) => page.drawText(header, { x: (columns[index] ?? LEFT) + 6, y: top - 15, size: 9.5, font: bold, color: INK }));
  const { item } = deliveryNote;
  const lines = ['Deformed reinforcing bars, grade B500B,', '16 mm diameter, 12 m lengths'];
  const bodyTop = top - rowHeight;
  const bodyHeight = 44;
  lines.forEach((line, index) => page.drawText(line, { x: LEFT + 6, y: bodyTop - 16 - index * 14, size: 10, font: regular, color: INK }));
  page.drawText(String(item.bundles), { x: (columns[1] ?? 0) + 14, y: bodyTop - 24, size: 11.5, font: hand, color: PEN });
  page.drawText(item.tonnes.toFixed(1), { x: (columns[2] ?? 0) + 12, y: bodyTop - 24, size: 11.5, font: hand, color: PEN });
  page.drawText(item.heat, { x: (columns[3] ?? 0) + 6, y: bodyTop - 24, size: 10, font: hand, color: PEN });
  const totalTop = bodyTop - bodyHeight;
  page.drawText('TOTAL', { x: LEFT + 6, y: totalTop - 15, size: 9.5, font: bold, color: INK });
  page.drawText(String(item.bundles), { x: (columns[1] ?? 0) + 14, y: totalTop - 15, size: 11.5, font: hand, color: PEN });
  page.drawText(`${item.tonnes.toFixed(1)} t`, { x: (columns[2] ?? 0) + 12, y: totalTop - 15, size: 11.5, font: hand, color: PEN });
  const bottom = totalTop - rowHeight;
  for (const yLine of [top, top - rowHeight, totalTop, bottom]) {
    page.drawLine({ start: { x: LEFT, y: yLine }, end: { x: RIGHT, y: yLine }, thickness: 0.8, color: INK });
  }
  for (const x of columns) page.drawLine({ start: { x, y: top }, end: { x, y: bottom }, thickness: 0.8, color: INK });
}

function drawSignatures(page: PDFPage, regular: PDFFont, bold: PDFFont, hand: PDFFont): void {
  page.drawText('Dispatched by:', { x: LEFT, y: 170, size: 10, font: bold, color: INK });
  page.drawText('Mill dispatch office', { x: LEFT + 90, y: 170, size: 10, font: hand, color: PEN });
  page.drawText('Received by:', { x: LEFT, y: 128, size: 10, font: bold, color: INK });
  page.drawSvgPath('M 0 0 C 10 16, 20 -12, 32 6 S 54 14, 62 0 C 70 -8, 84 10, 100 2', {
    x: LEFT + 90,
    y: 134,
    borderColor: PEN,
    borderWidth: 1.2,
  });
  page.drawLine({ start: { x: LEFT + 84, y: 120 }, end: { x: LEFT + 240, y: 120 }, thickness: 0.6, color: INK });
  page.drawText(deliveryNote.receivedBy, { x: LEFT + 90, y: 108, size: 9, font: hand, color: PEN });
  page.drawText(`${parties.contractor.name}, ${longDate(day(deliveryNote.date))}`, { x: LEFT + 90, y: 96, size: 8.5, font: regular, color: INK });
  page.drawCircle({ x: 470, y: 128, size: 34, borderColor: PEN, borderWidth: 1.5, opacity: 0, borderOpacity: 0.7 });
  page.drawText('RECEIVED', { x: 441, y: 124, size: 10, font: bold, color: PEN, opacity: 0.7 });
  page.drawText('SITE STORE', { x: 442, y: 139, size: 7, font: regular, color: PEN, opacity: 0.7 });
}

/** Specks of dust and toner, as on a photocopied page. */
function drawSpeckles(page: PDFPage, random: Random): void {
  for (let i = 0; i < 170; i += 1) {
    const shade = 0.45 + random.next() * 0.35;
    page.drawCircle({ x: random.int(10, 585), y: random.int(10, 832), size: 0.3 + random.next() * 0.7, color: rgb(shade, shade, shade) });
  }
}
