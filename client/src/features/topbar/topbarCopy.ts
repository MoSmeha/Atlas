import type { AnswerEffort, ModelProvider, ModelTier } from '@atlas/shared';
import { type ArabicNoun, countAr, countEn } from '../../i18n/count';
import type { Bilingual, Language } from '../../i18n/language';
import type { FreeProvider } from './freeTier';

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
  /** The same, for a provider that charges nothing. */
  freeTiers: Record<ModelTier, string>;
  /** The effort picker's name, for screen readers. */
  effort: string;
  /** Each effort's name, and how fast its answers come. */
  efforts: Record<AnswerEffort, { label: string; speed: string }>;
  /** Each provider's heading in the picker's list, shown when there are several. */
  providers: Record<ModelProvider, string>;
  /** The badge beside the picker while a free model is chosen, and what it means. */
  free: Record<FreeProvider, { label: string; hint: string }>;
  /** The cost of an answer that cost nothing. */
  freeCost: string;
  usageLabel: (cost: string, time: string) => string;
  freeUsageLabel: (time: string) => string;
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
    freeTiers: {
      frontier: 'Most thorough, free',
      balanced: 'Good balance of depth and speed, free',
      small: 'Fastest, free',
    },
    effort: 'Thinking effort',
    efforts: {
      low: { label: 'Low effort', speed: 'Fast' },
      medium: { label: 'Medium effort', speed: 'Medium speed' },
      high: { label: 'High effort', speed: 'Slower, most careful' },
    },
    providers: { openai: 'OpenAI', gemini: 'Gemini, free tier', ollama: 'On this computer, free' },
    free: {
      gemini: {
        label: 'Free tier',
        hint: "Gemini's free tier: answers cost nothing, up to a daily limit. Google uses what it is sent to improve its products, so keep confidential files off it.",
      },
      ollama: {
        label: 'Free, on this computer',
        hint: 'A model on this computer answers through Ollama. It costs nothing, and the documents never leave the computer.',
      },
    },
    freeCost: 'Free',
    usageLabel: (cost, time) => `Last answer cost ${cost} and took ${time}`,
    freeUsageLabel: (time) => `Last answer was free and took ${time}`,
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
    freeTiers: {
      frontier: 'الأدق، ومجاني',
      balanced: 'توازن جيد بين العمق والسرعة، ومجاني',
      small: 'الأسرع، ومجاني',
    },
    effort: 'مستوى التفكير',
    efforts: {
      low: { label: 'تفكير قليل', speed: 'سريع' },
      medium: { label: 'تفكير متوسط', speed: 'سرعة متوسطة' },
      high: { label: 'تفكير عميق', speed: 'أبطأ، والأدق' },
    },
    providers: { openai: 'OpenAI', gemini: 'Gemini، الباقة المجانية', ollama: 'على هذا الجهاز، مجاني' },
    free: {
      gemini: {
        label: 'الباقة المجانية',
        hint: 'الباقة المجانية من Gemini: الإجابات بلا تكلفة حتى حدّ يومي. تستخدم Google ما يُرسل إليها لتحسين منتجاتها، فلا تفتح عليها ملفات سرية.',
      },
      ollama: {
        label: 'مجاني، على هذا الجهاز',
        hint: 'يجيب نموذج على هذا الجهاز عبر Ollama. لا تكلفة، ولا تغادر المستندات الجهاز.',
      },
    },
    freeCost: 'مجانًا',
    usageLabel: (cost, time) => `كلّفت آخر إجابة ${cost} واستغرقت ${time}`,
    freeUsageLabel: (time) => `كانت آخر إجابة مجانية واستغرقت ${time}`,
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
