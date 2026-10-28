import { readFileSync } from 'node:fs';
import * as mupdf from 'mupdf';
import { beforeAll, describe, expect, it } from 'vitest';
import { boqPhase1Rev0 } from '../../scripts/samples/boqPhase1Rev0';
import { boqPhase1Rev1 } from '../../scripts/samples/boqPhase1Rev1';
import { buildContractMainWorks, type GeneratedPdf } from '../../scripts/samples/contractMainWorks';
import { buildExpected, type Expected } from '../../scripts/samples/expected';
import { layoutBoq } from '../../scripts/samples/lib/boqLayout';
import { contract, FOOTER_TEXT } from '../../scripts/samples/project';

let pdf: GeneratedPdf;
let pages: string[];
let expected: Expected;

beforeAll(async () => {
  pdf = await buildContractMainWorks();
  const doc = mupdf.Document.openDocument(pdf.bytes, 'application/pdf');
  pages = Array.from({ length: doc.countPages() }, (_, i) =>
    doc.loadPage(i).toStructuredText('preserve-whitespace').asText().replace(/\s+/g, ' '),
  );
  expected = buildExpected({ contract: pdf, boqRev0: layoutBoq(boqPhase1Rev0), boqRev1: layoutBoq(boqPhase1Rev1) });
});

const onPage = (page: number, text: string) => expect(pages[page - 1]).toContain(text);

describe('Contract_Main_Works.pdf', () => {
  it('has about eight pages of extractable text, each with the fictional footer', () => {
    expect(pages.length).toBe(8);
    expect(pdf.pageCount).toBe(8);
    for (const [i, text] of pages.entries()) {
      expect(text).toContain(FOOTER_TEXT);
      expect(text).toContain(`Page ${i + 1} of 8`);
    }
  });

  it('states the contract value exactly once as a number and once in short form', () => {
    const value = expected.facts.contractValue;
    onPage(value.source.page, 'SAR 187,462,350.00');
    onPage(value.shortTextSource.page, 'SAR 187.5M');
    expect(pages.join(' ').split('SAR 187,462,350.00')).toHaveLength(2);
    expect(pages.join(' ').split('SAR 187.5M')).toHaveLength(2);
  });

  it('puts every quoted source and scope item on the page expected.json gives', () => {
    for (const source of collectPdfSources(expected)) if (source.quote) onPage(source.page, source.quote);
    expect(expected.facts.scopeOfWork.items.length).toBeGreaterThanOrEqual(10);
    expect(expected.facts.scopeOfWork.items.length).toBeLessThanOrEqual(15);
    for (const item of expected.facts.scopeOfWork.items) onPage(item.page, item.text);
  });

  it('lists every milestone and deliverable on its page with its due text', () => {
    for (const m of expected.schedule.milestones) {
      onPage(m.source.page, m.id);
      onPage(m.source.page, m.title);
    }
    for (const d of expected.schedule.deliverables) onPage(d.source.page, d.name);
  });

  it('writes the dates, durations and damages with the right pages', () => {
    const schedule = expected.schedule;
    onPage(schedule.commencementDate.source.page, `The Commencement Date is 1 February 2026, corresponding to ${contract.commencement.hijri}`);
    onPage(schedule.timeForCompletion.source.page, 'Time for Completion: 30 months');
    onPage(schedule.timeForCompletion.source.page, 'on or before 31 July 2028');
    onPage(schedule.durations[0]!.source.page, 'within 28 days of the Commencement Date');
    onPage(expected.facts.liquidatedDamages.source.page, 'SAR 125,000.00 per day of delay');
    onPage(expected.facts.retention.source.page, 'Retention money of 10%');
    expect(schedule.milestones.at(-1)!.date).toBe(schedule.timeForCompletion.completionDate);
  });
});

describe('expected.json', () => {
  it('matches the committed file, so the ground truth is never stale', () => {
    const committed = JSON.parse(readFileSync(new URL('../../../samples/expected.json', import.meta.url), 'utf8'));
    expect(committed).toEqual(JSON.parse(JSON.stringify(expected)));
  });

  it('lists only item rows above SAR 1,000,000 and sums item rows only', () => {
    expect(expected.rowsAboveSar1m.every((row) => row.amount > 1_000_000 && row.currency === 'SAR')).toBe(true);
    const rev0 = expected.boqTotals['BOQ_Phase1_Rev0.xlsx']!;
    const billSum = rev0.bills.reduce((sum, bill) => sum + Math.round(bill.total * 100), 0) / 100;
    expect(rev0.totals).toEqual([{ currency: 'SAR', amount: billSum }]);
    expect(rev0.statedGrandTotal.amount).not.toBe(billSum);
  });
});

interface PdfSourceLike {
  kind: 'pdf';
  page: number;
  quote: string | null;
}

function collectPdfSources(node: unknown, found: PdfSourceLike[] = []): PdfSourceLike[] {
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (record.kind === 'pdf' && typeof record.page === 'number') found.push(record as unknown as PdfSourceLike);
    for (const value of Object.values(record)) collectPdfSources(value, found);
  }
  return found;
}
