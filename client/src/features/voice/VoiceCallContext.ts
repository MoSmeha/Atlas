import { createContext } from 'react';
import type { VoiceOption } from '@atlas/shared';
import type { AudioLevels } from '../../api/audioMeter';
import type { CallView } from './CallSession';

/**
 * A line the question box's hint shows in place of the hint, such as a blocked microphone or why a call ended. Voice
 * problems belong next to the controls that retry them, so they never float over those controls.
 */
export interface VoiceNotice {
  tone: 'error' | 'info';
  text: string;
}

/** The voice call and dictation settings, shared by the composer, the call card and the thread. */
export interface VoiceCallValue {
  /** The server has a key and the account can use the call model. */
  callsAvailable: boolean;
  dictationAvailable: boolean;
  maxDictationSeconds: number;
  voices: VoiceOption[];
  /** The server is still making the voices that are not ready. */
  preparingVoices: boolean;
  /** The voice the next call uses, and the one the open call uses. */
  voiceId: string | null;
  /** Picks the next call's voice and remembers it. */
  chooseVoice(voiceId: string): void;
  /** The open call, or null when there is none. */
  call: CallView | null;
  /** Why the last call could not start or why it ended; null when there is nothing to say. */
  notice: VoiceNotice | null;
  /** US dollars per minute of a call. */
  pricePerMinute: number;
  levels(): AudioLevels;
  start(): void;
  hangUp(): void;
  setMuted(muted: boolean): void;
  stopQuestion(): void;
}

export const VoiceCallContext = createContext<VoiceCallValue | null>(null);
