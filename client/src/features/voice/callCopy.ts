import type { VoiceDialect, VoiceOption } from '@atlas/shared';
import type { MicrophoneProblem } from '../../api/microphone';
import { type ArabicNoun, countAr, countEn, figure } from '../../i18n/count';
import type { Bilingual, Language } from '../../i18n/language';
import { chatCopy } from '../chat/chatCopy';
import type { EndReason, MicTrouble } from './CallSession';

/**
 * What the call tells the voice to say when Atlas has no answer to give. GPT-Live says it in the call's language
 * and dialect, in its own words, so these stay English whatever the interface language.
 */
export const spokenUpdates = {
  didNotCatch: "I didn't catch the question. Could you say it again?",
  stillWorking: "I'm still checking the documents. This one takes a little longer.",
  busy: "I'm still answering the question before. Ask me again in a moment.",
  failed: (reason: string) => `I couldn't check the documents this time. ${reason}`,
  /** Quiet context, never said on its own. */
  stopped: 'The user stopped this question in the app, so it has no answer. Do not answer it yourself.',
};

const secondsAr: ArabicNoun = { one: 'ثانية واحدة', two: 'ثانيتين', few: 'ثوانٍ', many: 'ثانية', other: 'ثانية' };
const minutesAr: ArabicNoun = { one: 'دقيقة واحدة', two: 'دقيقتين', few: 'دقائق', many: 'دقيقة', other: 'دقيقة' };
const voicesAr: ArabicNoun = { one: 'صوت واحد', two: 'صوتان', few: 'أصوات', many: 'صوتًا', other: 'صوت' };

/** Each voice's dialect by its Arabic name, as the picker lists it and as "صوت خليجي" names it. */
const arabicDialects: Record<VoiceDialect, string> = {
  english: 'الإنجليزية',
  gulf: 'خليجي',
  levantine: 'شامي',
  egyptian: 'مصري',
  maghrebi: 'مغاربي',
  msa: 'الفصحى',
};

/** How a call speaks, after a verb: "باللهجة الخليجية". */
const arabicSpeech: Record<VoiceDialect, string> = {
  english: 'بالإنجليزية',
  gulf: 'باللهجة الخليجية',
  levantine: 'باللهجة الشامية',
  egyptian: 'باللهجة المصرية',
  maghrebi: 'باللهجة المغاربية',
  msa: 'بالفصحى',
};

const arabicGenders: Record<VoiceOption['gender'], string> = { female: 'أنثى', male: 'ذكر' };

/** The call's voice; undefined while the voices load, which reads as English. */
type CallVoice = VoiceOption | undefined;

export interface CallCopy {
  /** The call card's accessible name. */
  card: string;
  /** The line beside Atlas's face: what the call is doing right now. */
  status: {
    calling: (voice: CallVoice) => string;
    /** The call waits for its voice to be made, the first time that voice is used. */
    preparing: (voice: CallVoice) => string;
    switching: string;
    ending: string;
    ended: string;
    speaking: string;
    muted: string;
    listening: string;
  };
  /** The line under the card. */
  hints: { allowMicrophone: string; preparingVoice: string; muted: string; standing: string };
  /** The tooltip on the call's clock and cost, given the price as "$0.05". */
  price: (perMinute: string) => string;
  /** The caption speakers. */
  you: string;
  atlas: string;
  /** The user's caption before they say anything. */
  askPrompt: string;
  stopAnswer: string;
  stopTheAnswer: string;
  mute: string;
  unmute: string;
  endCall: string;
  /** A call that may not be hearing the user, and what to try. */
  micTrouble: Record<MicTrouble, string>;
  /** Why a call ended, when it was not the user hanging up. */
  ended: { idle: (idleSeconds: number) => string; limit: (maxMinutes: number) => string; dropped: string; content: string };
  /** A call that could not start, then why. */
  couldNotStart: (reason: string) => string;
  picker: {
    label: string;
    /** "Voice: Gulf Arabic, female voice". */
    current: (name: string) => string;
    /** Each group's heading. */
    languages: Record<VoiceOption['language'], string>;
    /** A group heading with how many of its voices are not ready yet. */
    stillPreparing: (heading: string, waiting: number) => string;
    /** "Gulf · female": the dialect without the word Arabic, which the group heading already says. */
    option: (voice: VoiceOption) => string;
    /** "Gulf Arabic, female voice" for screen readers. */
    name: (voice: VoiceOption) => string;
  };
}

/** Interface text for the voice call: its card, its voice picker, and why a call could not start or ended. */
export const callCopy: Bilingual<CallCopy> = {
  en: {
    card: 'Voice call with Atlas',
    status: {
      calling: (voice) => `Calling Atlas in ${voice?.label ?? 'English'}…`,
      preparing: (voice) => `Preparing the ${voice?.label ?? 'English'} voice…`,
      switching: 'Changing the voice…',
      ending: 'Ending the call…',
      ended: 'Call ended',
      speaking: 'Atlas is speaking',
      muted: 'Muted',
      listening: 'Listening',
    },
    hints: {
      allowMicrophone: 'Allow the microphone if the browser asks.',
      preparingVoice: 'A new voice takes about 20 seconds to make, the first time only. After that its calls start straight away.',
      muted: 'Atlas cannot hear you while the microphone is muted.',
      standing: 'Speak naturally and interrupt any time. Every answer is also written above, with its sources.',
    },
    price: (perMinute) => `Calls cost ${perMinute} a minute, billed by the second.`,
    you: 'You',
    atlas: 'Atlas',
    askPrompt: 'Ask about the documents, in English or Arabic.',
    stopAnswer: 'Stop answer',
    stopTheAnswer: 'Stop the answer',
    mute: 'Mute the microphone',
    unmute: 'Unmute the microphone',
    endCall: 'End call',
    micTrouble: {
      silent: 'Your microphone is sending no sound. Check the input device in your sound settings, then call again.',
      unheard: "Atlas hasn't caught any of your words yet. If you are speaking, end the call and call again.",
    },
    ended: {
      idle: (idle) => `The call ended after ${spanEn(idle)} of silence, so it stopped costing anything. Call again any time.`,
      limit: (max) => `Calls end after ${countEn(max, 'minute', 'minutes')}. Call again to keep going.`,
      dropped: 'The call dropped. Check the connection, then call again.',
      content: 'The voice service ended the call. Call again to keep going.',
    },
    couldNotStart: (reason) => `Atlas could not start the call. ${reason}`,
    picker: {
      label: 'Voice',
      current: (name) => `Voice: ${name}`,
      languages: { en: 'English', ar: 'Arabic' },
      stillPreparing: (heading, waiting) => `${heading} · ${figure(waiting)} still preparing`,
      option: (voice) => `${voice.language === 'ar' ? voice.label.replace(/ Arabic$/, '') : voice.label} · ${voice.gender}`,
      name: (voice) => `${voice.label}, ${voice.gender} voice`,
    },
  },
  ar: {
    card: 'مكالمة صوتية مع Atlas',
    status: {
      calling: (voice) => `جارٍ الاتصال بـ Atlas ${arabicSpeech[voice?.dialect ?? 'english']}…`,
      preparing: (voice) => `جارٍ تجهيز صوت ${arabicDialects[voice?.dialect ?? 'english']}…`,
      switching: 'جارٍ تغيير الصوت…',
      ending: 'جارٍ إنهاء المكالمة…',
      ended: 'انتهت المكالمة',
      speaking: 'Atlas يتحدث',
      muted: 'الصوت مكتوم',
      listening: 'أستمع',
    },
    hints: {
      allowMicrophone: 'اسمح باستخدام الميكروفون إذا طلب المتصفح ذلك.',
      preparingVoice: 'يستغرق تجهيز صوت جديد نحو 20 ثانية، في المرة الأولى فقط. بعدها تبدأ مكالماته فورًا.',
      muted: 'لا يسمعك Atlas ما دام الميكروفون مكتومًا.',
      standing: 'تحدّث بشكل طبيعي وقاطِع متى شئت. كل إجابة تُكتب أيضًا في الأعلى مع مصادرها.',
    },
    price: (perMinute) => `تكلفة المكالمة ${perMinute} في الدقيقة، وتُحتسب بالثانية.`,
    you: 'أنت',
    atlas: 'Atlas',
    askPrompt: 'اسأل عن المستندات، بالعربية أو بالإنجليزية.',
    stopAnswer: 'أوقف الإجابة',
    stopTheAnswer: 'أوقف الإجابة',
    mute: 'كتم الميكروفون',
    unmute: 'إلغاء كتم الميكروفون',
    endCall: 'إنهاء المكالمة',
    micTrouble: {
      silent: 'لا يصل أي صوت من الميكروفون. تحقق من جهاز الإدخال في إعدادات الصوت، ثم اتصل مرة أخرى.',
      unheard: 'لم يلتقط Atlas أي كلمة منك بعد. إذا كنت تتحدث، فأنهِ المكالمة ثم اتصل مرة أخرى.',
    },
    ended: {
      idle: (idle) => `انتهت المكالمة بعد ${spanAr(idle)} من الصمت، فتوقفت تكلفتها. اتصل مرة أخرى متى شئت.`,
      limit: (max) => `تنتهي المكالمة بعد ${countAr(max, minutesAr)}. اتصل مرة أخرى لتكمل.`,
      dropped: 'انقطعت المكالمة. تحقق من الاتصال، ثم اتصل مرة أخرى.',
      content: 'أنهت خدمة الصوت المكالمة. اتصل مرة أخرى لتكمل.',
    },
    couldNotStart: (reason) => `تعذّر على Atlas بدء المكالمة. ${reason}`,
    picker: {
      label: 'الصوت',
      current: (name) => `الصوت: ${name}`,
      languages: { en: 'الإنجليزية', ar: 'العربية' },
      stillPreparing: (heading, waiting) => `${heading} · ${countAr(waiting, voicesAr)} قيد التجهيز`,
      option: (voice) => `${arabicDialects[voice.dialect]} · ${arabicGenders[voice.gender]}`,
      name: (voice) => `${arabicDialects[voice.dialect]}، صوت ${arabicGenders[voice.gender]}`,
    },
  },
};

/** Plain words for a call that may not be hearing the user, and what to try. */
export function micTroubleMessage(trouble: MicTrouble, language: Language = 'en'): string {
  return callCopy[language].micTrouble[trouble];
}

/** Plain words for a microphone that could not be opened, and what to do about it: the same words dictation uses. */
export function microphoneMessage(problem: MicrophoneProblem, language: Language = 'en'): string {
  return chatCopy[language].composer.microphone[problem];
}

/** Why a call ended, when it was not the user hanging up. Null means nothing needs saying. */
export function endedMessage(reason: EndReason | null, idleSeconds: number, maxMinutes: number, language: Language = 'en'): string | null {
  const ended = callCopy[language].ended;
  switch (reason) {
    case 'idle':
      return ended.idle(idleSeconds);
    case 'limit':
      return ended.limit(maxMinutes);
    case 'dropped':
      return ended.dropped;
    case 'content':
      return ended.content;
    default:
      return null;
  }
}

/** "2 minutes" for whole minutes, "90 seconds" otherwise. */
function spanEn(span: number): string {
  if (span >= 60 && span % 60 === 0) return countEn(span / 60, 'minute', 'minutes');
  return countEn(span, 'second', 'seconds');
}

/** "دقيقتين" for whole minutes, "90 ثانية" otherwise. */
function spanAr(span: number): string {
  if (span >= 60 && span % 60 === 0) return countAr(span / 60, minutesAr);
  return countAr(span, secondsAr);
}

/** "1:24" for a call's length; "12:05" past ten minutes. The same digits in both languages. */
export function clockText(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
