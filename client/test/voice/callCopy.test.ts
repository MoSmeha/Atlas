import type { VoiceOption } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import type { MicrophoneProblem } from '../../src/api/microphone';
import { chatCopy } from '../../src/features/chat/chatCopy';
import { callCopy, clockText, endedMessage, microphoneMessage } from '../../src/features/voice/callCopy';

const { en, ar } = callCopy;
const english: VoiceOption = {
  id: 'english-female',
  label: 'English',
  nativeLabel: null,
  language: 'en',
  dialect: 'english',
  gender: 'female',
  ready: true,
};
const gulf: VoiceOption = {
  id: 'gulf-male',
  label: 'Gulf Arabic',
  nativeLabel: 'خليجي',
  language: 'ar',
  dialect: 'gulf',
  gender: 'male',
  ready: false,
};

describe('endedMessage', () => {
  it('says why a call ended, and nothing when the user hung up', () => {
    expect(endedMessage('idle', 120, 30)).toBe(
      'The call ended after 2 minutes of silence, so it stopped costing anything. Call again any time.',
    );
    expect(endedMessage('idle', 90, 30)).toContain('after 90 seconds of silence');
    expect(endedMessage('limit', 120, 30)).toBe('Calls end after 30 minutes. Call again to keep going.');
    expect(endedMessage('hung_up', 120, 30)).toBeNull();
    expect(endedMessage('failed', 120, 30, 'ar')).toBeNull();
  });

  it('says the same in Arabic, with Western digits', () => {
    expect(endedMessage('idle', 120, 30, 'ar')).toBe('انتهت المكالمة بعد دقيقتين من الصمت، فتوقفت تكلفتها. اتصل مرة أخرى متى شئت.');
    expect(endedMessage('limit', 120, 30, 'ar')).toBe('تنتهي المكالمة بعد 30 دقيقة. اتصل مرة أخرى لتكمل.');
  });
});

describe('microphoneMessage', () => {
  it('uses the words dictation uses, in both languages', () => {
    const problems: MicrophoneProblem[] = ['blocked', 'missing', 'busy', 'unsupported', 'failed'];
    for (const problem of problems) {
      expect(microphoneMessage(problem)).toBe(chatCopy.en.composer.microphone[problem]);
      expect(microphoneMessage(problem, 'ar')).toBe(chatCopy.ar.composer.microphone[problem]);
    }
  });
});

describe('the call card', () => {
  it('names the voice the call connects in', () => {
    expect(en.status.calling(gulf)).toBe('Calling Atlas in Gulf Arabic…');
    expect(en.status.preparing(undefined)).toBe('Preparing the English voice…');
    expect(ar.status.calling(gulf)).toBe('جارٍ الاتصال بـ Atlas باللهجة الخليجية…');
    expect(ar.status.preparing(gulf)).toBe('جارٍ تجهيز صوت خليجي…');
  });

  it('writes the clock the same way in both languages', () => {
    expect(clockText(84)).toBe('1:24');
    expect(clockText(725.6)).toBe('12:05');
  });
});

describe('the voice picker', () => {
  it('lists each voice under its language', () => {
    expect(en.picker.option(gulf)).toBe('Gulf · male');
    expect(en.picker.option(english)).toBe('English · female');
    expect(ar.picker.option(gulf)).toBe('خليجي · ذكر');
    expect(ar.picker.option(english)).toBe('الإنجليزية · أنثى');
  });

  it('counts the voices still being made', () => {
    expect(en.picker.stillPreparing('Arabic', 3)).toBe('Arabic · 3 still preparing');
    expect(ar.picker.stillPreparing('العربية', 2)).toBe('العربية · صوتان قيد التجهيز');
    expect(ar.picker.stillPreparing('العربية', 10)).toBe('العربية · 10 أصوات قيد التجهيز');
  });
});
