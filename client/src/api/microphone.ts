/** Why the microphone could not be opened. */
export type MicrophoneProblem = 'blocked' | 'missing' | 'busy' | 'unsupported' | 'failed';

/** The microphone could not be opened; `problem` says why, so the message can say what to do. */
export class MicrophoneError extends Error {
  readonly problem: MicrophoneProblem;

  constructor(problem: MicrophoneProblem) {
    super(`The microphone could not be opened (${problem}).`);
    this.name = 'MicrophoneError';
    this.problem = problem;
  }
}

/** Opens the microphone with echo cancellation, so Atlas does not hear its own voice through the speakers. */
export async function openMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new MicrophoneError('unsupported');
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (error) {
    throw new MicrophoneError(error instanceof DOMException ? problemOf(error.name) : 'failed');
  }
}

/** Stops every track, which turns off the browser's recording indicator. */
export function closeMicrophone(stream: MediaStream | null): void {
  for (const track of stream?.getTracks() ?? []) track.stop();
}

function problemOf(name: string): MicrophoneProblem {
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'blocked';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  return 'failed';
}
