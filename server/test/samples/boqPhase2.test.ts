import * as mupdf from 'mupdf';
import { beforeAll, describe, expect, it } from 'vitest';
import { boqPhase2, buildBoqPhase2Facade } from '../../scripts/samples/boqPhase2Facade';
import { phase2BoqFacts } from '../../scripts/samples/expectedTables';
import { formatAmount } from '../../scripts/samples/lib/money';
import type { GeneratedPdfBoq } from '../../scripts/samples/lib/pdfBoqWriter';
import { FOOTER_TEXT } from '../../scripts/samples/project';

interface TextLine {
  x: number;
  y: number;
  bbox: { x: number; y: number; w: number; h: number };
  text: string;
}

let pdf: GeneratedPdfBoq;
let pages: string[];
let lines: TextLine[][];
let facts: ReturnType<typeof phase2BoqFacts>;

beforeAll(async () => {
  pdf = await buildBoqPhase2Facade();
  const doc = mupdf.Document.openDocument(pdf.bytes, 'application/pdf');
  const count = doc.countPages();
  pages = Array.from({ length: count }, (_, i) =>
    doc.loadPage(i).toStructuredText('preserve-whitespace').asText().replace(/\s+/g, ' '),
  );
  lines = Array.from({ length: count }, (_, i) => {
    const json = JSON.parse(doc.loadPage(i).toStructuredText('preserve-whitespace').asJSON()) as {
      blocks: { lines?: TextLine[] }[];
    };
    return json.blocks.flatMap((block) => block.lines ?? []);
  });
  facts = phase2BoqFacts(pdf);
});

const onPage = (page: number, text: string) => expect(pages[page - 1]).toContain(text);
const notOnPage = (page: number, text: string) => expect(pages[page - 1]).not.toContain(text);

describe('BOQ_Phase2_Facade.pdf', () => {
  it('runs across three pages of extractable text, each with the header and the fictional footer', () => {
    expect(pages).toHaveLength(3);
    for (const [i, text] of pages.entries()) {
      expect(text).toContain('Item Description Unit Qty Rate (SAR) Amount (SAR)');
      expect(text).toContain(FOOTER_TEXT);
      expect(text).toContain(`Page ${i + 1} of 3`);
    }
  });

  it('carries forward at the bottom of pages 1 and 2 and brings forward at the top of pages 2 and 3', () => {
    expect(facts.carriedForward.map((carry) => carry.page)).toEqual([1, 2]);
    expect(facts.broughtForward.map((carry) => carry.page)).toEqual([2, 3]);
    for (const carry of facts.carriedForward) onPage(carry.page, `Carried forward ${formatAmount(carry.amount)}`);
    for (const carry of facts.broughtForward) onPage(carry.page, `Brought forward ${formatAmount(carry.amount)}`);
    notOnPage(3, 'Carried forward');
    notOnPage(1, 'Brought forward');
    expect(facts.broughtForward.map((carry) => carry.amount)).toEqual(facts.carriedForward.map((carry) => carry.amount));
  });

  it('makes each carry the running sum of the items before it, and ends with the total carried to Summary', () => {
    const cents = (n: number) => Math.round(n * 100);
    for (const carry of facts.carriedForward) {
      const before = facts.items.filter((item) => item.page <= carry.page);
      expect(cents(carry.amount)).toBe(before.reduce((sum, item) => sum + cents(item.amount), 0));
    }
    expect(facts.statedTotal.amount).toBe(facts.totals[0]!.amount);
    onPage(3, `Total carried to Summary ${formatAmount(facts.statedTotal.amount)}`);
    expect(pages.join(' ').split('Total carried to Summary')).toHaveLength(2);
  });

  it('prints every item code and amount on the page expected.json gives', () => {
    expect(facts.items.length).toBeGreaterThanOrEqual(30);
    for (const item of facts.items) {
      onPage(item.page, item.item);
      onPage(item.page, formatAmount(item.amount));
    }
    expect(new Set(facts.items.map((item) => item.page))).toEqual(new Set([1, 2, 3]));
  });

  it('has multi-line descriptions and at least two items above SAR 1,000,000, one exactly at it', () => {
    expect(facts.multiLineItems.length).toBeGreaterThanOrEqual(5);
    expect(facts.rowsAboveSar1m.length).toBeGreaterThanOrEqual(2);
    expect(facts.rowsAboveSar1m.every((row) => row.amount > 1_000_000)).toBe(true);
    expect(new Set(facts.rowsAboveSar1m.map((row) => row.page)).size).toBeGreaterThan(1);
    expect(facts.rowsAtExactlySar1m.map((row) => row.item)).toEqual([boqPhase2.atThresholdItem]);
    for (const item of facts.items) expect(item.amount).toBe(Math.round(item.quantity * item.rate * 100) / 100);
  });

  it('keeps the columns at the same x positions on every page', () => {
    const codeX = new Set<number>();
    const amountRight = new Set<number>();
    for (const item of facts.items) {
      const pageLines = lines[item.page - 1]!;
      const code = pageLines.find((line) => line.text === item.item);
      const amount = pageLines.filter((line) => line.text === formatAmount(item.amount)).at(-1);
      expect(code, item.item).toBeDefined();
      expect(amount, item.item).toBeDefined();
      codeX.add(Math.round(code!.bbox.x));
      amountRight.add(Math.round(amount!.bbox.x + amount!.bbox.w));
    }
    expect(codeX.size).toBe(1);
    expect(Math.max(...amountRight) - Math.min(...amountRight)).toBeLessThanOrEqual(1);
  });

  it('gives the same bytes every time', async () => {
    const again = await buildBoqPhase2Facade();
    expect(Buffer.from(again.bytes).equals(Buffer.from(pdf.bytes))).toBe(true);
  });
});
