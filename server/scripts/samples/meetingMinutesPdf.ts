import * as mupdf from 'mupdf';
import { day } from './lib/dates';
import { htmlToPdf } from './lib/htmlPdf';
import { meetingMinutes } from './meetingMinutesAr';
import { minutesFooter, minutesHtml } from './meetingMinutesHtml';

/** Words that must come out of each page as text, in logical order. */
const PAGE_CHECKS: Record<number, string[]> = {
  1: ['محضر اجتماع التنسيق الموقعي', meetingMinutes.facadeStone.stone, meetingMinutes.facadeStone.variationOrder],
  2: ['الإجراءات المطلوبة', 'الاجتماع القادم'],
};

/** Renders the minutes with Edge, then checks the page count and that the Arabic text is extractable. */
export async function buildMeetingMinutes(): Promise<Uint8Array> {
  const bytes = await htmlToPdf(minutesHtml(), { footerTemplate: minutesFooter(), issued: day(meetingMinutes.date) });
  const document = mupdf.Document.openDocument(bytes, 'application/pdf');
  try {
    const pages = document.countPages();
    if (pages !== meetingMinutes.pages) throw new Error(`The minutes came out at ${pages} pages, not ${meetingMinutes.pages}`);
    for (const [page, needles] of Object.entries(PAGE_CHECKS)) {
      const text = document.loadPage(Number(page) - 1).toStructuredText('preserve-whitespace').asText();
      for (const needle of needles) {
        if (!text.includes(needle)) throw new Error(`Page ${page} of the minutes does not contain "${needle}" as text`);
      }
    }
  } finally {
    document.destroy();
  }
  return bytes;
}
