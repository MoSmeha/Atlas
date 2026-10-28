import { arabicAmount, arabicDate, arabicDigits } from './lib/arabicText';

export interface Attendee {
  name: string;
  organisation: string;
  role: string;
}

export interface MinutesAction {
  text: string;
  owner: string;
  /** YYYY-MM-DD. */
  due: string;
}

/**
 * Meeting_Minutes_07_AR.pdf: minutes of a site coordination meeting, written in Arabic. The change of the podium
 * facade stone, its variation order and its deadline appear in no other sample document.
 */
export const meetingMinutes = {
  fileName: 'Meeting_Minutes_07_AR.pdf',
  number: '07',
  previousNumber: '06',
  nextNumber: '08',
  date: '2026-10-12',
  previousDate: '2026-09-28',
  nextMeeting: '2026-10-26',
  pages: 2,
  facadeStone: {
    item: '4.1.01',
    replaced: 'الجرانيت الطبيعي',
    stone: 'حجر الرياض الجيري',
    stoneInEnglish: 'Riyadh limestone',
    thicknessMm: 50,
    variationOrder: 'VO-014',
    amount: 2_350_000,
    currency: 'SAR',
    deadline: '2026-11-15',
  },
  attendees: [
    { name: 'م. فيصل الحربي', organisation: 'سراب كرست للتطوير العقاري (المالك)', role: 'مدير المشاريع' },
    { name: 'م. لينا المطيري', organisation: 'دون لاين للاستشارات الهندسية (المهندس)', role: 'المهندسة المقيمة، رئيسة الاجتماع' },
    { name: 'م. ياسر الشهري', organisation: 'دون لاين للاستشارات الهندسية (المهندس)', role: 'مهندس الكميات، معدّ المحضر' },
    { name: 'م. عمر القحطاني', organisation: 'قمم ريدج للمقاولات (المقاول)', role: 'المدير العام' },
    { name: 'م. خالد الدوسري', organisation: 'قمم ريدج للمقاولات (المقاول)', role: 'مدير المشروع' },
    { name: 'أ. سارة العتيبي', organisation: 'رواسي لأنظمة الواجهات (مقاول الواجهات)', role: 'مديرة التصميم' },
  ] satisfies Attendee[],
  actions: [
    { text: 'تقديم العينات النهائية لحجر الرياض الجيري ولوحة النموذج', owner: 'المقاول ورواسي لأنظمة الواجهات', due: '2026-11-15' },
    { text: 'توقيع أمر التغيير VO-014 وإرساله إلى المقاول', owner: 'المالك', due: '2026-10-19' },
    { text: 'مراجعة مخططات تفاصيل تثبيت الحجر', owner: 'المهندس', due: '2026-10-22' },
    { text: 'تقديم تقرير اختبار تحميل الخوازيق', owner: 'المقاول', due: '2026-10-29' },
    { text: 'تحديث البرنامج الزمني ليعكس تغيير حجر الواجهة وتقدم أعمال الحفر', owner: 'المقاول', due: '2026-11-05' },
  ] satisfies MinutesAction[],
};

/** Decision 3-1, the fact only this document holds. */
export function facadeStoneDecision(): string {
  const stone = meetingMinutes.facadeStone;
  return (
    `وافق المالك على استبدال ${stone.replaced} في البند ${stone.item} من جدول كميات أعمال الواجهات (المرحلة الثانية) ` +
    `ب${stone.stone} المحلي بسماكة ${arabicDigits(String(stone.thicknessMm))} مم وتشطيب مصقول غير لامع، ` +
    `وذلك بموجب أمر التغيير المعتمد رقم ${stone.variationOrder} بقيمة إضافية قدرها ${arabicAmount(stone.amount)} ريال ` +
    'غير شاملة ضريبة القيمة المضافة. ' +
    `ويلتزم المقاول بتقديم العينات النهائية ولوحة النموذج لاعتماد المهندس في موعد أقصاه ${arabicDate(stone.deadline)}.`
  );
}
