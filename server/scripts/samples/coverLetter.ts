import { day, longDate } from './lib/dates';
import { storedZip } from './lib/zip';
import { contract, FOOTER_TEXT, parties, project } from './project';

/** Cover_Letter.docx: a small real Word document. Atlas reads only PDF and Excel files, so it is listed as skipped. */
export const coverLetter = {
  fileName: 'Cover_Letter.docx',
  date: '2026-10-07',
  reference: 'QRC-NGT-LTR-0412',
};

const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** A minimal .docx package: content types, relationships, core properties and one document part. */
export function writeCoverLetter(): Uint8Array {
  const date = day(coverLetter.date);
  const paragraphs = [
    `Ref. ${coverLetter.reference}`,
    longDate(date),
    `${parties.engineer.representative}, ${parties.engineer.name}, ${parties.engineer.address}`,
    `Subject: ${project.name}, Contract No. ${contract.number}: Monthly Progress Report No. 8`,
    'Dear Eng. Lina,',
    'Please find enclosed the Monthly Progress Report No. 8 for September 2026, with the updated programme and the site photographs.',
    'We would be grateful for your comments within 14 days.',
    'Yours sincerely,',
    parties.contractor.representative,
    parties.contractor.name,
    FOOTER_TEXT,
  ];
  const body = paragraphs.map((text) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`).join('');
  const encode = (text: string) => new TextEncoder().encode(text);
  return storedZip(
    [
      { name: '[Content_Types].xml', data: encode(CONTENT_TYPES) },
      { name: '_rels/.rels', data: encode(RELATIONSHIPS) },
      { name: 'docProps/core.xml', data: encode(coreProperties(date)) },
      { name: 'word/document.xml', data: encode(`${XML}<w:document xmlns:w="${NS}"><w:body>${body}</w:body></w:document>`) },
    ],
    date,
  );
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const CONTENT_TYPES =
  `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
  '</Types>';

const RELATIONSHIPS =
  `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
  '</Relationships>';

function coreProperties(date: Date): string {
  const stamp = date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return (
    `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${escapeXml(`${project.name} - Cover Letter`)}</dc:title>` +
    '<dc:creator>Atlas sample generator</dc:creator>' +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified>` +
    '</cp:coreProperties>'
  );
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
