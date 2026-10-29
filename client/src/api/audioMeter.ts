/** How loud the microphone and Atlas's voice are right now, each from 0 (silence) to 1. */
export interface AudioLevels {
  mic: number;
  voice: number;
}

export const silence: AudioLevels = { mic: 0, voice: 0 };

const FFT_SIZE = 512;
/** Speech rarely passes a fifth of full scale, so the RMS is scaled up to use the whole 0 to 1 range. */
const GAIN = 5;

/**
 * Measures the loudness of live audio streams for the call face and the activity line. Nothing it listens to is
 * played through it: the call's own audio element plays Atlas's voice, so the voice is never heard twice.
 */
export class AudioMeter {
  private readonly context: AudioContext;
  private readonly samples = new Float32Array(FFT_SIZE);
  private mic: AnalyserNode | null = null;
  private voice: AnalyserNode | null = null;

  /** Create it inside the click that starts the call or dictation, so the browser lets the audio run. */
  constructor() {
    this.context = new AudioContext();
    void this.context.resume().catch(() => undefined);
  }

  listenToMic(stream: MediaStream): void {
    this.mic = this.analyse(stream);
  }

  listenToVoice(stream: MediaStream): void {
    this.voice = this.analyse(stream);
  }

  levels(): AudioLevels {
    return { mic: this.level(this.mic), voice: this.level(this.voice) };
  }

  close(): void {
    void this.context.close().catch(() => undefined);
  }

  private analyse(stream: MediaStream): AnalyserNode {
    const node = this.context.createAnalyser();
    node.fftSize = FFT_SIZE;
    node.smoothingTimeConstant = 0.5;
    this.context.createMediaStreamSource(stream).connect(node);
    return node;
  }

  private level(node: AnalyserNode | null): number {
    if (node === null || this.context.state !== 'running') return 0;
    node.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (const sample of this.samples) sum += sample * sample;
    return Math.min(1, Math.sqrt(sum / this.samples.length) * GAIN);
  }
}
