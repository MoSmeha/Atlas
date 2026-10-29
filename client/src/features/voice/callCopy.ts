import type { MicrophoneProblem } from '../../api/microphone';
import type { MicTrouble } from './CallSession';

/**
 * What the call tells the voice to say when Atlas has no answer to give. GPT-Live says it in the call's language
 * and dialect, in its own words.
 */
export const spokenUpdates = {
  didNotCatch: "I didn't catch the question. Could you say it again?",
  stillWorking: "I'm still checking the documents. This one takes a little longer.",
  busy: "I'm still answering the question before. Ask me again in a moment.",
  failed: (reason: string) => `I couldn't check the documents this time. ${reason}`,
  /** Quiet context, never said on its own. */
  stopped: 'The user stopped this question in the app, so it has no answer. Do not answer it yourself.',
};

/** The hint while a call waits for its voice to be made, which happens once per voice. */
export const preparingVoiceHint = 'A new voice takes about 20 seconds to make, the first time only. After that its calls start straight away.';

/** Plain words for a call that may not be hearing the user, and what to try. */
export function micTroubleMessage(trouble: MicTrouble): string {
  switch (trouble) {
    case 'silent':
      return 'Your microphone is sending no sound. Check the input device in your sound settings, then call again.';
    case 'unheard':
      return "Atlas hasn't caught any of your words yet. If you are speaking, end the call and call again.";
  }
}

/** Plain words for a microphone that could not be opened, and what to do about it. */
export function microphoneMessage(problem: MicrophoneProblem): string {
  switch (problem) {
    case 'blocked':
      return 'The browser blocked the microphone. Allow it from the icon in the address bar, then try again.';
    case 'missing':
      return 'No microphone was found. Connect one, then try again.';
    case 'busy':
      return 'Another app is using the microphone. Close it, then try again.';
    case 'unsupported':
      return 'This browser cannot use a microphone here. Open Atlas in Edge or Chrome at localhost.';
    case 'failed':
      return 'The microphone could not be opened. Check it, then try again.';
  }
}

/** Why a call ended, when it was not the user hanging up. Null means nothing needs saying. */
export function endedMessage(reason: string | null, idleSeconds: number, maxMinutes: number): string | null {
  switch (reason) {
    case 'idle':
      return `The call ended after ${spanText(idleSeconds)} of silence, so it stopped costing anything. Call again any time.`;
    case 'limit':
      return `Calls end after ${maxMinutes} minutes. Call again to keep going.`;
    case 'dropped':
      return 'The call dropped. Check the connection, then call again.';
    case 'content':
      return 'The voice service ended the call. Call again to keep going.';
    default:
      return null;
  }
}

/** "2 minutes" for whole minutes, "90 seconds" otherwise. */
function spanText(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) return seconds === 60 ? '1 minute' : `${seconds / 60} minutes`;
  return `${seconds} seconds`;
}

/** "1:24" for a call's length; "12:05" past ten minutes. */
export function clockText(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
