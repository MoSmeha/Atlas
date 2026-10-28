import { arabicDate, arabicDigits, arabicHijriDate, arabicWeekday } from './lib/arabicText';
import { facadeStoneDecision, meetingMinutes } from './meetingMinutesAr';
import { contract, FOOTER_TEXT, project } from './project';

const STYLE = `
@page { size: A4; margin: 18mm 17mm 20mm 17mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Segoe UI", Tahoma, Arial, sans-serif; font-size: 10pt; line-height: 1.5; color: #1b1d22; }
header { border-bottom: 1.5pt solid #1b1d22; padding-bottom: 6pt; margin-bottom: 10pt; }
.issuer { font-size: 9pt; color: #555b66; }
h1 { font-size: 16pt; margin: 2pt 0; }
.project { font-size: 10pt; }
h2 { font-size: 11.5pt; margin: 12pt 0 5pt; padding-bottom: 2pt; border-bottom: 0.5pt solid #b8bec6; }
table { width: 100%; border-collapse: collapse; margin: 3pt 0 6pt; }
th, td { border: 0.5pt solid #9aa1aa; padding: 3pt 6pt; text-align: right; vertical-align: top; }
th { background: #e7eaee; font-weight: 600; }
.info td:first-child { width: 24%; font-weight: 600; background: #f4f5f7; }
.number { width: 7%; text-align: center; }
.due { width: 20%; white-space: nowrap; }
p { margin: 3pt 0; }
ul { margin: 2pt 0; padding-right: 18pt; padding-left: 0; }
li { margin: 2pt 0; }
.decision { margin: 5pt 0; }
.decision .ref { font-weight: 600; margin-left: 4pt; }
.new-page { break-before: page; }
.signatures { display: flex; gap: 14pt; margin-top: 30pt; }
.signatures div { flex: 1; border-top: 0.5pt solid #1b1d22; padding-top: 4pt; text-align: center; font-size: 9pt; }
.fictional { margin-top: 24pt; font-size: 8.5pt; color: #555b66; }
`;

/** The minutes as one HTML page, right to left. Page 2 starts at the actions table. */
export function minutesHtml(): string {
  const m = meetingMinutes;
  const attendees = m.attendees
    .map((a, i) => `<tr><td class="number">${arabicDigits(String(i + 1))}</td><td>${a.name}</td><td>${a.organisation}</td><td>${a.role}</td></tr>`)
    .join('\n');
  const actions = m.actions
    .map((a, i) => `<tr><td class="number">${arabicDigits(String(i + 1))}</td><td>${a.text}</td><td>${a.owner}</td><td class="due">${arabicDate(a.due)}</td></tr>`)
    .join('\n');
  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>محضر اجتماع التنسيق الموقعي رقم ${arabicDigits(m.number)}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <div class="issuer">دون لاين للاستشارات الهندسية، مكتب المهندس المقيم</div>
  <h1>محضر اجتماع التنسيق الموقعي رقم ${arabicDigits(m.number)}</h1>
  <div class="project">مشروع ${project.name}، العقد رقم ${contract.number}</div>
</header>

<table class="info">
  <tr><td>التاريخ</td><td>${arabicWeekday(m.date)} ${arabicDate(m.date)}، الموافق ${arabicHijriDate(m.date)}</td></tr>
  <tr><td>الوقت</td><td>من الساعة ${arabicDigits('10:00')} صباحًا إلى الساعة ${arabicDigits('12:30')} ظهرًا</td></tr>
  <tr><td>المكان</td><td>مكتب المهندس في الموقع، حي الملقا، الرياض</td></tr>
</table>

<h2>الحضور</h2>
<table>
  <tr><th class="number">م</th><th>الاسم</th><th>الجهة</th><th>الصفة</th></tr>
  ${attendees}
</table>

<h2>${arabicDigits('1')}. اعتماد محضر الاجتماع السابق</h2>
<p>اعتُمد محضر اجتماع التنسيق رقم ${arabicDigits(m.previousNumber)} المنعقد بتاريخ ${arabicDate(m.previousDate)} دون ملاحظات.</p>

<h2>${arabicDigits('2')}. سير الأعمال</h2>
<ul>
  <li>اكتملت أعمال الخوازيق الخرسانية بالكامل، وبلغت نسبة الحفر العام حتى منسوب التأسيس ${arabicDigits('70')}٪.</li>
  <li>بلغت نسبة الإنجاز الإجمالية ${arabicDigits('24.6')}٪ مقابل ${arabicDigits('26.1')}٪ حسب البرنامج الزمني المعتمد.</li>
  <li>لم تُسجَّل أي إصابة مضيِّعة للوقت خلال الفترة، وبلغ إجمالي ساعات العمل الآمنة ${arabicDigits('412,300')} ساعة.</li>
</ul>

<h2>${arabicDigits('3')}. القرارات</h2>
<p class="decision"><span class="ref">${arabicDigits('3-1')} حجر واجهة المنصة:</span>${facadeStoneDecision()}</p>
<p class="decision"><span class="ref">${arabicDigits('3-2')} اختبار تحميل الخوازيق:</span>يُؤجَّل صب الطبقة الأولى من اللبشة إلى ${arabicDate('2026-11-22')} لحين اعتماد تقرير اختبار تحميل الخوازيق.</p>
<p class="decision"><span class="ref">${arabicDigits('3-3')} الصب الليلي:</span>يُسمح بصب الخرسانة ليلًا من الساعة ${arabicDigits('10')} مساءً حتى الساعة ${arabicDigits('5')} صباحًا بعد موافقة المهندس الكتابية على كل صبة، مع الالتزام بخطة السلامة المعتمدة.</p>

<h2 class="new-page">${arabicDigits('4')}. الإجراءات المطلوبة</h2>
<table>
  <tr><th class="number">م</th><th>الإجراء</th><th>المسؤول</th><th class="due">الموعد النهائي</th></tr>
  ${actions}
</table>

<h2>${arabicDigits('5')}. ملاحظات المقاول</h2>
<p>أفاد المقاول بأن ${m.facadeStone.stone} متوفر من محاجر محلية، وأن مدة توريده ستة أسابيع مقابل أربعة عشر أسبوعًا للجرانيت المستورد.</p>

<h2>${arabicDigits('6')}. الاجتماع القادم</h2>
<p>يُعقد اجتماع التنسيق رقم ${arabicDigits(m.nextNumber)} يوم ${arabicWeekday(m.nextMeeting)} ${arabicDate(m.nextMeeting)} الساعة ${arabicDigits('10:00')} صباحًا في مكتب المهندس بالموقع.</p>

<div class="signatures">
  <div>المهندس</div>
  <div>المقاول</div>
  <div>المالك</div>
</div>

<p class="fictional">وثيقة نموذجية خيالية أُعدّت لاختبار Atlas. جميع الأسماء والمبالغ خيالية.</p>
</body>
</html>`;
}

/** Footer on every page: the fictional-document note and the page number. */
export function minutesFooter(): string {
  return `<div style="width:100%; margin:0 17mm; font-family:'Segoe UI', Arial, sans-serif; font-size:7.5pt; color:#555b66; display:flex; justify-content:space-between;">
  <span>${FOOTER_TEXT}</span>
  <span dir="rtl">صفحة <span class="pageNumber"></span> من <span class="totalPages"></span></span>
</div>`;
}
