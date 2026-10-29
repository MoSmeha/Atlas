import type { ModelTier } from '@atlas/shared';
import { type ArabicNoun, countAr, countEn } from '../../i18n/count';
import type { Bilingual, Language } from '../../i18n/language';

const questions: ArabicNoun = { one: 'سؤال واحد', two: 'سؤالين', few: 'أسئلة', many: 'سؤالًا', other: 'سؤال' };

interface TopbarCopy {
  clearChat: string;
  clearFailed: string;
  model: string;
  defaultModel: string;
  loadingModels: string;
  /** The lineup failed to load: why, then what happens to questions. */
  modelsFailed: (reason: string) => string;
  /** What each tier is good for, in plain words. */
  tiers: Record<ModelTier, string>;
  usageLabel: (cost: string, time: string) => string;
  lastAnswer: (model: string) => string;
  inputTokens: (tokens: string) => string;
  outputTokens: (tokens: string) => string;
  cached: (tokens: string) => string;
  reasoning: (tokens: string) => string;
  thisChat: (cost: string, questions: number) => string;
  seconds: string;
  minutes: string;
  toDark: string;
  toLight: string;
  /** The other language, written in its own script, and its code. */
  otherLanguage: { name: string; code: Language; hint: string };
}

/** Interface text for the top bar's controls. */
export const topbarCopy: Bilingual<TopbarCopy> = {
  en: {
    clearChat: 'Clear chat',
    clearFailed: 'Atlas could not clear the chat',
    model: 'Model',
    defaultModel: 'Default model',
    loadingModels: 'Loading models',
    modelsFailed: (reason) => `${reason} Questions go to the default model.`,
    tiers: {
      frontier: 'Most thorough, highest cost',
      balanced: 'Good balance of depth and cost',
      small: 'Fastest, lowest cost',
    },
    usageLabel: (cost, time) => `Last answer cost ${cost} and took ${time}`,
    lastAnswer: (model) => `Last answer, ${model}`,
    inputTokens: (tokens) => `Input ${tokens} tokens`,
    outputTokens: (tokens) => `Output ${tokens} tokens`,
    cached: (tokens) => ` (${tokens} cached)`,
    reasoning: (tokens) => ` (${tokens} reasoning)`,
    thisChat: (cost, n) => `This chat: ${cost} over ${countEn(n, 'question', 'questions')}`,
    seconds: 's',
    minutes: 'min',
    toDark: 'Switch to dark theme',
    toLight: 'Switch to light theme',
    otherLanguage: { name: 'العربية', code: 'ar', hint: 'Show Atlas in Arabic' },
  },
  ar: {
    clearChat: 'مسح المحادثة',
    clearFailed: 'تعذّر على Atlas مسح المحادثة',
    model: 'النموذج',
    defaultModel: 'النموذج الافتراضي',
    loadingModels: 'جارٍ تحميل النماذج',
    modelsFailed: (reason) => `${reason} تذهب الأسئلة إلى النموذج الافتراضي.`,
    tiers: {
      frontier: 'الأدق، والأعلى تكلفة',
      balanced: 'توازن جيد بين العمق والتكلفة',
      small: 'الأسرع، والأقل تكلفة',
    },
    usageLabel: (cost, time) => `كلّفت آخر إجابة ${cost} واستغرقت ${time}`,
    lastAnswer: (model) => `آخر إجابة، ${model}`,
    inputTokens: (tokens) => `رموز الإدخال: ${tokens}`,
    outputTokens: (tokens) => `رموز الإخراج: ${tokens}`,
    cached: (tokens) => ` (${tokens} من الذاكرة المؤقتة)`,
    reasoning: (tokens) => ` (${tokens} للتفكير)`,
    thisChat: (cost, n) => `هذه المحادثة: ${cost} مقابل ${countAr(n, questions)}`,
    seconds: 'ث',
    minutes: 'د',
    toDark: 'التبديل إلى المظهر الداكن',
    toLight: 'التبديل إلى المظهر الفاتح',
    otherLanguage: { name: 'English', code: 'en', hint: 'اعرض Atlas بالإنجليزية' },
  },
};
