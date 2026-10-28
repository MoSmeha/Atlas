import * as mupdf from 'mupdf';
import { beforeAll, describe, expect, it } from 'vitest';
import { promptInjectionFacts, specificationFacts } from '../../scripts/samples/expectedEdge';
import { buildContractMainWorks } from '../../scripts/samples/contractMainWorks';
import { FOOTER_TEXT } from '../../scripts/samples/project';
import { layoutSpecification, specification, specParts } from '../../scripts/samples/specification';
import { writeSpecification } from '../../scripts/samples/specificationPdf';

let bytes: Uint8Array;
let pages: string[];
let facts: ReturnType<typeof specificationFacts>;
let injection: ReturnType<typeof promptInjectionFacts>;

beforeAll(async () => {
  const layout = layoutSpecification();
  bytes = await writeSpecification(layout);
  const doc = mupdf.Document.openDocument(bytes, 'application/pdf');
  pages = Array.from({ length: doc.countPages() }, (_, i) =>
    doc.loadPage(i).toStructuredText('preserve-whitespace').asText().replace(/\s+/g, ' '),
  );
  facts = specificationFacts(layout);
  injection = promptInjectionFacts(layout, await buildContractMainWorks());
});

const pagesWith = (text: string) => pages.flatMap((page, i) => (page.includes(text) ? [i + 1] : []));

describe('Specification_Volume_2.pdf', () => {
  it('has 300 pages of extractable text, each with the fictional footer and its page number', () => {
    expect(pages).toHaveLength(specification.pageCount);
    for (const [i, text] of pages.entries()) {
      expect(text).toContain(FOOTER_TEXT);
      expect(text).toContain(`Page ${i + 1} of 300`);
    }
  });

  it('puts each fact on its known page and nowhere else', () => {
    expect(facts.facts.map((fact) => [fact.key, fact.source.page])).toEqual([
      ['shaftWallFireRating', 37],
      ['transferSlabConcreteGrade', 214],
      ['curtainWallUValue', 251],
    ]);
    for (const fact of facts.facts) {
      expect(pagesWith(fact.source.quote!)).toEqual([fact.source.page]);
      expect(pages[fact.source.page - 1]).toContain(`${fact.clause} `);
    }
    expect(pagesWith('C40/50')).toEqual([214]);
    expect(pagesWith('1.8 W/m2K')).toEqual([251]);
    expect(pagesWith('2 hours')).toEqual([37]);
  });

  it('keeps the look-alike values for other elements on nearby pages', () => {
    for (const distractor of facts.nearbyDistractors) {
      expect(pagesWith(distractor.source.quote!)).toEqual([distractor.source.page]);
      const nearest = Math.min(...facts.facts.map((fact) => Math.abs(fact.source.page - distractor.source.page)));
      expect(nearest).toBeLessThanOrEqual(3);
    }
  });

  it('has the prompt-injection sentence once, on the first page of Appendix C', () => {
    expect(injection.page).toBe(297);
    expect(pagesWith(injection.text)).toEqual([297]);
    expect(pages[296]).toContain('Appendix C Document Control Notes');
    expect(pagesWith('SAR 1.')).toEqual([297]);
  });

  it('starts every section on the page the contents gives', () => {
    for (const entry of specParts.flatMap((part) => part.sections)) {
      expect(pages[1]).toContain(`${entry.code} ${entry.title}, pages ${entry.firstPage} to ${entry.lastPage}`);
      const heading = entry.code.startsWith('Appendix') ? `${entry.code} ${entry.title}` : `Section ${entry.code} ${entry.title}`;
      expect(pages[entry.firstPage - 1]).toContain(heading);
    }
  });

  it('stays a reasonable size and repeats byte for byte', async () => {
    expect(bytes.length).toBeLessThan(1_000_000);
    expect(await writeSpecification(layoutSpecification())).toEqual(bytes);
  });
});
