import type { VoiceCatalog } from '../../src/application/voice/VoiceCatalog';

const englishSpeaking = 'Speak clear English.';
const gulfSpeaking = 'تكلّم باللهجة الخليجية.';

/** A small catalog: one built-in English voice and one designed Gulf voice. */
export const testVoiceCatalog: VoiceCatalog = {
  call: { model: 'live-model', pricePerMinute: 0.05, idleSeconds: 120, maxMinutes: 30 },
  dictation: { model: 'transcribe-model', pricePerMinute: 0.006, maxSeconds: 120 },
  defaultVoice: 'english-female',
  dialects: {
    english: { label: 'English', nativeLabel: null, language: 'en', speaking: englishSpeaking, hello: "Hi, I'm Atlas.", designScript: null },
    gulf: { label: 'Gulf Arabic', nativeLabel: 'خليجي', language: 'ar', speaking: gulfSpeaking, hello: 'هلا، أنا أطلس.', designScript: 'هلا والله، أنا أطلس. وش تبي تعرف؟' },
    levantine: { label: 'Levantine Arabic', nativeLabel: 'شامي', language: 'ar', speaking: 'احكِ شامي.', hello: 'أهلين.', designScript: null },
    egyptian: { label: 'Egyptian Arabic', nativeLabel: 'مصري', language: 'ar', speaking: 'اتكلم مصري.', hello: 'أهلاً.', designScript: null },
    maghrebi: { label: 'North African Arabic', nativeLabel: 'مغاربي', language: 'ar', speaking: 'هضر بالدارجة.', hello: 'مرحبا.', designScript: null },
    msa: { label: 'Modern Standard Arabic', nativeLabel: 'فصحى', language: 'ar', speaking: 'تحدّث بالفصحى.', hello: 'مرحباً.', designScript: null },
  },
  voices: [
    { id: 'english-female', dialect: 'english', gender: 'female', sound: { kind: 'builtIn', name: 'marin' } },
    { id: 'gulf-male', dialect: 'gulf', gender: 'male', sound: { kind: 'designed', description: 'A calm man from Riyadh speaking Gulf Arabic.' } },
  ],
};
