import { readFileSync } from 'node:fs';
import * as mupdf from 'mupdf';
import { beforeAll, describe, expect, it } from 'vitest';
import { meetingMinutesFacts } from '../../scripts/samples/expectedEdge';
import { facadeStoneDecision, meetingMinutes } from '../../scripts/samples/meetingMinutesAr';
import { minutesHtml } from '../../scripts/samples/meetingMinutesHtml';

// The committed file: rendering it again needs Microsoft Edge, which unit tests do not launch.
const path = new URL(`../../../samples/riyadh-tower/${meetingMinutes.fileName}`, import.meta.url);
let pages: string[];
const facts = meetingMinutesFacts();

beforeAll(() => {
  const doc = mupdf.Document.openDocument(readFileSync(path), 'application/pdf');
  pages = Array.from({ length: doc.countPages() }, (_, i) =>
    doc.loadPage(i).toStructuredText('preserve-whitespace').asText().replace(/\s+/g, ' '),
  );
});

describe('Meeting_Minutes_07_AR.pdf', () => {
  it('is written right to left in Arabic, with amounts and dates in Arabic-Indic digits', () => {
    const html = minutesHtml();
    expect(html).toContain('<html dir="rtl" lang="ar">');
    expect(html).toContain('font-family: "Segoe UI"');
    const decision = facadeStoneDecision();
    expect(decision).toContain('VO-014 بقيمة إضافية قدرها ٢٬٣٥٠٬٠٠٠ ريال');
    expect(decision).toContain('في موعد أقصاه ١٥ نوفمبر ٢٠٢٦م');
    expect(decision).toContain('حجر الرياض الجيري');
    expect(facts.facadeStone.variation).toEqual({ amount: 2_350_000, currency: 'SAR', text: '٢٬٣٥٠٬٠٠٠ ريال', excludesVat: true });
  });

  it('has two pages whose Arabic words come out as text in logical order', () => {
    expect(pages).toHaveLength(meetingMinutes.pages);
    expect(pages[0]).toContain('محضر اجتماع التنسيق الموقعي');
    expect(pages[0]).toContain('بحجر الرياض الجيري المحلي');
    expect(pages[0]).toContain('VO-014');
    expect(pages[0]).toContain('4.1.01');
    expect(pages[1]).toContain('الإجراءات المطلوبة');
    expect(pages[1]).toContain('الاجتماع القادم');
  });

  it('puts the facade stone decision on page 1 and the action list on page 2', () => {
    expect(facts.facadeStone.source.page).toBe(1);
    expect(pages[0]).toContain(facts.facadeStone.source.quote);
    expect(pages[1]).toContain(facts.facadeStone.actionSource.quote);
    for (const action of meetingMinutes.actions) expect(pages[1]).toContain(action.owner);
  });

  it('shows the known mupdf slip: each run of Arabic-Indic digits is listed right to left', () => {
    // Readers must put digit runs back in order; ٢٬٣٥٠٬٠٠٠ and ٢٠٢٦ come out reversed.
    expect(pages[0]).toContain('٠٠٠٬٠٥٣٬٢');
    expect(pages[0]).not.toContain('٢٬٣٥٠٬٠٠٠');
    expect(pages[0]).toContain('٦٢٠٢');
  });
});
