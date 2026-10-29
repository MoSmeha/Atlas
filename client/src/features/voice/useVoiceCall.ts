import { useContext } from 'react';
import { VoiceCallContext, type VoiceCallValue } from './VoiceCallContext';

/** The voice call and its controls. Call it inside VoiceCallProvider. */
export function useVoiceCall(): VoiceCallValue {
  const voice = useContext(VoiceCallContext);
  if (!voice) throw new Error('useVoiceCall needs a VoiceCallProvider above it.');
  return voice;
}
