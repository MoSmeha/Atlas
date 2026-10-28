import type { DocumentSummary } from '@atlas/shared';
import type { PdfPage } from '../pdf';

const contractClauses: Record<number, string[]> = {
  1: [
    'CONTRACT AGREEMENT',
    'Al Nakheel Mixed-Use Tower, Riyadh (Project code RUH-NKT)',
    '',
    'Employer: Al Nakheel Real Estate Development Co.',
    'Contractor: Rawabi Contracting Co. Ltd.',
    'Contract Price: SAR 186,450,000.00 (one hundred eighty-six million four hundred fifty',
    'thousand Saudi Riyals), inclusive of provisional sums and exclusive of VAT.',
    'Commencement Date: 1 February 2026. Time for Completion: 30 months.',
  ],
  37: [
    'Clause 14.3 Retention',
    '',
    'The Employer shall retain ten percent (10%) of each interim payment until the',
    'total retention reaches five percent (5%) of the Contract Price.',
    '',
    'One half of the retention money shall be released on the issue of the Taking-Over',
    'Certificate, and the balance at the end of the Defects Notification Period.',
  ],
  41: [
    'Clause 8.7 Delay Damages',
    '',
    'If the Contractor fails to complete the Works within the Time for Completion, the',
    'Contractor shall pay delay damages of SAR 95,000 for every day of delay.',
    'The total delay damages shall not exceed ten percent (10%) of the Contract Price.',
  ],
};

const specClauses: Record<number, string[]> = {
  118: [
    '3.4 Concrete cover to reinforcement',
    '',
    'Nominal cover: 75 mm to foundations cast against ground, 50 mm to basement walls,',
    '40 mm to columns and beams, 30 mm to suspended slabs.',
    'Cover spacers shall be concrete or plastic, never timber or steel.',
  ],
};

const filler = [
  'This page is canned text from the Atlas mock server. It stands in for the real document',
  'so the viewer can render pages, select text and draw highlights.',
];

/** Page text for a mock PDF: real clauses where answers cite them, filler elsewhere. */
export function pdfPages(document: DocumentSummary): PdfPage[] {
  const count = document.pageCount ?? 1;
  return Array.from({ length: count }, (_, i) => {
    const number = i + 1;
    return {
      heading: headingFor(document, number),
      lines: linesFor(document, number),
      footer: `${document.path}  -  page ${number} of ${count}`,
    };
  });
}

function headingFor(document: DocumentSummary, page: number): string {
  if (document.path.includes('Contract_Agreement')) return `RUH-NKT Contract Agreement - page ${page}`;
  if (document.path.includes('Technical_Specification')) return `Division 03 Concrete - Section 03 30 00, page ${page}`;
  if (document.path.includes('BOQ_Bill3_MEP')) return `Bill 3 - Mechanical, Electrical and Plumbing, page ${page}`;
  if (document.language === 'ar') return `Site meeting No. 12 minutes, page ${page}`;
  return `${document.name}, page ${page}`;
}

function linesFor(document: DocumentSummary, page: number): string[] {
  if (document.path.includes('Contract_Agreement')) return contractClauses[page] ?? genericClause('Clause', page);
  if (document.path.includes('Technical_Specification')) return specClauses[page] ?? genericClause('Article', page);
  if (document.path.includes('BOQ_Bill3_MEP') && page >= 2 && page <= 5) return mepLines(page);
  if (document.language === 'ar') {
    return ['The original page is in Arabic. The mock PDF uses a font without Arabic letters,', 'so this English note stands in for the text.'];
  }
  if (document.status === 'scanned') return ['A real scanned page is an image with no text layer.', ...filler];
  return filler;
}

function genericClause(label: string, page: number): string[] {
  return [`${label} ${Math.ceil(page / 3)}.${(page % 3) + 1}`, '', ...filler];
}

const mepItems = [
  ['Chilled water pipework, DN150', 'm'],
  ['Fan coil unit, four-pipe', 'nr'],
  ['LV cable, 4 core 95 mm2', 'm'],
  ['Cable tray, 300 mm', 'm'],
  ['Sprinkler pipework, DN50', 'm'],
  ['Addressable smoke detector', 'nr'],
  ['Domestic water pipework, PPR 40 mm', 'm'],
  ['Drainage pipework, uPVC 110 mm', 'm'],
] as const;

function mepLines(page: number): string[] {
  const lines = ['Item     Description                              Unit     Qty      Rate      Amount (SAR)'];
  for (let i = 0; i < 16; i++) {
    const n = (page - 2) * 16 + i + 1;
    const [description, unit] = mepItems[n % mepItems.length] ?? mepItems[0];
    const qty = 40 + ((n * 37) % 900);
    const rate = 120 + ((n * 53) % 1_400);
    const amount = (qty * rate).toLocaleString('en-US');
    lines.push(`3.${String(n).padStart(2, '0')}     ${description}     ${unit}     ${qty}     ${rate}.00     ${amount}.00`);
  }
  return lines;
}
