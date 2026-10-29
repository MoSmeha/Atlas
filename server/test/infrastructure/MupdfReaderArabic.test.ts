import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { PdfPage } from '../../src/domain/document';
import { SqliteIndexFactory } from '../../src/infrastructure/index/SqliteIndexFactory';
import { MupdfReader } from '../../src/infrastructure/readers/MupdfReader';
import { pdfRecord } from '../fakes/records';

/** Printed to PDF by Edge from right-to-left HTML paragraphs in Arial, plus one English paragraph. */
const FIXTURE = fileURLToPath(new URL('../fixtures/arabic-edge.pdf', import.meta.url));
/** The committed sample minutes, printed by Edge from right-to-left HTML in Segoe UI. */
const MINUTES = fileURLToPath(new URL('../../../samples/riyadh-tower/Meeting_Minutes_07_AR.pdf', import.meta.url));

async function readPages(path: string): Promise<PdfPage[]> {
  const outcome = await new MupdfReader().read(path);
  if (outcome.status !== 'ok' || outcome.document.kind !== 'pdf') throw new Error(outcome.status);
  return outcome.document.pages;
}

describe('MupdfReader on an Arabic PDF', () => {
  it('returns every line in reading order', async () => {
    const [page] = await readPages(FIXTURE);
    expect(page?.text.split('\n').filter(Boolean)).toEqual([
      'عقد المشروع',
      'قيمة العقد 1,250,000 ريال',
      'البند A-101 الخرسانة المسلحة',
      'علاقة الأعمال والإنشاءات',
      'السلام عليكم ورحمة الله',
      'Contract value: 1,250,000 SAR',
    ]);
  });

  it('gives Arabic words in reading order with their positions on the page', async () => {
    const pages = await readPages(FIXTURE);
    const line = pages[0]!.blocks.flatMap((block) => block.lines).find((l) => l.text.startsWith('البند'));
    const words = line!.words;
    expect(words.map((word) => word.text)).toEqual(['البند', 'A-101', 'الخرسانة', 'المسلحة']);
    // Right to left on the page: each word starts left of the one before it.
    for (let i = 1; i < words.length; i += 1) expect(words[i]!.x1).toBeLessThanOrEqual(words[i - 1]!.x0 + 0.5);
  });
});

describe('MupdfReader on the Arabic meeting minutes', () => {
  it('reads the facade stone decision as written, amount and item code included', async () => {
    const lines = (await readPages(MINUTES))[0]!.text.split('\n').filter(Boolean);
    expect(lines).toContain('٣-١ حجر واجهة المنصة: وافق المالك على استبدال الجرانيت الطبيعي في البند 4.1.01 من جدول كميات أعمال الواجهات');
    expect(lines).toContain('رقم VO-014 بقيمة إضافية قدرها ٢٬٣٥٠٬٠٠٠ ريال غير شاملة ضريبة القيمة المضافة. ويلتزم المقاول بتقديم العينات النهائية');
    expect(lines).toContain('ولوحة النموذج لاعتماد المهندس في موعد أقصاه ١٥ نوفمبر ٢٠٢٦م.');
  });

  it('keeps words with diacritics whole and punctuation where it was written', async () => {
    const lines = (await readPages(MINUTES))[0]!.text.split('\n').filter(Boolean);
    expect(lines).toContain('الوقت  من الساعة ١٠:٠٠ صباحًا إلى الساعة ١٢:٣٠ ظهرًا');
    expect(lines).toContain('لم تُسجَّل أي إصابة مضيِّعة للوقت خلال الفترة، وبلغ إجمالي ساعات العمل الآمنة ٤١٢٬٣٠٠ ساعة.');
    expect(lines).toContain('بلغت نسبة الإنجاز الإجمالية ٢٤٫٦٪ مقابل ٢٦٫١٪ حسب البرنامج الزمني المعتمد.');
    expect(lines).toContain('مشروع Najd Gate Mixed-Use Tower، العقد رقم NGT-MW-2026-001');
  });

  it('keeps the cells of an attendee row apart, brackets in place', async () => {
    const lines = (await readPages(MINUTES))[0]!.text.split('\n').filter(Boolean);
    expect(lines).toContain('١  م. فيصل الحربي  سراب كرست للتطوير العقاري (المالك)  مدير المشاريع');
  });

  it('can be searched for its Arabic words, with or without diacritics', async () => {
    const pages = await readPages(MINUTES);
    const dataDir = mkdtempSync(join(tmpdir(), 'atlas-minutes-'));
    const index = new SqliteIndexFactory(dataDir).open('C:/Projects/Riyadh Tower');
    try {
      index.save(pdfRecord('Meeting_Minutes_07_AR.pdf', pages.map((page) => page.text)));
      const found = (query: string) => index.keywordSearch(query, { document: null, limit: 5 }).map((hit) => hit.page);
      expect(found('حجر الرياض الجيري')).toContain(1);
      expect(found('صباحا')).toContain(1);
      expect(found('تسجل')).toEqual([1]);
      expect(found('مضيعة')).toEqual([1]);
      expect(found('2,350,000')).toEqual([1]);
      expect(found('أعدت')).toEqual([2]);
    } finally {
      index.close();
      await rm(dataDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
    }
  });
});
