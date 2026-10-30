import * as mupdf from 'mupdf';
import { arabicDate, arabicDigits, arabicHijriDate, arabicWeekday } from '../samples/lib/arabicText';
import { day } from '../samples/lib/dates';
import { htmlToPdf } from '../samples/lib/htmlPdf';
import { FOOTER_TEXT } from '../samples/project';
import { contract, project } from './project';

/**
 * Correspondence/تعليمات موقعية رقم 7.pdf: a site instruction in Arabic, with an Arabic file name. Only this file says
 * that concrete pours in Warehouse W3 are stopped and that 120 m3 of rejected concrete must be replaced within 10 days.
 */
export const siteInstruction = {
  fileName: 'تعليمات موقعية رقم 7.pdf',
  number: '7',
  date: '2026-10-01',
  inspectionDate: '2026-09-30',
  pourDate: '2026-09-28',
  deadline: '2026-10-11',
  warehouse: 'W3',
  subZone: 'C-2',
  ncr: 'NCR-023',
  drawing: 'KLP-P2-STR-W3-012',
  drawingRevision: 'B',
  volumeM3: 120,
  days: 10,
  spacingRequiredMm: 150,
  spacingFoundMm: 200,
  pages: 1,
  engineerAr: 'م. نورة الشهري',
  engineerFirmAr: 'راكين للاستشارات الهندسية',
  contractorRepAr: 'م. رامي حداد',
  contractorAr: 'شركة ثريا بيلد للمقاولات',
  phrases: {
    title: 'تعليمات موقعية رقم ٧',
    titleWords: 'تعليمات موقعية رقم',
    stop: 'إيقاف صب الخرسانة',
    replace: 'إزالة واستبدال',
    atContractorCost: 'على نفقة المقاول',
    noVariation: 'لا تعد هذه التعليمات أمرا تغييريا',
  },
  questions: {
    ar: 'ما الذي تطلبه التعليمات الموقعية رقم 7 من المقاول؟',
    en: 'What does Site Instruction No. 7 require the contractor to do?',
  },
};

const STYLE = `
@page { size: A4; margin: 18mm 17mm 20mm 17mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Segoe UI", Tahoma, Arial, sans-serif; font-size: 10.5pt; line-height: 1.6; color: #1b1d22; }
header { border-bottom: 1.5pt solid #1b1d22; padding-bottom: 6pt; margin-bottom: 10pt; }
.issuer { font-size: 9pt; color: #555b66; }
h1 { font-size: 16pt; margin: 2pt 0; }
.project { font-size: 10pt; }
h2 { font-size: 11.5pt; margin: 12pt 0 5pt; padding-bottom: 2pt; border-bottom: 0.5pt solid #b8bec6; }
table { width: 100%; border-collapse: collapse; margin: 3pt 0 6pt; }
td { border: 0.5pt solid #9aa1aa; padding: 3pt 6pt; text-align: right; vertical-align: top; }
.info td:first-child { width: 22%; font-weight: 600; background: #f4f5f7; }
p { margin: 4pt 0; }
ol { margin: 2pt 0; padding-right: 20pt; padding-left: 0; }
li { margin: 3pt 0; }
.signatures { display: flex; gap: 14pt; margin-top: 36pt; }
.signatures div { flex: 1; border-top: 0.5pt solid #1b1d22; padding-top: 4pt; text-align: center; font-size: 9pt; }
.fictional { margin-top: 24pt; font-size: 8.5pt; color: #555b66; }
`;

/** The instruction as one HTML page, right to left. Codes and the warehouse name stay in Latin letters, as on Site. */
export function siteInstructionHtml(): string {
  const si = siteInstruction;
  const n = (value: number | string) => arabicDigits(String(value));
  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>${si.phrases.title}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <div class="issuer">${si.engineerFirmAr}، مكتب المهندس المقيم</div>
  <h1>${si.phrases.title}</h1>
  <div class="project">مشروع ${project.name}، العقد رقم ${contract.number}</div>
</header>

<table class="info">
  <tr><td>التاريخ</td><td>${arabicWeekday(si.date)} ${arabicDate(si.date)}، الموافق ${arabicHijriDate(si.date)}</td></tr>
  <tr><td>إلى</td><td>${si.contractorAr} (المقاول)، عناية ${si.contractorRepAr}، مدير المشروع</td></tr>
  <tr><td>من</td><td>${si.engineerFirmAr} (المهندس)</td></tr>
  <tr><td>الموضوع</td><td>${si.phrases.stop} في المستودع ${si.warehouse} وإزالة الخرسانة المرفوضة</td></tr>
  <tr><td>المرجع</td><td>تقرير عدم المطابقة ${si.ncr}، الرسم ${si.drawing} المراجعة ${si.drawingRevision}</td></tr>
</table>

<h2>${n(1)}. الملاحظة</h2>
<p>أثناء الفحص المسبق للصب بتاريخ ${arabicDate(si.inspectionDate)}، تبيّن أن حديد التسليح في بلاطة الأرضية للمستودع ${si.warehouse} (المنطقة الفرعية ${si.subZone}) مثبّت بتباعد ${n(si.spacingFoundMm)} مم بدلاً من ${n(si.spacingRequiredMm)} مم المطلوبة بموجب الرسم ${si.drawing} المراجعة ${si.drawingRevision}، وقد صدر بذلك تقرير عدم المطابقة ${si.ncr}. كما تبيّن أن الصبة المنفذة في المنطقة الفرعية ${si.subZone} بتاريخ ${arabicDate(si.pourDate)} نُفذت قبل اعتماد طلب الفحص.</p>

<h2>${n(2)}. التعليمات</h2>
<p>يُطلب من المقاول ما يلي:</p>
<ol>
  <li>${si.phrases.stop} فوراً في بلاطة الأرضية للمستودع ${si.warehouse} إلى حين تصحيح حديد التسليح واعتماده من المهندس.</li>
  <li>${si.phrases.replace} ${n(si.volumeM3)} م³ من الخرسانة المرفوضة في المنطقة الفرعية ${si.subZone}، ${si.phrases.atContractorCost}.</li>
  <li>إعادة تثبيت حديد التسليح بتباعد ${n(si.spacingRequiredMm)} مم وفق الرسم المعتمد، وتقديم طلب فحص جديد قبل أي صبة.</li>
  <li>إنجاز الأعمال المذكورة أعلاه خلال ${n(si.days)} أيام من تاريخ هذه التعليمات، أي بحلول ${arabicDate(si.deadline)}.</li>
</ol>

<h2>${n(3)}. ملاحظات تعاقدية</h2>
<p>${si.phrases.noVariation}، ولا تمنح المقاول أي تمديد للمدة أو تكاليف إضافية، إذ إن سببها عدم مطابقة أعمال المقاول للرسومات المعتمدة. يُغلق تقرير عدم المطابقة ${si.ncr} بعد إعادة الفحص من قبل المهندس.</p>

<div class="signatures">
  <div>المهندس المقيم<br>${si.engineerAr}<br>${si.engineerFirmAr}</div>
  <div>استلمه عن المقاول<br>${si.contractorRepAr}<br>${si.contractorAr}</div>
</div>

<p class="fictional">وثيقة نموذجية خيالية أُعدّت لاختبار Atlas. جميع الأسماء والمبالغ خيالية.</p>
</body>
</html>`;
}

function footer(): string {
  return `<div style="width:100%; margin:0 17mm; font-family:'Segoe UI', Arial, sans-serif; font-size:7.5pt; color:#555b66; display:flex; justify-content:space-between;">
  <span>${FOOTER_TEXT}</span>
  <span dir="rtl">صفحة <span class="pageNumber"></span> من <span class="totalPages"></span></span>
</div>`;
}

/** Renders the instruction with Edge, then checks the page count and that the Arabic text is extractable. */
export async function buildSiteInstruction(): Promise<Uint8Array> {
  const bytes = await htmlToPdf(siteInstructionHtml(), { footerTemplate: footer(), issued: day(siteInstruction.date) });
  const document = mupdf.Document.openDocument(bytes, 'application/pdf');
  try {
    const pages = document.countPages();
    if (pages !== siteInstruction.pages) throw new Error(`The site instruction came out at ${pages} pages, not ${siteInstruction.pages}`);
    const text = document.loadPage(0).toStructuredText('preserve-whitespace').asText();
    // Only digit-free phrases: mupdf returns mixed Arabic and digit runs out of order, as it does for any real Arabic PDF.
    for (const needle of [siteInstruction.phrases.titleWords, siteInstruction.phrases.stop, siteInstruction.phrases.replace, siteInstruction.ncr]) {
      if (!text.includes(needle)) throw new Error(`The site instruction does not contain "${needle}" as text`);
    }
  } finally {
    document.destroy();
  }
  return bytes;
}
