import { describe, expect, it, vi } from 'vitest';
import type { DocumentRecord } from '../../../src/application/ports/DocumentIndex';
import { readPages, type ReadPagesOutput } from '../../../src/application/tools/readPages';
import { tools } from '../../../src/application/tools/registry';
import { ToolError } from '../../../src/application/tools/Tool';
import { FakeIndex } from '../../fakes/FakeIndex';
import { boqTable, excelRecord, pdfRecord } from '../../fakes/records';
import { makeToolContext } from '../../fakes/toolContext';

const contract = pdfRecord('contracts/Main Contract.pdf', [
  'Clause 1\nDefinitions',
  'Clause 14.2  Retention\n\nFive percent of each payment is held.  ',
  'Clause 20\tDisputes',
]);

/** Twelve pages: "page 1 text" to "page 12 text". */
const spec = pdfRecord('specs/Spec.pdf', Array.from({ length: 12 }, (_, i) => `page ${i + 1} text`));

function indexWith(...records: DocumentRecord[]): FakeIndex {
  const index = new FakeIndex();
  for (const record of records) index.save(record);
  return index;
}

/** A PDF whose listed pages are scanned: no text layer, empty text in the index. */
function withScanned(record: DocumentRecord, scannedPages: number[]): DocumentRecord {
  return {
    ...record,
    scannedPages,
    pages: record.pages.map((page) => (scannedPages.includes(page.number) ? { ...page, text: '' } : page)),
  };
}

async function read(index: FakeIndex, document: string, from: number, to: number) {
  const result = await readPages.run({ document, from, to }, makeToolContext({ index }));
  return { output: result.output as ReadPagesOutput, summary: result.summary };
}

describe('read_pages', () => {
  it('returns the exact text of each page with its number', async () => {
    const { output, summary } = await read(indexWith(contract), 'contracts/Main Contract.pdf', 1, 3);

    expect(output).toEqual({
      document: 'contracts/Main Contract.pdf',
      pageCount: 3,
      pages: [
        { page: 1, text: 'Clause 1\nDefinitions', scanned: false, cut: false },
        { page: 2, text: 'Clause 14.2  Retention\n\nFive percent of each payment is held.  ', scanned: false, cut: false },
        { page: 3, text: 'Clause 20\tDisputes', scanned: false, cut: false },
      ],
      nextFrom: null,
      note: null,
    });
    expect(summary).toBe('Read pages 1 to 3 of contracts/Main Contract.pdf');
  });

  it('reads one page by name, ignoring case and a missing extension', async () => {
    const index = indexWith(contract, spec);
    const { output, summary } = await read(index, 'main contract', 2, 2);

    expect(output.document).toBe('contracts/Main Contract.pdf');
    expect(output.pages.map((page) => page.page)).toEqual([2]);
    expect(summary).toBe('Read page 2 of contracts/Main Contract.pdf');
    expect((await read(index, 'SPEC.PDF', 4, 4)).output.pages[0]?.text).toBe('page 4 text');
  });

  it('keeps Arabic text exactly as stored', async () => {
    const arabic = pdfRecord('عقد المشروع.pdf', ['البند 5: يحتجز المالك 10% من كل دفعة']);
    const { output } = await read(indexWith(arabic), 'عقد المشروع.pdf', 1, 1);

    expect(output.document).toBe('عقد المشروع.pdf');
    expect(output.pages[0]?.text).toBe('البند 5: يحتجز المالك 10% من كل دفعة');
  });

  it('returns at most 5 pages and says where the next call starts', async () => {
    const index = indexWith(spec);
    const readSpy = vi.spyOn(index, 'readPages');
    const { output } = await read(index, 'Spec.pdf', 2, 12);

    expect(output.pages.map((page) => page.page)).toEqual([2, 3, 4, 5, 6]);
    expect(output.nextFrom).toBe(7);
    expect(output.note).toBe(
      'Stopped after page 6: one call returns at most 5 pages and about 15,000 characters. Next call from page 7.',
    );
    expect(readSpy).toHaveBeenCalledWith('specs/Spec.pdf', 2, 6);
  });

  it('stops before the page that would pass about 15,000 characters', async () => {
    const dense = pdfRecord(
      'dense.pdf',
      Array.from({ length: 4 }, (_, i) => `${i + 1}`.repeat(6000)),
    );
    const { output } = await read(indexWith(dense), 'dense.pdf', 1, 4);

    expect(output.pages.map((page) => [page.page, page.text?.length, page.cut])).toEqual([
      [1, 6000, false],
      [2, 6000, false],
    ]);
    expect(output.nextFrom).toBe(3);
    expect(output.note).toContain('Next call from page 3.');
  });

  it('cuts a page longer than the cap and points at other ways to see the rest', async () => {
    const words = Array.from({ length: 4000 }, (_, i) => `word${i}`).join(' ');
    const { output } = await read(indexWith(pdfRecord('huge.pdf', [words, 'short page'])), 'huge.pdf', 1, 2);

    const [first] = output.pages;
    expect(output.pages).toHaveLength(1);
    expect(first?.cut).toBe(true);
    expect(first?.text?.length).toBeLessThanOrEqual(15_000);
    expect(first?.text?.length).toBeGreaterThan(14_800);
    expect(words.startsWith(first?.text ?? '-')).toBe(true);
    expect(first?.text?.endsWith(' ')).toBe(false);
    expect(output.nextFrom).toBe(2);
    expect(output.note).toContain('Page 1 is longer than 15,000 characters, so its text stops early');
    expect(output.note).toContain('search_documents');
    expect(output.note).toContain('Next call from page 2.');
  });

  it('reads up to the last page and gives the page count when the range runs past it', async () => {
    const { output } = await read(indexWith(spec), 'Spec.pdf', 11, 15);

    expect(output.pages.map((page) => page.page)).toEqual([11, 12]);
    expect(output.nextFrom).toBeNull();
    expect(output.note).toBe('specs/Spec.pdf has 12 pages; there are no pages after page 12.');
  });

  it('refuses a range that starts after the last page and gives the page count', async () => {
    const attempt = read(indexWith(spec), 'Spec.pdf', 13, 14);
    await expect(attempt).rejects.toBeInstanceOf(ToolError);
    await expect(attempt).rejects.toThrow(
      'specs/Spec.pdf has 12 pages, so page 13 does not exist. Ask for pages 1 to 12.',
    );

    const single = indexWith(pdfRecord('memo.pdf', ['Dear Sir']));
    await expect(read(single, 'memo.pdf', 2, 2)).rejects.toThrow('memo.pdf has 1 page, so page 2 does not exist. Ask for page 1.');
  });

  it('refuses a backwards range', async () => {
    await expect(read(indexWith(spec), 'Spec.pdf', 5, 3)).rejects.toThrow(
      'The range is backwards: from is page 5 and to is page 3.',
    );
  });

  it('refuses an unknown document and lists the loaded ones', async () => {
    const index = indexWith(contract, excelRecord('BOQ.xlsx', [boqTable([['A1', 'Piles', 10, 200, 2000]])]));
    const attempt = read(index, 'Contract.pdf', 1, 1);

    await expect(attempt).rejects.toBeInstanceOf(ToolError);
    await expect(attempt).rejects.toThrow(
      'No loaded document matches "Contract.pdf". Loaded documents: BOQ.xlsx, contracts/Main Contract.pdf. ' +
        'Use one of these names.',
    );
  });

  it('sends Excel files to query_tables', async () => {
    const index = indexWith(excelRecord('BOQ.xlsx', [boqTable([['A1', 'Piles', 10, 200, 2000]])]));
    const attempt = read(index, 'BOQ.xlsx', 1, 1);

    await expect(attempt).rejects.toBeInstanceOf(ToolError);
    await expect(attempt).rejects.toThrow('BOQ.xlsx is an Excel workbook, which has sheets, not pages. Use query_tables');
  });

  it('says why an unreadable file has no text', async () => {
    const broken: DocumentRecord = {
      ...pdfRecord('broken.pdf', []),
      status: 'corrupt',
      statusDetail: 'The file is damaged and could not be opened.',
      pageCount: null,
    };
    const locked: DocumentRecord = { ...pdfRecord('locked.pdf', []), status: 'encrypted', statusDetail: null, pageCount: null };
    const index = indexWith(broken, locked);

    await expect(read(index, 'broken.pdf', 1, 1)).rejects.toThrow(
      'broken.pdf has no text to read. The file is damaged and could not be opened.',
    );
    await expect(read(index, 'locked.pdf', 1, 1)).rejects.toThrow('locked.pdf has no text to read. Its status is encrypted.');
  });

  it('sends a scanned page to look_at_page', async () => {
    const index = indexWith(withScanned(spec, [3]));
    const attempt = read(index, 'Spec.pdf', 3, 3);

    await expect(attempt).rejects.toBeInstanceOf(ToolError);
    await expect(attempt).rejects.toThrow(
      'Page 3 of specs/Spec.pdf is scanned, with no text layer, so there is no text to read. Use look_at_page to see it.',
    );
  });

  it('says where text resumes when every page in the window is scanned', async () => {
    const index = indexWith(withScanned(spec, [1, 2, 3, 4, 5, 6]));
    await expect(read(index, 'Spec.pdf', 2, 9)).rejects.toThrow(
      'Pages 2 to 6 of specs/Spec.pdf are scanned, with no text layer, so there is no text to read. ' +
        'Use look_at_page to see each page. For the pages after, call read_pages from page 7.',
    );
  });

  it('marks scanned pages inside a range and still returns the others', async () => {
    const { output, summary } = await read(indexWith(withScanned(spec, [3, 4])), 'Spec.pdf', 2, 5);

    expect(output.pages).toEqual([
      { page: 2, text: 'page 2 text', scanned: false, cut: false },
      { page: 3, text: null, scanned: true, cut: false },
      { page: 4, text: null, scanned: true, cut: false },
      { page: 5, text: 'page 5 text', scanned: false, cut: false },
    ]);
    expect(output.note).toBe('Pages 3 and 4 are scanned, with no text layer; use look_at_page to see them.');
    expect(summary).toBe('Read pages 2 to 5 of specs/Spec.pdf (pages 3 and 4 are scanned)');
  });

  it('refuses a document that is scanned throughout', async () => {
    const scan = { ...withScanned(pdfRecord('scan.pdf', ['', '']), [1, 2]), status: 'scanned' as const };
    await expect(read(indexWith(scan), 'scan.pdf', 1, 2)).rejects.toThrow(
      'scan.pdf is a scanned document: none of its pages has a text layer. Use look_at_page to see a page.',
    );
  });

  it('notes pages that have a text layer but no text', async () => {
    const { output } = await read(indexWith(pdfRecord('gaps.pdf', ['Cover', '', 'Index'])), 'gaps.pdf', 1, 3);

    expect(output.pages[1]).toEqual({ page: 2, text: '', scanned: false, cut: false });
    expect(output.note).toBe('Page 2 has no text.');
  });

  it('needs every field as a whole page number from 1', () => {
    const parse = (args: unknown) => readPages.parameters.safeParse(args).success;
    expect(parse({ document: 'a.pdf', from: 1, to: 5 })).toBe(true);
    expect(parse({ document: 'a.pdf', from: 0, to: 5 })).toBe(false);
    expect(parse({ document: 'a.pdf', from: 1.5, to: 5 })).toBe(false);
    expect(parse({ document: 'a.pdf', from: 1, to: null })).toBe(false);
    expect(parse({ document: 'a.pdf', from: 1 })).toBe(false);
    expect(parse({ document: 'a.pdf', from: 1, to: 2, page: 1 })).toBe(false);
  });

  it('is registered under its name', () => {
    expect(tools.filter((tool) => tool.name === 'read_pages')).toEqual([readPages]);
  });
});
