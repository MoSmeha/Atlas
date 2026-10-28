import { day, longDate } from './lib/dates';
import { PdfWriter } from './lib/PdfWriter';
import { contract, parties, project } from './project';
import { specification, type SpecBlock, type SpecLayout } from './specification';

/**
 * Specification_Volume_2.pdf: a cover, a contents page and one drawn page per laid-out page. Throws when a page
 * overflows or a planted clause lands on another page than the layout says, so expected.json stays true.
 */
export async function writeSpecification(layout: SpecLayout): Promise<Uint8Array> {
  const issued = day(specification.issueDate);
  const pdf = await PdfWriter.create({
    title: `${project.name} - ${specification.title}`,
    subject: specification.subtitle,
    runningHeader: `${project.name}  |  ${specification.title}  |  Contract No. ${contract.number}`,
    issued,
  });

  pdf.moveTo(190);
  pdf.paragraph('SPECIFICATION', { size: 24, bold: true, align: 'center', gapAfter: 6 });
  pdf.paragraph('VOLUME 2', { size: 16, bold: true, align: 'center', gapAfter: 10 });
  pdf.paragraph(specification.subtitle, { size: 11.5, align: 'center', gapAfter: 40 });
  pdf.paragraph(project.name, { size: 16, bold: true, align: 'center', gapAfter: 4 });
  pdf.paragraph(project.location, { size: 10.5, align: 'center', gapAfter: 40 });
  pdf.labelled([
    ['Contract No.', contract.number],
    ['Employer', parties.employer.name],
    ['Prepared by', `${parties.engineer.name} (the Engineer)`],
    ['Revision', specification.revision],
    ['Date of issue', longDate(issued)],
    ['Pages', String(specification.pageCount)],
  ]);

  pdf.newPage();
  pdf.heading('Contents');
  for (const part of layout.parts) {
    pdf.subheading(part.title);
    for (const entry of part.sections) {
      pdf.paragraph(`${entry.code}  ${entry.title}, pages ${entry.firstPage} to ${entry.lastPage}`, { size: 9.5, indent: 14, gapAfter: 1.5 });
    }
    pdf.space(4);
  }

  for (const page of layout.pages) {
    pdf.newPage();
    if (pdf.pageNumber !== page.number) throw new Error(`Specification page ${page.number} was drawn as page ${pdf.pageNumber}`);
    for (const block of page.blocks) draw(pdf, block);
  }

  const written = await pdf.finish();
  if (written.pageCount !== specification.pageCount) {
    throw new Error(`The specification came out at ${written.pageCount} pages, not ${specification.pageCount}`);
  }
  for (const [key, page] of Object.entries(layout.marks)) {
    if (written.pages[key] !== page) throw new Error(`${key} landed on page ${written.pages[key]}, not ${page}`);
  }
  return written.bytes;
}

function draw(pdf: PdfWriter, block: SpecBlock): void {
  if (block.kind === 'paragraph') pdf.paragraph(block.text, { gapAfter: 5 }, block.mark ? { [block.mark.key]: block.mark.quote } : {});
  else if (block.kind === 'heading') pdf.heading(block.text);
  else pdf.subheading(block.text);
}
